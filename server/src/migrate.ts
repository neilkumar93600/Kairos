import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, db } from "./db/client";
import { logger } from "./lib/logger";

/** Applies SQL migrations from ./drizzle. Railway runs it as the api's pre-deploy command. */
await migrate(db(), { migrationsFolder: process.env.MIGRATIONS_DIR ?? "./drizzle" });
logger.info("migrations applied");
await closeDb();
