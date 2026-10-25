import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Kairos account. 25 free applications, no card, and nothing is sent until you approve it.",
  alternates: { canonical: "/sign-up" },
};

export default function SignUpPage() {
  return (
    <>
      <AuthHeading title="Create your account" body="25 free applications. No card." />
      <SignUpForm />
    </>
  );
}
