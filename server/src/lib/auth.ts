import type { AuthProvider } from "@auto-career/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer, emailOTP, oneTimeToken } from "better-auth/plugins";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { CLIENT_IP_HEADER } from "../middleware/client-ip";
import { hit } from "../middleware/rate-limit";
import { cancelBillingForDeletedUser } from "../services/billing-events";
import { bootstrapUser } from "../services/bootstrap";
import { emailHashIfKeyed, eraseUser, normalizeEmail, tombstoneStore } from "../services/erasure";
import { INLINE_REQUEST, stripe } from "../services/stripe";
import { env, type Env } from "./env";
import { logger, logUserHash } from "./logger";
import { sendEmail } from "./mailer";

const OTP_SUBJECTS = {
  "sign-in": "Your Kairos sign-in code",
  "email-verification": "Verify your email for Kairos",
  "forget-password": "Reset your Kairos password",
  "change-email": "Confirm your new email for Kairos",
} as const;

type EmailLimit = [bucket: string, max: number, windowMs: number];
/** Every path that mails a code shares one bucket per address: it protects the inbox, not the endpoint. */
const CODE_MAIL: EmailLimit[] = [["auth_otp_send_email", 3, 600_000]];
const EMAIL_LIMITS: Record<string, EmailLimit[]> = {
  "/sign-in/email": [["auth_signin_email", 5, 60_000], ["auth_signin_email_hour", 20, 3_600_000]],
  "/email-otp/send-verification-otp": CODE_MAIL,
  "/email-otp/request-password-reset": CODE_MAIL,
  "/forget-password/email-otp": CODE_MAIL,
  "/send-verification-email": CODE_MAIL,
};

/**
 * Per-email limits that Better Auth's ip+path limiter cannot express (05-api 6.4, CISO mustFix 4): password guessing
 * against one account from many addresses, and mail bombing one inbox with codes. Counts live in rate_limits.
 * Fails closed: if the count cannot be taken, the request fails.
 */
export async function limitByEmail(path: string, body: unknown): Promise<void> {
  const limits = EMAIL_LIMITS[path];
  const email = (body as { email?: unknown } | undefined)?.email;
  if (!limits || typeof email !== "string") return;
  // A keyed hash of the normalized address (WP-25), so the table never holds an address nor a hash anyone can reverse
  // with a list of addresses; case, a +tag and Gmail dots do not open a new bucket. Unkeyed only in development.
  const normal = normalizeEmail(email);
  const id = emailHashIfKeyed(normal) ?? createHash("sha256").update(normal).digest("hex");
  for (const [bucket, max, windowMs] of limits) {
    if ((await hit(`${bucket}:${id}`, windowMs)).count > max) {
      throw new APIError("TOO_MANY_REQUESTS", { message: "Too many attempts for this email. Try again later." });
    }
  }
}

/** Sign-in methods this deployment can serve. The web shows only these (GET /api/auth-providers). */
export function configuredProviders(e: Env): AuthProvider[] {
  return e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? ["email", "google"] : ["email"];
}

