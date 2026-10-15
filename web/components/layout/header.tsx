"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import { useMe } from "@/hooks/use-me";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "../shared/skeleton";
import { Logo } from "../shared/logo";

/** Dashboard top bar: available credits, plan and sign out. */
export function Header() {
  const router = useRouter();
  const { data, isLoading } = useMe();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-line px-4 sm:px-6">
      <div className="lg:hidden">
        <Logo href="/dashboard" />
      </div>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-4 text-sm">
        {isLoading || !data ? (
          <Skeleton className="h-5 w-40" />
        ) : (
          <Link href="/billing" className="flex items-center gap-2 text-body hover:text-foreground">
            <span className="tabular-nums text-foreground">{data.credits.available}</span> credits
            <span aria-hidden>·</span>
            {data.plan.name}
          </Link>
        )}
        <button onClick={signOut} className="flex items-center gap-1 text-body hover:text-foreground">
          <SignOut size={16} /> Sign out
        </button>
      </div>
    </header>
  );
}
