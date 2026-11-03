import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import { decrypt, parseKeks } from "../src/lib/crypto";

/**
 * The key-custody drill for DATA_KEKS (docs/runbook/keys.md). Reads the value from the DATA_KEKS variable, never from an
 * argument (shell history), and never prints a key or a plaintext.
 *   npx tsx scripts/data-keys.ts check
 *       parses it with the boot rules; one line per version with its fingerprint, to compare with the key register
 *   npx tsx scripts/data-keys.ts open <table> <id> <column> <base64 value>
 *       decrypts one stored value (SQL: encode(col, 'base64')) and prints only its key version and length
 */

/** HMAC-SHA256 of a fixed label under the key, 16 hex characters: names a key without revealing it. */
const fingerprint = (key: Buffer) => createHmac("sha256", key).update("kairos DATA_KEKS fingerprint").digest("hex").slice(0, 16);

export function check(raw: string): string {
  const keys = parseKeks(raw);
  return [...keys.byVersion].map(([v, key]) => `v${v} ${fingerprint(key)}${v === keys.current ? " current" : ""}`).join("\n");
}

export function open(raw: string, table: string, id: string, column: string, value: string): string {
  const plaintext = decrypt(value, { table, id, column }, parseKeks(raw));
  return `ok: key v${Buffer.from(value, "base64")[1]}, ${plaintext.length} bytes`;
}

function main([command, ...args]: string[]): number {
  const raw = process.env.DATA_KEKS;
  if (!raw) {
    console.error("DATA_KEKS is not set. In Git Bash: read -rs DATA_KEKS && export DATA_KEKS (paste, then Enter).");
    return 2;
  }
  try {
    if (command === "check") console.log(check(raw));
    else if (command === "open" && args.length === 4) console.log(open(raw, args[0]!, args[1]!, args[2]!, args[3]!));
    else {
      console.error("usage: data-keys.ts check | data-keys.ts open <table> <id> <column> <base64 value>");
      return 2;
    }
    return 0;
  } catch (err) {
    console.error(`failed: ${(err as Error).message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
