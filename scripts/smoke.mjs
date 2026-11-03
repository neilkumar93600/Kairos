#!/usr/bin/env node
/**
 * Sign-in smoke test: sign up, verify the emailed code, sign in, GET /api/me, check the Google redirect, delete the user.
 * No dependencies; Node 20+.
 *
 * Local API (the api started with MAIL_SINK_FILE=<path>, so no mail is sent and the code is read from the file):
 *   SMOKE_BASE_URL=http://localhost:4000 SMOKE_WEB_ORIGIN=http://localhost:3000 SMOKE_MAIL_SINK=<path> node scripts/smoke.mjs
 * Staging through the Vercel domain (real mail: type the code when asked; +smoke-<time> is added to the address):
 *   SMOKE_BASE_URL=https://<vercel domain> SMOKE_EMAIL=<an inbox you can read> node scripts/smoke.mjs
 * Staging gate (.github/workflows/staging-gate.yml): SMOKE_POSTMARK_TOKEN=<staging Postmark server token> reads the code
 * from Postmark's record of the sent message instead; SMOKE_VERCEL_BYPASS passes Vercel's deployment protection.
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
const POSTMARK = process.env.SMOKE_POSTMARK_TOKEN;
const BYPASS = process.env.SMOKE_VERCEL_BYPASS;
const stamp = Date.now().toString(36);
const EMAIL = process.env.SMOKE_EMAIL ? process.env.SMOKE_EMAIL.replace("@", `+smoke-${stamp}@`) : `smoke-${stamp}@example.com`;
const PASSWORD = randomBytes(18).toString("base64url");
const PROBE = `smoke-${stamp}-${randomBytes(4).toString("hex")}`;

const jar = new Map();

async function call(method, path, body) {
  const headers = { origin: WEB, "x-kairos-probe": PROBE };
  if (BYPASS) headers["x-vercel-protection-bypass"] = BYPASS;
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
  if (!ok) throw new Error(`FAIL ${step}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  console.log(`${step} ok`);
}

/** Best effort after a failed run: delete the smoke user (signing in again if needed) or name it for manual removal. */
async function cleanup() {
  try {
    let removed = await call("POST", "/api/auth/delete-user", { password: PASSWORD });
    if (removed.status !== 200) {
      jar.clear();
      await call("POST", "/api/auth/sign-in/email", { email: EMAIL, password: PASSWORD });
      removed = await call("POST", "/api/auth/delete-user", { password: PASSWORD });
    }
    if (removed.status !== 200) throw new Error(`${removed.status} ${removed.text}`);
    console.error(`cleanup: deleted ${EMAIL}`);
  } catch (err) {
    console.error(`cleanup failed, remove ${EMAIL} by hand: ${err.message}`);
  }
}

/** The code from Postmark's outbound record (a sandbox server records the message without delivering it). */
async function postmarkCode() {
  const pm = async (path) => {
    const res = await fetch(`https://api.postmarkapp.com${path}`, { headers: { accept: "application/json", "x-postmark-server-token": POSTMARK } });
    if (!res.ok) throw new Error(`Postmark ${path.split("?")[0]}: ${res.status}`);
    return res.json();
  };
  for (let i = 0; i < 30; i++) {
    const { Messages = [] } = await pm(`/messages/outbound?count=1&offset=0&tag=otp-email-verification&recipient=${encodeURIComponent(EMAIL)}`);
    if (Messages[0]) {
      const code = (await pm(`/messages/outbound/${Messages[0].MessageID}/details`)).TextBody?.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`no verification code for ${EMAIL} in Postmark`);
}

async function verificationCode() {
  if (!SINK && POSTMARK) return postmarkCode();
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

let created = false;
let deleted = false;
try {
  const providers = await call("GET", "/api/auth-providers");
  check("GET /api/auth-providers", providers.status === 200 && providers.json?.providers?.includes("email"), providers.text);
  console.log(`  providers: ${providers.json.providers.join(", ")}`);

  const signUp = await call("POST", "/api/auth/sign-up/email", { email: EMAIL, password: PASSWORD, name: "Smoke Test" });
  check("sign up", signUp.status === 200, signUp.text);
  created = true;

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
  deleted = true;

  console.log(`smoke passed (probe id ${PROBE})`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  if (created && !deleted) await cleanup();
}
