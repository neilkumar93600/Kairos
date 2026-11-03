# Keys runbook: DATA_KEKS, the emergency kit and rotation

`DATA_KEKS` encrypts the personal text Kairos stores but never searches: resume sources, inbound reply bodies and previews, the profile's sensitive answers and the contact email of a pending deletion (02-database 3.3). Two facts drive everything below:

- **Losing it loses that data.** Railway seals the variable, so it cannot be read back. The emergency kit is the only other copy. Without both, the encrypted columns are unrecoverable and users must re-import (06-infrastructure I7).
- **Leaking it exposes that data**, in the live database and in every backup taken before re-encryption finishes (T15).

Code: `server/src/lib/crypto.ts`. Drill tool: `server/scripts/data-keys.ts`. Owner decisions: `docs/superpowers/plans/2026-10-30-backend-completion/owner-actions/WP-18.md`.

## 1. Formats

**The variable.** A comma list of `v<n>:<base64 of 32 random bytes>`, for example `v2:<44 characters>,v1:<44 characters>`. The first entry encrypts; every entry decrypts. `n` is 1 to 255. Never reuse a version number or a key, even after a version is retired. The api and the worker refuse to boot when the value is malformed, short, repeats a version or a key, or is a placeholder; the error names the entry by position (`DATA_KEKS: entry 2 is not v<version>:<base64 of 32 bytes>`) and never prints the value. Until WP-12 adds the first encrypted column the variable is optional, and `encrypt` and `decrypt` throw `DATA_KEKS is not set`.

**The stored value (envelope).** AES-256-GCM with a fresh random 12-byte iv per write:

| Bytes | Content |
|---|---|
| 0 | Format, `0x01` |
| 1 | Key version (the `n` of `v<n>`) |
| 2 to 13 | iv |
| 14 to length-17 | Ciphertext (same length as the plaintext) |
| last 16 | GCM tag |

Columns are `bytea`. A text column, if one is ever needed, stores the base64 of the same bytes; `decrypt` takes either. Two differences from the specs, settled here: 02-database 3.3 has no format byte, so its shape check becomes `octet_length(col) >= 30 AND get_byte(col, 0) = 1`; and the dotted text form `k<version>.<nonce>.<ciphertext>.<tag>` of 06-infrastructure 7.7 is replaced by base64 of these bytes.

**The AAD** is `<table>:<row id>:<column>`, with the logical column name: `resume_profiles:<id>:source_text` for the column `source_text_enc` (02-database 7.1.3). A value copied to another row, column or table does not decrypt. The row id must exist before encrypting (the inbound ingest picks its own uuidv7 first). Moving a value to a new row means decrypt and encrypt again.

**Who holds it.** The api and the worker of each environment, as a sealed Railway variable with the same value on both. Never the applier (it refuses to boot in production with it), `pgbackup`, Grafana, CI, Vercel or a laptop `.env` with a production value. Production, staging and every developer machine each have their own keys.

## 2. Key register

Fingerprints are not secret: `scripts/data-keys.ts check` prints them, and they identify a key without revealing it. Update this table in the same sitting as any key change.

| Environment | Version | Created | Fingerprint | Status |
|---|---|---|---|---|
| production | v1 | | | |
| staging | v1 | | | |

Status is `current`, `decrypt-only` (staged or waiting to retire) or `retired <date>`.

## 3. The emergency kit

The kit holds the secrets that cannot be re-created (06-infrastructure 4.5):

