import { z } from "zod";
import { ApiError, post } from "@/lib/api";

// ponytail: local schema until WP-50 lands the shared one; swap for newsletterSignupSchema from @auto-career/shared then.
const signupSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
  source: z.enum(["popup", "blog-index", "blog-post", "about"]),
  website: z.string().max(2048).optional(), // honeypot, stays empty for people
});

export type NewsletterSignup = z.input<typeof signupSchema>;
export type NewsletterSource = NewsletterSignup["source"];
export type SubscribeResult = "sent" | "invalid" | "rate-limited" | "network";
export type NewsletterTokenResult = "ok" | "not-found" | "rate-limited" | "network";

/** POST /api/newsletter. The API answers 202 for every valid body, whatever the address's state, so "sent" claims nothing about it. */
export async function subscribeNewsletter(input: NewsletterSignup): Promise<SubscribeResult> {
  const body = signupSchema.safeParse(input);
  if (!body.success) return "invalid";
  try {
    await post("/newsletter", body.data);
    return "sent";
  } catch (e) {
    if (!(e instanceof ApiError)) return "network";
    return e.status === 422 ? "invalid" : e.status === 429 ? "rate-limited" : "network";
  }
}

async function postToken(path: string, token: string): Promise<NewsletterTokenResult> {
  try {
    await post(`/newsletter/${path}?token=${encodeURIComponent(token)}`);
    return "ok";
  } catch (e) {
    if (!(e instanceof ApiError)) return "network";
    return e.status === 404 ? "not-found" : e.status === 429 ? "rate-limited" : "network";
  }
}

/** POST /api/newsletter/confirm?token=. "not-found": unknown, used or expired. Only ever call this from a button press (D9). */
export const confirmNewsletter = (token: string) => postToken("confirm", token);

/** POST /api/newsletter/unsubscribe?token=. "not-found": unknown token. Only ever call this from a button press (D9). */
export const unsubscribeNewsletter = (token: string) => postToken("unsubscribe", token);
