import { createAuthClient } from "better-auth/react";
import { emailOTPClient, oneTimeTokenClient } from "better-auth/client/plugins";

/** Better Auth client. No baseURL: it calls /api/auth on this origin, which the rewrite sends to Express. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), oneTimeTokenClient()],
});
