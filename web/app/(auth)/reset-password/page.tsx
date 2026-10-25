import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

// A step in a flow, not a page to land on from search.
export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Set a new password" body="Enter the code from the email, then choose a new password." />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
