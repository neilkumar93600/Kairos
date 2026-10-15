import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { VerifyOtpForm } from "@/components/auth/verify-otp-form";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyOtpPage() {
  return (
    <>
      <AuthHeading title="Check your email" />
      <Suspense>
        <VerifyOtpForm />
      </Suspense>
    </>
  );
}
