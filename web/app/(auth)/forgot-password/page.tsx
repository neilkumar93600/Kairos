import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

// A step in a flow, not a page to land on from search.
export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password" body="Two steps: a code by email, then a new password." />
      <ForgotPasswordForm />
    </>
  );
}
