"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ButtonLink } from "../shared/button";
import { CodeStep } from "./code-step";

/** After sign-up by email: the code proves the address, then onboarding. */
export function VerifyOtpForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";

  if (!email) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-body">This page needs the email you signed up with. Sign up again and we will send a new code.</p>
        <ButtonLink href="/sign-up" className="w-full">
          Sign up
        </ButtonLink>
        <p className="auth__switch">
          Already verified?{" "}
          <Link href="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CodeStep
        email={email}
        purpose="email-verification"
        submitLabel="Verify email"
        changeHref="/sign-up"
        verify={async (otp) => (await authClient.emailOtp.verifyEmail({ email, otp })).error}
        onVerified={() => router.push("/onboarding")}
      />
      <p className="auth__switch">
        Already verified?{" "}
        <Link href="/login" className="auth-link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
