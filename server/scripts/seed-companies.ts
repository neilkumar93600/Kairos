import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { closeDb, db, type Db } from "../src/db/client";
import { companies, opsAudit } from "../src/db/schema";

/**
 * Seeds the polled companies from a file the owner supplies (database-v10, matching-30; owner-actions/WP-23.md):
 *
 *   npm run db:seed -- path/to/companies.json
 *
 * The file is a JSON array of { ats, boardToken, name, region?, careersUrl?, domains?, priority? }. Domains let a pasted
 * gh_jid link on that employer's site resolve to this board. Safe to rerun: an existing row keeps its state, except
 * that a board waiting as import_pending becomes active, because being on the owner's list is the activation, and is
 * audited like one. A company the owner stopped or that 404'd stays inactive. First polls spread over 30 minutes, so the seed does not burst.
 */

const domain = z.string().regex(/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/, "a lower-case host name");

export const seedRow = z
  .object({
    ats: z.enum(["greenhouse", "lever", "ashby"]),
    boardToken: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
    name: z.string().trim().min(1).max(200),
    region: z.enum(["us", "eu"]).default("us"),
    careersUrl: z
      .string()
      .url()
      .refine((u) => u.startsWith("https://"), "https only")
      .nullable()
      .default(null),
    domains: z.array(domain).max(20).default([]),
    priority: z.boolean().default(false),
  })
  .refine((c) => c.region === "us" || c.ats === "lever", "only Lever has an EU region");
export type SeedRow = z.infer<typeof seedRow>;

/** Every problem in the file at once, by array index, with nothing written: the list is long and fixing it once is the point. */
export function parseSeedFile(text: string): SeedRow[] {
  const parsed = z.array(seedRow).safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
  const seen = new Set<string>();
  for (const row of parsed.data) {
    const key = `${row.ats}/${row.boardToken}`;
    if (seen.has(key)) throw new Error(`${key} is listed twice`);
    seen.add(key);
  }
  return parsed.data;
}

const CHUNK = 500;
const SPREAD_SECONDS = 30 * 60;

/**
 * All or nothing, in one transaction. Activating a pasted board starts model spend on it, so each one gets the ops_audit
 * row the admin route writes (CISO mustFix 3, Security round 1), under actor system:seed.
 */
export async function seedCompanies(database: Db, rows: SeedRow[], rand: () => number = Math.random): Promise<number> {
  return database.transaction(async (tx) => {
    const listed = new Set(rows.map((r) => `${r.ats}/${r.boardToken}`));
    const pending = await tx
      .select({ id: companies.id, ats: companies.ats, boardToken: companies.boardToken })
      .from(companies)
      .where(eq(companies.inactiveReason, "import_pending"))
      .for("update");
    let written = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const result = await tx
        .insert(companies)
        .values(
          rows.slice(i, i + CHUNK).map((r) => ({
            ats: r.ats,
            boardToken: r.boardToken,
            name: r.name,
            apiRegion: r.region,
            careersUrl: r.careersUrl,
            domains: r.domains,
            priority: r.priority,
            discoveredBy: "seed" as const,
            nextPollAt: new Date(Date.now() + rand() * SPREAD_SECONDS * 1000),
          })),
        )
        .onConflictDoUpdate({
          target: [companies.ats, companies.boardToken],
          set: {
            name: sql`excluded.name`,
            careersUrl: sql`excluded.careers_url`,
            domains: sql`excluded.domains`,
            priority: sql`excluded.priority`,
            apiRegion: sql`excluded.api_region`,
            // The owner's list activates a pasted board, with the ETag its close-only polls stored forgotten.
            active: sql`case when ${companies.inactiveReason} = 'import_pending' then true else ${companies.active} end`,
            etag: sql`case when ${companies.inactiveReason} = 'import_pending' then null else ${companies.etag} end`,
            nextPollAt: sql`case when ${companies.inactiveReason} = 'import_pending' then excluded.next_poll_at else ${companies.nextPollAt} end`,
            discoveredBy: sql`case when ${companies.inactiveReason} = 'import_pending' then 'seed' else ${companies.discoveredBy} end`,
            inactiveReason: sql`case when ${companies.inactiveReason} = 'import_pending' then null else ${companies.inactiveReason} end`,
          },
        })
        .returning({ id: companies.id });
      written += result.length;
    }
    const activated = pending.filter((c) => listed.has(`${c.ats}/${c.boardToken}`));
    if (activated.length) {
      await tx.insert(opsAudit).values(
        activated.map((c) => ({
          actor: "system:seed",
          action: "company_activate",
          target: `company:${c.id}`,
          before: { active: false, inactiveReason: "import_pending" },
          after: { active: true, inactiveReason: null },
        })),
      );
    }
    return written;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: npm run db:seed -- path/to/companies.json");
    process.exit(2);
  }
  const rows = parseSeedFile(readFileSync(file, "utf8"));
  const written = await seedCompanies(db(), rows);
  console.log(`${written} companies written`);
  await closeDb();
}
