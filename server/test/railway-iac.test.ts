import { readFileSync } from "node:fs";
import { createRailwayContext, project, type ProjectDefinition, type ResourceNode, type ServiceNode, type VariableValue } from "railway/iac";
import { describe, expect, it } from "vitest";
import program from "../../.railway/railway";
import limits from "../../ops/railway-limits.json";
import { APPLIER_FORBIDDEN, ENV_KEYS } from "../src/lib/env";

// WP-15: .railway/railway.ts is the only deploy config Railway gets (Config as Code stops being read on 2026-12-01).
// Nothing compiles it against Railway until an apply, so the rules it must keep are checked here: sizes equal to
// ops/railway-limits.json, the deploy settings of 06-infrastructure 1.6, and who holds which secret.

const ENVIRONMENTS = ["production", "staging"] as const;
const NAMES = Object.keys(limits.services) as (keyof typeof limits.services)[];
/** Literal values allowed in the file; everything else is preserve() (set by hand, sealed) or a reference. */
const LITERALS = ["PORT", "NODE_OPTIONS", "LLM_GATEWAY", "RAILWAY_SHM_SIZE_BYTES"];

async function resources(environment: string, projectName = "kairos"): Promise<ResourceNode[]> {
  const def: ProjectDefinition = await program(createRailwayContext({ environment, projectName }), project);
  return (def.resources ?? []).flat();
}
async function services(environment: string) {
  const list = (await resources(environment)).filter((r): r is ServiceNode => r.type === "service");
  return Object.fromEntries(list.map((s) => [s.name, s])) as Record<string, ServiceNode>;
}
const vars = (s: ServiceNode) => (s.variables ?? {}) as Record<string, VariableValue>;

describe(".railway/railway.ts", () => {
  for (const environment of ENVIRONMENTS) {
    it(`${environment}: every service matches ops/railway-limits.json and 06-infrastructure 1.6`, async () => {
      const all = await services(environment);
      expect(Object.keys(all).sort()).toEqual([...NAMES].sort());
      for (const name of NAMES) {
        const want = limits.services[name];
        const deploy = all[name]!.deploy!;
        expect(deploy.multiRegionConfig?.[limits.region]?.numReplicas, name).toBe(want.replicas[environment]);
        expect(deploy.limitOverride?.containers, name).toEqual({ cpu: want.vcpu, memoryBytes: want.memoryGB * 1024 ** 3 });
        expect(deploy, name).toMatchObject({
          startCommand: `node dist/${name}.js`,
          healthcheckPath: "/health",
          healthcheckTimeout: want.healthcheckTimeout,
          restartPolicyType: want.restart,
          drainingSeconds: want.drainingSeconds,
          overlapSeconds: want.overlapSeconds,
        });
        expect(vars(all[name]!).NODE_OPTIONS, name).toEqual({ type: "literal", value: `--enable-source-maps --max-old-space-size=${want.heapMB}` });
      }
    });
  }

  it("lists the databases, so an apply never deletes them", async () => {
    const names = (await resources("production")).filter((r) => r.type === "database").map((r) => r.name);
    expect(names.sort()).toEqual(["Postgres", "Redis"]);
  });

  it("drains outlast each process's shutdown deadline by at least 10 s, and heaps fit the memory limit", () => {
    for (const name of NAMES) {
      const deadline = readFileSync(new URL(`../src/${name}.ts`, import.meta.url), "utf8").match(/onShutdown\("\w+", ([\d_]+)/)?.[1];
      expect(deadline, `onShutdown deadline in src/${name}.ts`).toBeDefined();
      expect(limits.services[name].drainingSeconds * 1000, name).toBeGreaterThanOrEqual(Number(deadline!.replaceAll("_", "")) + 10_000);
      expect(limits.services[name].heapMB, name).toBeLessThanOrEqual(limits.services[name].memoryGB * 1024 * 0.75);
    }
  });

  it("only the api migrates, before it deploys", async () => {
    const all = await services("production");
    expect(all.api!.deploy!.preDeployCommand).toEqual(["node dist/migrate.js"]);
    expect(all.worker!.deploy!.preDeployCommand).toBeUndefined();
    expect(all.applier!.deploy!.preDeployCommand).toBeUndefined();
  });

  it("production deploys only the release branch; staging deploys main after its checks", async () => {
    for (const [environment, branch, checkSuites] of [["production", "release", false], ["staging", "main", true]] as const) {
      for (const s of Object.values(await services(environment))) expect(s.source, s.name).toMatchObject({ type: "github", branch, checkSuites });
    }
  });

  it("holds no secret value, and every secret sits only on the service that needs it", async () => {
    const all = await services("production");
    const holders = (key: string) => NAMES.filter((n) => key in vars(all[n]!));
    for (const name of NAMES) {
      for (const [key, value] of Object.entries(vars(all[name]!))) {
        if (value.type === "literal") expect(LITERALS, `${name}.${key} is a literal`).toContain(key);
        // A typo here would set a variable no process reads.
        expect([...ENV_KEYS.all, ...LITERALS, "DATABASE_UNPOOLED_URL"], `${name}.${key}`).toContain(key);
      }
    }
    const applier = Object.keys(vars(all.applier!));
    expect(applier.filter((k) => (APPLIER_FORBIDDEN as readonly string[]).includes(k))).toEqual([]);
    expect(applier.filter((k) => !ENV_KEYS.applier.includes(k) && !LITERALS.includes(k))).toEqual([]);
    for (const key of ["DATABASE_UNPOOLED_URL", "KAIROS_EDGE_SECRET", "GOOGLE_CLIENT_SECRET"]) expect(holders(key), key).toEqual(["api"]);
    for (const key of ["ANTHROPIC_KEY_BATCH", "R2_BACKUPS_ACCESS_KEY_ID", "R2_BACKUPS_SECRET_ACCESS_KEY"]) expect(holders(key), key).toEqual(["worker"]);
  });

  it("refuses any other environment or project, since an apply deletes what the file leaves out", async () => {
    await expect(resources("pr-12")).rejects.toThrow(/production" and "staging/);
    await expect(resources("production", "kairos-sd1-staging")).rejects.toThrow(/project "kairos"/);
  });
});
