import tseslint from "typescript-eslint";

// Architecture boundaries only (06-infrastructure 3.2, B.2); style is left to the formatter and tsc.
// Parsing needs the TypeScript parser, nothing else from typescript-eslint is enabled.

const SDK_MESSAGE = "The Anthropic SDK is imported only under src/llm/ so every model call goes through the gateway (budget, redaction, fence, ledger).";
const LEDGER_MESSAGE = "credit_ledger is written only by services/credits.ts, so every credit change keeps the idempotency indexes and the in-flight rule.";

// Matches tx.insert(creditLedger), tx.insert(schema.creditLedger) and the same for update and delete.
const ledgerWrite = (argument) => `CallExpression[callee.property.name=/^(insert|update|delete)$/][arguments.0${argument}]`;

export default tseslint.config(
  { ignores: ["dist/**", "drizzle/**", "node_modules/**"] },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    // Registered without rules, only so existing `eslint-disable @typescript-eslint/...` comments resolve.
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      // The two rules existing `eslint-disable` comments in src refer to; any other use of them is a new violation.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-namespace": "error",
      "no-restricted-imports": ["error", { patterns: [{ group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"], message: SDK_MESSAGE }] }],
      "no-restricted-syntax": [
        "error",
        { selector: ledgerWrite(".name='creditLedger'"), message: LEDGER_MESSAGE },
        { selector: ledgerWrite(".property.name='creditLedger'"), message: LEDGER_MESSAGE },
        { selector: "TemplateElement[value.raw=/(insert\\s+into|update|delete\\s+from)\\s+.?credit_ledger/i]", message: LEDGER_MESSAGE },
      ],
    },
  },
  {
    // The only place that may import the SDK.
    files: ["src/llm/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // The only place that may write the ledger.
    files: ["src/services/credits.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  // ponytail: three files predate the rules. Each exception is a file-level off switch, so a new violation anywhere
  // else still fails. Remove them when the owning package moves the code: services/llm.ts (the legacy chatJson, to
  // llm/ in WP-07), lib/auth.ts (free grant) and routes/webhooks.ts (plan grant) to services/credits.ts (WP-02, WP-32).
  { files: ["src/services/llm.ts"], rules: { "no-restricted-imports": "off" } },
  { files: ["src/lib/auth.ts", "src/routes/webhooks.ts"], rules: { "no-restricted-syntax": "off" } },
);
