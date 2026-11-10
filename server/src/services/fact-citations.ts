import { and, eq, exists, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../db/client";
import { applications, facts, resumes } from "../db/schema";

/**
 * A confirmed fact that an application or the base resume cites (database-v09): it must stay, so a sent application never
 * points at a fact that no longer exists. Use as a `where` on `facts`.
 * ponytail: a citation is the id as a JSON string anywhere in resume_lines or the document (fact ids are uuids, nothing
 * else stores one); a scan over the user's rows, fine at hundreds of applications. A jsonb index joins with DB rev 2.
 */
export function citedFact(userId: string) {
  const cites = (doc: AnyPgColumn) => sql`position('"' || ${facts.id}::text || '"' in ${doc}::text) > 0`;
  return and(
    eq(facts.confirmed, true),
    or(
      exists(db().select({ one: sql`1` }).from(applications).where(and(eq(applications.userId, userId), cites(applications.resumeLines)))),
      exists(db().select({ one: sql`1` }).from(resumes).where(and(eq(resumes.userId, userId), cites(resumes.document)))),
    ),
  )!;
}
