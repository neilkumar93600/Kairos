import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WP-01 policy tests (CISO supply-chain item; 06-infrastructure 3.2): the pins and install rules live in files that
// no compiler checks, so a regression would otherwise be silent until an incident. Each assertion names the file and
// the line it rejects, so a failure says what to fix.
const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const lines = (path: string) => read(path).split(/\r?\n/);

/** Files in a directory, relative to the repo root. */
const workflows = readdirSync(new URL(".github/workflows/", ROOT)).filter((f) => /\.ya?ml$/.test(f));

describe("exact dependency pins", () => {
  // web/ and extension/ are out of scope for WP-01 (frontend handoff); server and shared are ours.
  for (const pkg of ["server/package.json", "shared/package.json"]) {
    it(`${pkg} has no range specifiers`, () => {
      const json = JSON.parse(read(pkg)) as Record<string, Record<string, string> | undefined>;
      const ranges: string[] = [];
      for (const group of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
        for (const [name, spec] of Object.entries(json[group] ?? {})) {
          // "*" is the npm workspace link to a sibling package, not a registry range.
          if (spec === "*" && name.startsWith("@auto-career/")) continue;
          if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(spec)) ranges.push(`${group}.${name}: ${spec}`);
        }
      }
      expect(ranges).toEqual([]);
    });
  }

  it(".npmrc makes npm save exact versions", () => {
    expect(lines(".npmrc")).toContain("save-exact=true");
  });
});

describe("Dockerfiles", () => {
  const files = ["server/Dockerfile", "server/Dockerfile.applier"];

  for (const file of files) {
    it(`${file} pins every base image by digest`, () => {
      const froms = lines(file).filter((l) => /^FROM\s/.test(l));
      expect(froms.length).toBeGreaterThan(0);
      for (const from of froms) {
        // FROM <stage> AS <name> reuses an earlier stage and has no registry reference.
        const ref = from.split(/\s+/)[1]!;
        if (/^(base|build|prod-deps)$/.test(ref)) continue;
        expect(from, `${file}: ${from}`).toMatch(/@sha256:[0-9a-f]{64}/);
      }
    });

    it(`${file} installs with --ignore-scripts and rebuilds only esbuild`, () => {
      const installs = lines(file).filter((l) => /\bnpm ci\b/.test(l));
      expect(installs.length).toBeGreaterThan(0);
      for (const line of installs) expect(line, `${file}: ${line}`).toContain("--ignore-scripts");
      // The build stage needs esbuild's binary; nothing else is allowed to run lifecycle scripts.
      expect(read(file)).toMatch(/npm rebuild esbuild/);
    });

    it(`${file} runs under tini as PID 1`, () => {
      const text = read(file);
      expect(text).toMatch(/apt-get install[^\n]*\btini\b/);
      expect(text).toMatch(/ENTRYPOINT \["\/usr\/bin\/tini", "--"\]/);
    });

    it(`${file} copies .npmrc so the container installs with the repo's npm settings`, () => {
      expect(read(file)).toMatch(/COPY[^\n]*\.npmrc/);
    });
  }
});

describe("GitHub workflows", () => {
  for (const file of workflows) {
    const path = `.github/workflows/${file}`;

    it(`${file} pins every action by commit SHA`, () => {
      const unpinned = lines(path).filter((l) => /^\s*-?\s*uses:/.test(l) && !/uses:\s+\S+@[0-9a-f]{40}(\s|$)/.test(l));
      expect(unpinned).toEqual([]);
    });

    it(`${file} pins service and tool images by digest`, () => {
      // `image:` keys (service containers) and registry references in `docker run` steps.
      const unpinned = lines(path).filter((l) => (/^\s*image:\s/.test(l) || /\b(ghcr\.io|docker\.io|mcr\.microsoft\.com)\/\S+/.test(l)) && !/@sha256:[0-9a-f]{64}/.test(l));
      expect(unpinned).toEqual([]);
    });

    it(`${file} installs with --ignore-scripts`, () => {
      const bad = lines(path).filter((l) => /\bnpm (ci|install)\b/.test(l) && !l.includes("--ignore-scripts"));
      expect(bad).toEqual([]);
    });
  }

  const ci = () => read(".github/workflows/ci.yml");

  it("ci.yml runs the integration tests against a Postgres service, and refuses to skip them", () => {
    const text = ci();
    expect(text).toMatch(/services:\s*\n\s+postgres:/);
    expect(text).toContain("TEST_DATABASE_URL:");
    // test/helpers/test-db.ts turns a missing database into a failure when this is set.
    expect(text).toContain('REQUIRE_TEST_DB: "1"');
  });

  it("ci.yml has gitleaks and osv-scanner jobs on every pull request", () => {
    const text = ci();
    expect(text).toMatch(/\n {2}gitleaks:/);
    expect(text).toMatch(/\n {2}osv-scanner:/);
    expect(text).toMatch(/^on:\s*\n\s+push:[\s\S]*\n\s+pull_request:/m);
  });

  it("ci.yml has the frozen-extension check", () => {
    expect(ci()).toMatch(/\n {2}frozen-extension:/);
  });
});
