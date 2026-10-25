import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Kairos to review your matches, drafts and receipts.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Sign in" body="Pick up your review queue where you left it." />
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
