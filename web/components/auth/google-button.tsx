"use client";

import { GoogleLogoIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";

/** Outlined pill on Linen (DESIGN.md Ghost Button off art): Paper White, Stone border, Bone on hover. No glass here. */
export function GoogleButton({ next = "/dashboard" }: { next?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full bg-surface backdrop-blur-none hover:bg-sunk"
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}
    >
      <GoogleLogoIcon size={18} weight="bold" aria-hidden /> Continue with Google
    </Button>
  );
}
