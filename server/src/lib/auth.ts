import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP, oneTimeToken } from "better-auth/plugins";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { cancelBillingForDeletedUser } from "../services/billing-events";
import { INLINE_REQUEST, stripe } from "../services/stripe";
import { env } from "./env";
import { logger } from "./logger";
import { sendEmail } from "./mailer";

const OTP_SUBJECTS = {
  "sign-in": "Your Kairos sign-in code",
  "email-verification": "Verify your email for Kairos",
  "forget-password": "Reset your Kairos password",
  "change-email": "Confirm your new email for Kairos",
} as const;

function forwardingAddressFor(userId: string): string {
  const suffix = randomBytes(4).toString("hex");
  return `u-${userId.slice(0, 8).toLowerCase()}-${suffix}@${env().INBOUND_EMAIL_DOMAIN}`;
}

function createAuth() {
  const e = env();
  return betterAuth({
    appName: "Kairos",
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    trustedOrigins: [e.WEB_ORIGIN, ...(e.EXTENSION_ORIGIN ? [e.EXTENSION_ORIGIN] : [])],
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
    },
    socialProviders:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
        : {},
    user: {
      // Settings > Delete account. Stripe is cancelled first, then cascades remove the profile, applications, ledger and replies.
      deleteUser: {
        enabled: true,
        // A Stripe outage throws here, which aborts the deletion: billing must never outlive the account.
        beforeDelete: async (deleted) => {
          if (!env().STRIPE_SECRET_KEY) return;
          const [row] = await db()
            .select({ stripeCustomerId: schema.subscriptions.stripeCustomerId })
            .from(schema.subscriptions)
            .where(eq(schema.subscriptions.userId, deleted.id));
          const cancelled = await cancelBillingForDeletedUser(row?.stripeCustomerId ?? null, {
            list: async (customer) => (await stripe().subscriptions.list({ customer, status: "all", limit: 100 }, INLINE_REQUEST)).data,
            cancel: (id) => stripe().subscriptions.cancel(id, {}, INLINE_REQUEST),
          });
          if (cancelled) logger.info({ userId: deleted.id, cancelled }, "subscriptions cancelled before account deletion");
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: { enabled: true, window: 60, max: 30 },
    advanced: {
      useSecureCookies: e.NODE_ENV === "production",
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
      user: {
        create: {
          // Every new user gets a profile, a free plan row and the free credit grant in one transaction.
          after: async (created) => {
            await db().transaction(async (tx) => {
              await tx.insert(schema.profiles).values({
                userId: created.id,
                forwardingAddress: forwardingAddressFor(created.id),
                preferences: null,
              });
              await tx.insert(schema.subscriptions).values({ userId: created.id, plan: "free" });
              await tx.insert(schema.creditLedger).values({ userId: created.id, delta: 25, reason: "free_grant" });
            });
            logger.info({ userId: created.id }, "user onboarded");
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
