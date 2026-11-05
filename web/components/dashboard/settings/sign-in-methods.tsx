"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { useLinkedAccounts } from "@/hooks/use-linked-accounts";
import { authClient } from "@/lib/auth-client";
import { AppleMark, GithubMark, GoogleMark, LinkedinMark } from "../../auth/social-buttons";
import { Button } from "../../shared/button";
import { ErrorNote } from "../../shared/error-note";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { StatusWord } from "../../shared/status";

type Social = "google" | "apple" | "github" | "linkedin";
type Method = { id: "credential" | Social; name: string; mark: ReactNode };

const METHODS: Method[] = [
  { id: "credential", name: "Email and password", mark: <EnvelopeSimple size={20} weight="light" /> },
  { id: "google", name: "Google", mark: <GoogleMark /> },
  { id: "apple", name: "Apple", mark: <AppleMark /> },
  { id: "github", name: "GitHub", mark: <GithubMark /> },
  { id: "linkedin", name: "LinkedIn", mark: <LinkedinMark /> },
];

const TITLE = "Sign-in methods";
const BODY = "The ways you can sign in to this account.";
/** 36px dense-row pills keep a 44px hit area. */
const HIT = "relative after:absolute after:inset-x-0 after:-inset-y-1";

/**
 * Settings callout (DESIGN.md Reference layer, "Sign-in methods callout"): every method with its mark, "Connected" from
 * the account's real linked accounts or a quiet Connect. Unlink shows only while another method stays linked (Better
 * Auth also refuses to unlink the last one). Only Google has an OAuth app on the API today, so Connect on the others
 * comes back with an inline "not set up yet" instead of a dead click.
 */
export function SignInMethods() {
  const qc = useQueryClient();
  const { data, error, refetch } = useLinkedAccounts();
  // linkSocial's errorCallbackURL brings a failed OAuth round trip back here with ?error=<code>.
  const returned = useSearchParams().get("error");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);

  if (error)
    return (
      <Panel title={TITLE} description={BODY}>
        <ErrorNote error={error} onRetry={() => refetch()} />
      </Panel>
    );
  if (!data) return <SignInMethodsSkeleton />;

  const accounts = data;
  const canUnlink = accounts.length > 1;

  async function connect(m: Method & { id: Social }) {
    setNote(null);
    setBusy(m.id);
    // Success navigates to the provider; only a failure resolves here.
    const { error: err } = await authClient
      .linkSocial({ provider: m.id, callbackURL: "/settings", errorCallbackURL: "/settings" })
      .catch(() => ({ error: { status: 0, code: undefined as string | undefined } }));
    if (!err) return;
    setBusy(null);
    const missing = err.status === 404 || err.code === "PROVIDER_NOT_FOUND";
    setNote({ id: m.id, text: missing ? `${m.name} sign-in is not set up yet.` : `Could not reach ${m.name}. Try again.` });
  }

  async function unlink(m: Method, accountId: string) {
    setNote(null);
    setBusy(m.id);
    const { error: err } = await authClient.unlinkAccount({ accountId }).catch(() => ({ error: { status: 0, code: undefined as string | undefined } }));
    if (!err) await qc.invalidateQueries({ queryKey: ["linked-accounts"] });
    setBusy(null);
    if (err)
      setNote({
        id: m.id,
        text: err.code === "SESSION_NOT_FRESH" ? "Sign in again first: unlinking needs a recent sign-in." : `Could not unlink ${m.name}. Try again.`,
      });
  }

  return (
    <Panel flush title={TITLE} description={BODY}>
      {returned ? (
        <div className="px-6 pb-4">
          <p role="alert" className="text-sm text-bad">
            That sign-in method was not connected. Try again, or use another one.
          </p>
        </div>
      ) : null}
      <ul>
        {METHODS.map((m) => {
          const account = accounts.find((a) => a.providerId === m.id);
          const pending = busy === m.id;
          const rowNote = note?.id === m.id ? note.text : null;
          return (
            <li key={m.id} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-6 py-3">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-sunk text-ink">
                {m.mark}
              </span>
              {/* Status sits under the name, so a long name never squeezes against the action on a phone. */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-base font-medium text-ink">{m.name}</p>
                {account ? (
                  <StatusWord tone="positive">Connected</StatusWord>
                ) : m.id === "credential" ? (
                  <p className="text-sm text-faint">Not set. Sign out, then use Forgot password to set one.</p>
                ) : null}
              </div>
              {account ? (
                canUnlink ? (
                  <Button size="sm" variant="ghost" className={HIT} disabled={busy !== null} aria-label={`Unlink ${m.name}`} onClick={() => unlink(m, account.id)}>
                    {pending ? "Unlinking…" : "Unlink"}
                  </Button>
                ) : null
              ) : m.id === "credential" ? null : (
                <Button size="sm" variant="ghost" className={HIT} disabled={busy !== null} aria-label={`Connect ${m.name}`} onClick={() => connect(m as Method & { id: Social })}>
                  {pending ? "Opening…" : "Connect"}
                </Button>
              )}
              {rowNote ? (
                <p role="alert" className="basis-full pl-14 text-sm text-bad">
                  {rowNote}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="h-2" />
    </Panel>
  );
}

/** Same frame as the loaded callout: header, then five rows of mark, name and status. */
export function SignInMethodsSkeleton() {
  return (
    <Panel flush title={TITLE} description={BODY} aria-busy="true">
      <span className="sr-only" role="status">
        Loading sign-in methods
      </span>
      <ul aria-hidden>
        {METHODS.map((m) => (
          <li key={m.id} className="flex min-h-16 items-center gap-4 border-t border-line px-6 py-3">
            <Skeleton className="size-10 shrink-0 rounded-pill" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-9 w-20 rounded-pill" />
          </li>
        ))}
      </ul>
      <div className="h-2" />
    </Panel>
  );
}
