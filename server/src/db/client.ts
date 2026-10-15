import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let sqlClient: postgres.Sql | undefined;
let database: Db | undefined;

export function db(): Db {
  if (!database) {
    sqlClient = postgres(env().DATABASE_URL, { max: 10, idle_timeout: 20, connect_timeout: 10 });
    database = drizzle(sqlClient, { schema, casing: "snake_case" });
  }
  return database;
}

export async function closeDb(): Promise<void> {
  await sqlClient?.end({ timeout: 5 });
  sqlClient = undefined;
  database = undefined;
}

export { schema };
