import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://auto_career:auto_career@localhost:5432/auto_career" },
  // drizzle-kit never touches the SQL-owned partitions (02-database 14.1). `drizzle-kit push` is forbidden against any
  // shared database: migrations go through src/migrate.ts only.
  schemaFilter: ["public"],
  tablesFilter: ["*", "!llm_calls_20*", "!llm_calls_default", "!matches_shadow"],
  strict: true,
  verbose: true,
});
