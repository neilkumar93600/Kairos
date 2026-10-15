"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../../shared/button";
import { Field, Input } from "../../shared/field";

/** Deletes the account and everything tied to it. Typing DELETE guards against a stray click. */
export function DeleteAccount() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const { error: err } = await authClient.deleteUser();
    if (err) return setError(err.message ?? "Could not delete the account.");
    router.push("/");
  }

  return (
    <div className="flex max-w-md flex-col gap-4 rounded-card border border-bad/30 p-6">
      <p className="text-sm text-body">This removes your profile, facts, applications, receipts and replies. Payment records stay with Stripe as tax law requires.</p>
      <Field label='Type "DELETE" to confirm' htmlFor="confirm-delete">
        <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error ? <p role="alert" className="text-sm text-bad">{error}</p> : null}
      <div>
        <Button variant="danger" disabled={confirm !== "DELETE"} onClick={remove}>
          Delete my account
        </Button>
      </div>
    </div>
  );
}
