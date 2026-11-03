import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { companies, metricsMinute, opsAudit, opsFlags } from "../../db/schema";
import { env } from "../../lib/env";
import { HttpError, notFound } from "../../lib/errors";
import { getFlags, schemaFor, setFlag } from "../../lib/flags";
import { SLOS, sloWindow } from "../../lib/slo";
import { parseParam, validateBody } from "../../middleware/validate";
import { currentUser } from "../../middleware/require-auth";

/**
 * /api/admin (WP-27, CISO mustFix 3): the owner's minimal controls. Mounted behind requireAuth and requireAdmin
 * (middleware/require-admin.ts): ADMIN_USER_IDS and a sign-in under 15 minutes old, else 404 or 403 reauth_required.
 * Every write runs in one transaction with its ops_audit row, so a write without an audit row cannot commit.
 */
export const adminRouter = Router();

/** The resolved flags, the raw rows behind them, and which env fallbacks are in force. */
adminRouter.get("/flags", async (_req, res) => {
  const [flags, rows] = await Promise.all([getFlags(), db().select().from(opsFlags)]);
  res.json({
    flags: { ...flags, extensionOnly: [...flags.extensionOnly], features: Object.fromEntries(flags.features) },
    rows: rows.map((r) => ({ key: r.key, value: r.value, updatedBy: r.updatedBy, updatedAt: r.updatedAt })),
    env: { PAUSE_SCORING: env().PAUSE_SCORING, LLM_SHED_LEVEL: env().LLM_SHED_LEVEL, CLOUD_APPLIER_OPEN: env().CLOUD_APPLIER_OPEN },
  });
});

const flagBody = z.object({ value: z.unknown() });

adminRouter.put("/flags/:key", validateBody(flagBody), async (req, res) => {
  const key = parseParam(z.string().min(1).max(60), req.params.key);
  const schema = schemaFor(key);
  if (!schema) throw new HttpError(422, "unknown_flag", "No such flag");
  const value = schema.safeParse((req.body as z.infer<typeof flagBody>).value);
  if (!value.success) throw new HttpError(422, "invalid_body", "That value is not valid for this flag", value.error.issues);
  res.json(await setFlag(key, value.data, currentUser(req).id));
});

/** Operations at a glance: SLO windows, the latest queue gauges, the last audit rows. No user data. */
adminRouter.get("/info", async (_req, res) => {
  const [flags, hour, day, lag, audit] = await Promise.all([
    getFlags(),
    sloWindow(db(), 60),
    sloWindow(db(), 24 * 60),
    db()
      .selectDistinctOn([metricsMinute.name, metricsMinute.label], { name: metricsMinute.name, label: metricsMinute.label, value: metricsMinute.value, minute: metricsMinute.minute })
      .from(metricsMinute)
      .where(sql`${metricsMinute.name} in ('queue_waiting','queue_failed','queue_lag_s','invariant_violations') and ${metricsMinute.minute} > now() - interval '15 minutes'`)
      .orderBy(metricsMinute.name, metricsMinute.label, desc(metricsMinute.minute)),
    db().select().from(opsAudit).orderBy(desc(opsAudit.at)).limit(20),
  ]);
  res.json({
    approvalsFrozen: flags.approvalsFrozen,
    slos: Object.entries(SLOS).map(([id, s]) => ({ id, target: s.target, what: s.what, lastHour: hour[id], last24h: day[id] })),
    gauges: lag,
    audit,
  });
});

const companyId = z.uuid();
const companyColumns = { id: companies.id, name: companies.name, ats: companies.ats, boardToken: companies.boardToken, active: companies.active, lastPolledAt: companies.lastPolledAt };

/** Companies, inactive first: an imported board waits here until the owner activates it. */
adminRouter.get("/companies", async (req, res) => {
  const active = req.query.active === undefined ? undefined : req.query.active === "true";
  const rows = await db()
    .select(companyColumns)
    .from(companies)
    .where(active === undefined ? undefined : eq(companies.active, active))
    .orderBy(companies.active, companies.name)
    .limit(200);
  res.json({ companies: rows });
});

async function setActive(id: string, active: boolean, actor: string) {
  return db().transaction(async (tx) => {
    const [before] = await tx.select(companyColumns).from(companies).where(eq(companies.id, id)).for("update");
    if (!before) throw notFound("Company");
    if (before.active === active) return { ...before, changed: false };
    await tx.update(companies).set({ active }).where(eq(companies.id, id));
    await tx.insert(opsAudit).values({
      actor,
      action: active ? "company_activate" : "company_deactivate",
      target: `company:${id}`,
      before: { active: before.active },
      after: { active },
    });
    return { ...before, active, changed: true };
  });
}

adminRouter.post("/companies/:id/activate", async (req, res) => {
  res.json(await setActive(parseParam(companyId, req.params.id), true, currentUser(req).id));
});

adminRouter.post("/companies/:id/deactivate", async (req, res) => {
  res.json(await setActive(parseParam(companyId, req.params.id), false, currentUser(req).id));
});
