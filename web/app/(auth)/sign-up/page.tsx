import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Kairos account. 25 free applications, no card, and nothing is sent until you approve it.",
  alternates: { canonical: "/sign-up" },
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return (
    <>
      <AuthHeading title="Create your account" body="Start free. Find your fit. Keep the final say." />
      <SignUpForm />
    </>
  );
}