function createAuth() {
  const e = env();
  return betterAuth({
    appName: "Kairos",
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    trustedOrigins: [e.WEB_ORIGIN, ...(e.EXTENSION_ORIGIN ? [e.EXTENSION_ORIGIN] : []), ...e.CSRF_ALLOWED_ORIGINS],
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, rateLimit: schema.authRateLimit },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      // A reset by email code signs out every session, including one an attacker already holds.
      revokeSessionsOnPasswordReset: true,
    },
    account: {
      encryptOAuthTokens: true,
      // Explicit, not the library default. Google is trusted to prove the email, but never links into a local
      // account whose email is unverified: that row may be a squatter's pre-registration (pre-hijack).
      accountLinking: { enabled: true, trustedProviders: ["google"], requireLocalEmailVerified: true },
    },
    socialProviders: configuredProviders(e).includes("google")
      ? { google: { clientId: e.GOOGLE_CLIENT_ID!, clientSecret: e.GOOGLE_CLIENT_SECRET! } }
      : {},
    user: {
      // Settings > Delete account. Stripe is cancelled first, then eraseUser (WP-25) archives the ledger, records the
      // erasure and deletes the user row with its cascade; the erasure worker finishes Stripe, R2 and llm_calls. Better
      // Auth's own deletes that follow find nothing left.
      deleteUser: {
        enabled: true,
        // A Stripe outage throws here, which aborts the deletion: billing must never outlive the account.
        beforeDelete: async (deleted) => {
          if (env().STRIPE_SECRET_KEY) {
            const [row] = await db()
              .select({ stripeCustomerId: schema.subscriptions.stripeCustomerId })
              .from(schema.subscriptions)
              .where(eq(schema.subscriptions.userId, deleted.id));
            const cancelled = await cancelBillingForDeletedUser(row?.stripeCustomerId ?? null, {
              list: async (customer) => (await stripe().subscriptions.list({ customer, status: "all", limit: 100 }, INLINE_REQUEST)).data,
              cancel: (id) => stripe().subscriptions.cancel(id, {}, INLINE_REQUEST),
            });
            if (cancelled) logger.info({ userHash: logUserHash(deleted.id), cancelled }, "subscriptions cancelled before account deletion");
          }
          try {
            await eraseUser(db(), deleted.id, "user", tombstoneStore());
          } catch (err) {
            // Stripe is already cancelled; the account still exists and the user can retry. Loud, so it is seen.
            logger.error({ err, userHash: logUserHash(deleted.id) }, "account erasure failed after the Stripe cancel");
            throw err;
          }
          logger.info({ userHash: logUserHash(deleted.id) }, "account erased; the erasure worker finishes the other stores");
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      // auth_rate_limit: shared by every replica and kept across deploys, so one script cannot multiply its budget.
      storage: "database",
      // The per-IP rules of 05-api 6.4 that differ from Better Auth's defaults. The sign-up cap is the free-credit
      // farming control (D-25); it counts attempts, not only accounts created.
      customRules: {
        "/sign-in/email": { window: 60, max: 20 },
        "/sign-up/email": { window: 86_400, max: 3 },
        "/email-otp/send-verification-otp": { window: 3_600, max: 10 },
      },
    },
    hooks: { before: createAuthMiddleware(async (ctx) => limitByEmail(ctx.path, ctx.body)) },
    advanced: {
      useSecureCookies: e.NODE_ENV === "production",
      // Written by clientIpResolver: the web edge's x-real-ip, or the hop Railway appended. Never X-Forwarded-For,
      // whose multi-hop form resolved to one 'no-trusted-ip' bucket for the whole site.
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          await sendEmail({
            to: email,
            subject: OTP_SUBJECTS[type],
            text: `Your code is ${otp}. It expires in 10 minutes. If you did not ask for it, ignore this email.`,
            tag: `otp-${type}`,
          });
        },
      }),
      // The Chrome extension signs in with a one-time token from the web app, then uses a bearer token.
      oneTimeToken({ expiresIn: 5 }),
      bearer(),
    ],
    databaseHooks: {
      // Google's id token is a signed JWT with the email and sub. Better Auth does not encrypt it and nothing reads it
      // after the callback, so it is never stored.
      account: {
        create: { before: async (account) => ({ data: { ...account, idToken: null } }) },
        update: { before: async (account) => ({ data: { ...account, idToken: null } }) },
      },
      user: {
        create: {
          // Every new user gets a profile, a free plan row and the free credit grant in one transaction. The user row is
          // already committed, so a failure is logged rather than thrown (which would fail the sign-up before its code
          // is mailed); the bootstrap-users reconciler finishes it within 2 minutes and signals signup_repaired.
          after: async (created) => {
            const userHash = logUserHash(created.id);
            await bootstrapUser(db(), created.id).then(
              () => logger.info({ userHash }, "user onboarded"),
              (err: unknown) => logger.error({ err, userHash }, "sign-up bootstrap failed; the reconciler retries it"),
            );
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;
export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/** The narrow surface the Express app needs, so tests can pass a fake. */
export interface AuthGateway {
  handler: (request: Request) => Promise<Response>;
  getSession: (headers: Headers) => Promise<{ user: SessionUser; sessionId: string } | null>;
}

export function authGateway(): AuthGateway {
  const a = auth();
  return {
    handler: (request) => a.handler(request),
    getSession: async (headers) => {
      const result = await a.api.getSession({ headers });
      if (!result) return null;
      return {
        sessionId: result.session.id,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          emailVerified: result.user.emailVerified,
        },
      };
    },
  };
}
