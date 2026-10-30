#!/usr/bin/env node
/**
 * Sign-in smoke test: sign up, verify the emailed code, sign in, GET /api/me, check the Google redirect, delete the user.
 * No dependencies; Node 20+.
 *
 * Local API (the api started with MAIL_SINK_FILE=<path>, so no mail is sent and the code is read from the file):
 *   SMOKE_BASE_URL=http://localhost:4000 SMOKE_WEB_ORIGIN=http://localhost:3000 SMOKE_MAIL_SINK=<path> node scripts/smoke.mjs
 * Staging through the Vercel domain (real mail: type the code when asked; +smoke-<time> is added to the address):
 *   SMOKE_BASE_URL=https://<vercel domain> SMOKE_EMAIL=<an inbox you can read> node scripts/smoke.mjs
 *
 * Every request carries x-kairos-probe: <id>. Search the api logs for that id to read the real proxy header chain (spike S-B1).
 */
import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
/** The origin the browser would send; Better Auth checks it against WEB_ORIGIN. Through Vercel it equals BASE. */
const WEB = process.env.SMOKE_WEB_ORIGIN ?? new URL(BASE).origin;
const SINK = process.env.SMOKE_MAIL_SINK;
const stamp = Date.now().toString(36);
const EMAIL = process.env.SMOKE_EMAIL ? process.env.SMOKE_EMAIL.replace("@", `+smoke-${stamp}@`) : `smoke-${stamp}@example.com`;
const PASSWORD = randomBytes(18).toString("base64url");
const PROBE = `smoke-${stamp}-${randomBytes(4).toString("hex")}`;

const jar = new Map();

async function call(method, path, body) {
  const headers = { origin: WEB, "x-kairos-probe": PROBE };
  if (body) headers["content-type"] = "application/json";
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

function check(step, ok, detail) {
  if (!ok) {
    console.error(`FAIL ${step}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    process.exit(1);
  }
  console.log(`${step} ok`);
}

async function verificationCode() {
  if (!SINK) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const code = (await rl.question(`Code sent to ${EMAIL}: `)).trim();
    rl.close();
    return code;
  }
  for (let i = 0; i < 50; i++) {
    if (existsSync(SINK)) {
      const mail = readFileSync(SINK, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const hit = mail.filter((m) => m.to === EMAIL && m.tag === "otp-email-verification").at(-1);
      const code = hit?.text.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no verification code for ${EMAIL} in ${SINK}`);
}

console.log(`smoke against ${BASE} (origin ${WEB}) as ${EMAIL}, probe id ${PROBE}`);

const providers = await call("GET", "/api/auth-providers");
check("GET /api/auth-providers", providers.status === 200 && providers.json?.providers?.includes("email"), providers.text);
console.log(`  providers: ${providers.json.providers.join(", ")}`);

const signUp = await call("POST", "/api/auth/sign-up/email", { email: EMAIL, password: PASSWORD, name: "Smoke Test" });
check("sign up", signUp.status === 200, signUp.text);

const verify = await call("POST", "/api/auth/email-otp/verify-email", { email: EMAIL, otp: await verificationCode() });
check("verify OTP", verify.status === 200, verify.text);

jar.clear();
const signIn = await call("POST", "/api/auth/sign-in/email", { email: EMAIL, password: PASSWORD });
check("sign in", signIn.status === 200 && [...jar.keys()].some((k) => k.endsWith("session_token")), signIn.text);

const me = await call("GET", "/api/me");
check("GET /api/me", me.status === 200 && me.json?.user?.email === EMAIL.toLowerCase(), me.text);

if (providers.json.providers.includes("google")) {
  const social = await call("POST", "/api/auth/sign-in/social", { provider: "google", callbackURL: "/dashboard", disableRedirect: true });
  const url = social.json?.url ? new URL(social.json.url) : null;
  const redirectUri = url?.searchParams.get("redirect_uri");
  check(
    "google redirect",
    url?.hostname === "accounts.google.com" && redirectUri === `${WEB}/api/auth/callback/google`,
    `redirect_uri ${redirectUri}, expected ${WEB}/api/auth/callback/google`,
  );
  console.log(`  finish the Google sign-in by hand in a browser at ${WEB}/login`);
} else {
  console.log("google not configured, skipped");
}

const removed = await call("POST", "/api/auth/delete-user", { password: PASSWORD });
check("delete smoke user", removed.status === 200, removed.text);

console.log(`smoke passed (probe id ${PROBE})`);
