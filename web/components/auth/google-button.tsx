"use client";

import { GoogleLogo } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";

export function GoogleButton({ next = "/dashboard" }: { next?: string }) {
  return (
    <Button type="button" variant="secondary" className="w-full" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}>
      <GoogleLogo size={18} weight="bold" /> Continue with Google
    </Button>
  );
}
