# R-PG-4: Connection exhaustion

Triggers: Postgres refuses connections with `too many connections` (`53300`), or requests stall waiting for a pooled connection (A-PG-8). Last rehearsed: never.

## Symptoms

- Errors with code `53300` or `57P03` in the logs and in Sentry.
- Slow responses, health checks timing out after 3 seconds, and heartbeats dropping.

## Impact

Like [R-PG-1](R-PG-1.md), but partial: some requests and jobs succeed, others time out.

## Check

Run as the superuser:

```sql
-- Who holds the connections: role, client and state.
select usename, application_name, client_addr, state, count(*)
  from pg_stat_activity where datname = current_database()
 group by 1, 2, 3, 4 order by 5 desc;
-- Sessions stuck inside a transaction, which a leak or a hung request leaves behind.
select pid, usename, state, now() - xact_start as open_for, left(query, 60) as query
  from pg_stat_activity where state like 'idle in transaction%' order by open_for desc;
show max_connections;
```

Each process opens its own pool (`server/src/db/client.ts`), so the most connections in use is the pool size times the replicas, plus the migrations and your own sessions. More replicas than the budget allows (the 05-api and 02-database connection table) will exhaust the server.

## Fix

1. End the sessions that have been idle in a transaction for over a minute. Write the reason in the incident note first:
   `select pg_terminate_backend(pid) from pg_stat_activity where state like 'idle in transaction%' and now() - xact_start > interval '1 minute';`
2. If one service holds most of the connections, restart that service: a leaked pool is released.
3. Bring the replica count back within the budget, or raise `max_connections` (this needs a Postgres restart, and memory to match).
4. Find the cause: a code path that opens a transaction and awaits something slow (a Stripe or model call) inside it, or a loop without a pool. Fix it, with a test.

## Verify

The `count(*)` per role is back under the budget, there are no `53300` errors for 15 minutes, and every `/health` is green.

## Escalate

If exhaustion keeps coming back under legitimate load, that is the PgBouncer trigger in 06-infrastructure 1.7; raise it with the WP-12 and WP-28 owners.