1. `DATA_KEKS` for production: the full current value (every version not yet retired), with each version's fingerprint.
2. `DATA_KEKS` for staging. Optional: staging data can be re-created.
3. The two backup `age` private keys (the owner's and the recovery key behind `BACKUP_AGE_RECIPIENTS`), each with its public key. They decrypt every database dump in R2; no service ever holds them. How to make and check them: section 8.
4. Recovery codes: the password manager, the domain registrar, GitHub, Railway, Cloudflare, Stripe and the mailbox the accounts reset to.
5. A one-page note for the second person: what Kairos is, that this envelope must stay sealed unless the owner is unreachable, and who to call (see owner-actions/WP-18.md).

It lives in two places:

- **Primary:** a password-manager item named `Kairos emergency kit`.
- **Offline copy:** the same sheet printed and sealed in a tamper-evident envelope (or an encrypted USB stick whose passphrase is kept apart from it) at a second location. The second person chosen in owner-actions/WP-18.md can reach this copy, and nothing else.

Never put any of it in the repository, chat, email, a ticket, a screenshot or a cloud drive outside the password manager. Update both copies in the same sitting as any key change, then run drill step 2 against the offline copy.

Kit sheet:

```
KAIROS EMERGENCY KIT                         written <date>   last drill <date>
If you are not the owner: keep this sealed unless the owner is unreachable. Then read docs/runbook/keys.md, section 6.

DATA_KEKS production   v<n>:<base64>[,v<n-1>:<base64>]
  fingerprints         v<n> <16 hex>   v<n-1> <16 hex>
DATA_KEKS staging      v<n>:<base64>
  fingerprints         v<n> <16 hex>
Backup age keys        owner:    AGE-SECRET-KEY-1...    public age1...
                       recovery: AGE-SECRET-KEY-1...    public age1...
Recovery codes         password manager, registrar, GitHub, Railway, Cloudflare, Stripe, mailbox
```

## 4. First key (once per environment)

In Git Bash, from `server/` on a branch that has `scripts/data-keys.ts`:

1. `printf 'v1:%s' "$(openssl rand -base64 32)" | clip` puts a new value on the clipboard without showing it. Paste it at once into the password manager item (step 1 of the kit).
2. `read -rs DATA_KEKS && export DATA_KEKS`, paste, Enter. Then `npx tsx scripts/data-keys.ts check`. Expected: `v1 <16 hex> current`. Write the fingerprint into section 2 and onto the kit sheet.
3. Railway, for the environment: set `DATA_KEKS` as a sealed variable on the api service and on the worker service, pasting the same value. Do not use a shared variable group that could reach the applier. Redeploy both. A damaged paste shows in the deploy log as `Invalid environment: DATA_KEKS: entry 1 ...`; paste again.
4. Print the kit sheet and update the offline copy.
5. Run the drill (section 6) against the offline copy.
6. `unset DATA_KEKS`, clear the clipboard (copy any other text) and close the terminal.

## 5. Rotation

### 5.1 Routine, yearly

Two deploys, so no reader ever meets a version it lacks: the api and the worker redeploy separately, and a value written under the new key by one must be readable by the other at once.

1. **New key into the kit first.** Generate `v<n+1>` as in section 4 step 1 (the next unused number), check its fingerprint, and update the password manager, the offline copy and section 2 (`decrypt-only`). A key must be in the kit before anything is encrypted under it.
2. **Stage it, decrypt-only.** On the api and the worker set `DATA_KEKS=<current value>,v<n+1>:<new key>` (appended, so `v<n>` still encrypts). Redeploy both.
3. **Make it current.** On both set `DATA_KEKS=v<n+1>:<new key>,<old entries>`. Redeploy both. New writes now use `v<n+1>`. Mark it `current` and `v<n>` `decrypt-only` in section 2.
4. **Re-encrypt old rows.** Count what is left, per encrypted column:

   ```sql
   select 'resume_profiles.source_text' as col, get_byte(source_text_enc, 1) as key_version, count(*) from resume_profiles where source_text_enc is not null group by 2
   union all select 'profiles.sensitive_answers', get_byte(sensitive_answers_enc, 1), count(*) from profiles where sensitive_answers_enc is not null group by 2
   union all select 'inbound_emails.text_body', get_byte(text_body_enc, 1), count(*) from inbound_emails where text_body_enc is not null group by 2
   union all select 'inbound_emails.preview', get_byte(preview_enc, 1), count(*) from inbound_emails where preview_enc is not null group by 2
   union all select 'deletion_tasks.contact_email', get_byte(contact_email_enc, 1), count(*) from deletion_tasks where contact_email_enc is not null group by 2;
   ```

   Run only the lines for columns that exist yet. The re-encryption backfill (`backfill:rotate_keys`, built with the first encrypted column) selects rows where `get_byte(col, 1) <> <current version>` in batches of 500 (02-database 14.4), calls `rotate()` from `lib/crypto.ts` with each row's AAD, and writes back only where the column still holds the old value. Repeat the count until the old version shows no rows.
5. **Retire.** 30 days after the count first showed no rows under `v<n>`, no restorable backup still holds it (PITR keeps about 28 days, full dumps 28). Then remove the `v<n>` entry on both services (one redeploy each), destroy it in both kit copies and mark it `retired <date>`. If you keep a dump longer than 28 days on purpose, keep the kit copy of `v<n>` until that dump is deleted.
6. Run the drill (section 6).

### 5.2 Compromise: the key may have leaked

`DATA_KEKS` is the first secret rotated in R-SEC-1 (06-infrastructure section 10).

1. Do 5.1 steps 1 to 3 now. Keep the staging deploy: it takes minutes, and failing reads in the middle of an incident make a second incident.
2. Run the re-encryption at once, not lazily, and watch the count to zero.
3. Treat every backup taken before step 2 finished as readable by whoever holds the old key, and count it in the breach assessment (R-PRIV-1, 06-infrastructure 8.9). Backups are also `age`-encrypted and held in a separate account, which narrows but does not remove that exposure.
4. Remove the leaked version from Railway once the count is zero. Keep its kit copy only until no backup older than that day remains (about 30 days), so a restore stays possible, then destroy it.
5. Continue with R-SEC-1 steps 2 to 5: preserve evidence, find where it leaked, close the cause.

### 5.3 A kit copy that turns out to be wrong

Railway cannot show a sealed value, so a wrong kit copy cannot be repaired by reading production. Rotate away from the unknown key instead: 5.1 with a new key written carefully into the kit (and checked by the drill before step 2), re-encrypt everything, then retire the old version. Until the count reaches zero the data under the old version depends on Railway alone.

## 6. Lost-key drill

When: before the first encrypted column ships (WP-12), after every rotation, and yearly (the secret-loss tabletop of 06-infrastructure 5.7). The scenario: Railway's variables are gone and only the kit is left.

1. Take the offline copy. Alternate with the password-manager copy each year, so both get tested.
2. In Git Bash from `server/`: `read -rs DATA_KEKS && export DATA_KEKS`, type or paste the production value from the kit, Enter. Run `npx tsx scripts/data-keys.ts check`. **Pass:** the same versions and fingerprints as section 2, and the same version marked `current`. A typo shows as `failed: entry N ...` or a different fingerprint.
3. Once an encrypted column holds data, prove the copy is the production key and not just a well-formed one. In the Railway Postgres query tab:

   ```sql
   select id, encode(source_text_enc, 'base64') from resume_profiles where source_text_enc is not null order by random() limit 1;
   ```

   Then `npx tsx scripts/data-keys.ts open resume_profiles <id> source_text <base64>`. **Pass:** `ok: key v<n>, <length> bytes`. The tool never prints the plaintext. Repeat for one row of each other encrypted column (logical column names: `sensitive_answers`, `text_body`, `preview`, `contact_email`).
4. Record the date, the copy used, the results and the time taken in section 7.
5. `unset DATA_KEKS`, close the terminal, reseal the offline copy (a new envelope, dated and signed across the flap).

A failed step 2 or 3 means the kit is wrong: fix it the same day (5.3).

**A real loss.** Restore the database by the restore runbooks ([R-DR-1](R-DR-1.md), [R-DR-2](R-DR-2.md)), set `DATA_KEKS` from the kit on the new api and worker, deploy, and run step 3 against the restored data. If the kit is lost too, the encrypted columns cannot be read by anyone. Null them, tell affected users which data is gone (resume sources must be re-imported; reply bodies and sensitive answers are lost), and generate a new key (section 4).

## 7. Drill log

| Date | Copy | check | open | Time | By |
|---|---|---|---|---|---|
| | | | | | |

## 8. The backup age keys

The pgbackup service encrypts each dump to the public keys in `BACKUP_AGE_RECIPIENTS` (two: the owner's and the recovery key) and holds no private key; it refuses to start if a private key is pasted there. Either private key alone decrypts a dump. Losing both makes every dump unreadable (PITR still works); leaking one exposes the dumps still in R2 (at most 28 days of them) to whoever also holds the backups bucket token.

**Make them** (once per environment; staging and production have their own pair). In Git Bash from `server/`:

1. `npx tsx scripts/backup.ts keygen | clip`. The private key goes to the clipboard; the public key (`age1...`) is printed. Paste the private key into the password-manager item `Kairos emergency kit` at once, with the public key beside it.
2. Repeat for the recovery key.
3. Set `BACKUP_AGE_RECIPIENTS` on the `pgbackup` service to the two public keys, comma separated. Public keys are not secret, but keep the variable on that service only.
4. Print the kit sheet with both private keys and reseal the offline copy (section 3).
5. Clear the clipboard and close the terminal.

**Check a kit copy** (part of the drill, section 6, once WP-13 is deployed): `read -rs AGE_IDENTITY && export AGE_IDENTITY`, paste the private key from the copy, `npx tsx scripts/backup.ts recipient`. Pass: it prints a public key listed in `BACKUP_AGE_RECIPIENTS` and in the latest manifest's `recipients`. The real proof is the monthly restore drill ([R-DR-2](R-DR-2.md) section 7), which decrypts last night's dump with it. `unset AGE_IDENTITY` afterwards.

**Rotate** (yearly, or at once if one may have leaked): make a new pair, put both in the kit, set `BACKUP_AGE_RECIPIENTS` to the new public keys and trigger a pgbackup run. Keep the old private keys in the kit until the last dump encrypted to them has expired (28 days after the switch), then destroy them. A leaked key: also assume the dumps encrypted to it are readable by whoever has the R2 backups token, and count them in the breach assessment (section 5.2 step 3).

## 9. LINK_SIGNING_KEY (signed email links)

`LINK_SIGNING_KEY` signs the links Kairos emails: resend, offer-pause undo, unsubscribe and the extension's resume PDF (`server/src/lib/action-tokens.ts`, WP-44). Same format as `DATA_KEKS`, `v<n>:<base64 of 32 random bytes>` entries, comma-separated; the first signs and every entry verifies. It must be a key of its own: the api and worker refuse to boot when it repeats a `DATA_KEKS` key. Losing it loses nothing but the links already mailed; leaking it lets anyone forge a link, though the single-use links still need their `action_tokens` row, so a forger can mint only stateless resume-PDF links. Sealed on the api and the worker, never the applier. No emergency kit copy is needed.

**First key.** `openssl rand -base64 32`, set `v1:<value>` on the api and the worker of the environment, redeploy both.

**Routine rotation, yearly.** Prepend a new version on both services (`v2:<new>,v1:<old>`) and redeploy both. Remove `v1` 91 days later: the longest link (unsubscribe) lives 90 days. Links signed under `v1` stop working at once when it is removed.

**Compromise.** Replace the whole value with a single new version (`v2:<new>`) on both services and redeploy. Every link mailed so far answers "This link has expired"; users act from the app instead. The outstanding `action_tokens` rows can no longer be presented and age out with the daily retention.
