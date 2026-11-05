"use client";

import { useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { FormError } from "./fields";

// Brand marks as the owner supplied them (2026-10-29). Google and LinkedIn keep their colours; Apple and GitHub take currentColor (Ink).
const MARK = "size-5 shrink-0";

export function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 512 512" className={MARK}>
      <path fill="#fc4c53" d="M502.2 209.5H261.1v99.1h137.8c-6.1 31.9-24.2 58.9-51.4 77c-22.8 15.4-51.9 24.7-86.3 24.7c-66.6 0-123.1-44.9-143.4-105.4h-.3l.3-.2c-5.1-15.4-8.1-31.7-8.1-48.6s3-33.3 8.1-48.6C138 147 194.6 102.1 261.2 102.1c37.7 0 71.2 13 98 38.2L432.5 67C388 25.4 330.2 0 261.1 0C161 0 74.7 57.5 32.6 141.3C15.1 175.7 5.1 214.6 5.1 256s10 80.3 27.5 114.7v.2C74.7 454.5 161 512 261.1 512c69.1 0 127.1-22.8 169.4-61.9c48.4-44.7 76.3-110.3 76.3-188.3c.1-18.1-1.5-35.6-4.6-52.3" />
      <radialGradient id="kg-yellow" cx="91.998" cy="254.653" r="224.709" gradientTransform="matrix(.8032 0 0 -1.0842 -7.184 568.69)" gradientUnits="userSpaceOnUse">
        <stop offset=".368" stopColor="#ffcf09" />
        <stop offset=".718" stopColor="#ffcf09" stopOpacity=".7" />
        <stop offset="1" stopColor="#ffcf09" stopOpacity="0" />
      </radialGradient>
      <path fill="url(#kg-yellow)" d="M117.8 304.9h-.3l.3-.2c-5.1-15.4-8.1-31.7-8.1-48.6c0-17 3-33.3 8.1-48.6c12.8-38.3 40.2-70.2 75.3-88.6C169 86.9 138.3 64 104 54.2c-29.7 23.3-54.3 52.9-71.5 87C15.1 175.7 5.1 214.6 5.1 256s10 80.3 27.5 114.7v.2c28.3 56 76.5 100.3 135.3 123.4c24.6-22.5 44.7-53 58.6-88.7c-50.9-12.4-92.1-51.1-108.7-100.7" />
      <radialGradient id="kg-green" cx="188.9" cy="-30.673" r="276.436" gradientTransform="matrix(1.317 -.1645 -.1248 -.9995 90.861 507.496)" gradientUnits="userSpaceOnUse">
        <stop offset=".383" stopColor="#34a853" />
        <stop offset=".706" stopColor="#34a853" stopOpacity=".7" />
        <stop offset="1" stopColor="#34a853" stopOpacity="0" />
      </radialGradient>
      <path fill="url(#kg-green)" d="M34.5 374.4C77.2 456.1 162.4 512 261.1 512c69.1 0 127.1-22.8 169.4-61.9c48.4-44.7 76.3-110.3 76.3-188.3c0-4.5-.4-8.7-.6-13.1c-59-19.4-126.6-26.7-197.2-17.9c-16.4 2-32.2 5.1-47.8 8.7v69.1H399c-6.1 31.9-24.2 58.9-51.4 77c-22.8 15.4-51.9 24.7-86.3 24.7c-66.6 0-123.1-44.9-143.4-105.4h-.3l.3-.2c-.5-1.5-.7-3.1-1.2-4.6c-32.5 21.3-60.2 46.5-82.2 74.3" />
      <linearGradient id="kg-blue" x1="521.402" x2="255.847" y1="398.065" y2="71.945" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
        <stop offset=".671" stopColor="#4285f4" />
        <stop offset=".885" stopColor="#4285f4" stopOpacity="0" />
      </linearGradient>
      <path fill="url(#kg-blue)" d="M430.5 450.1c48.4-44.7 76.3-110.3 76.3-188.3c0-18.2-1.6-35.6-4.7-52.4h-241v99.1h137.8c-6.1 31.9-24.2 58.9-51.4 77c-16.4 11-36.1 18.8-58.6 22.3l85.7 79.7c20.8-9.7 39.6-22.3 55.9-37.4" />
    </svg>
  );
}

export function AppleMark() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={MARK}>
      <path fill="currentColor" d="M9.438 31.401a7 7 0 0 1-1.656-1.536a20 20 0 0 1-1.422-1.938a18.9 18.9 0 0 1-2.375-4.849c-.667-2-.99-3.917-.99-5.792c0-2.094.453-3.922 1.339-5.458a7.7 7.7 0 0 1 2.797-2.906a7.45 7.45 0 0 1 3.786-1.12q.705.002 1.51.198c.385.109.854.281 1.427.495c.729.281 1.13.453 1.266.495c.427.156.786.224 1.068.224c.214 0 .516-.068.859-.172c.193-.068.557-.188 1.078-.411c.516-.188.922-.349 1.245-.469c.495-.146.974-.281 1.401-.349a6.7 6.7 0 0 1 1.531-.063a9 9 0 0 1 2.589.557c1.359.547 2.458 1.401 3.276 2.615a6.4 6.4 0 0 0-.969.734a8.2 8.2 0 0 0-1.641 2.005a6.8 6.8 0 0 0-.859 3.359c.021 1.443.391 2.714 1.12 3.813a7.2 7.2 0 0 0 2.047 2.047c.417.281.776.474 1.12.604c-.161.5-.333.984-.536 1.464a19 19 0 0 1-1.667 3.083c-.578.839-1.031 1.464-1.375 1.88c-.536.635-1.052 1.12-1.573 1.458c-.573.38-1.25.583-1.938.583a4.4 4.4 0 0 1-1.38-.167c-.385-.13-.766-.271-1.141-.432a9 9 0 0 0-1.203-.453a6.3 6.3 0 0 0-3.099-.005c-.417.12-.818.26-1.214.432c-.557.234-.927.391-1.141.458c-.427.125-.87.203-1.318.229c-.693 0-1.339-.198-1.979-.599zm9.14-24.615c-.906.453-1.771.646-2.63.583c-.135-.865 0-1.75.359-2.719a7.3 7.3 0 0 1 1.333-2.24A7.1 7.1 0 0 1 19.812.733q1.319-.68 2.521-.734c.104.906 0 1.797-.333 2.76a8 8 0 0 1-1.333 2.344a6.8 6.8 0 0 1-2.115 1.682z" />
    </svg>
  );
}

export function GithubMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={MARK}>
      <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59c.4.07.55-.17.55-.38c0-.19-.01-.82-.01-1.49c-2.01.37-2.53-.49-2.69-.94c-.09-.23-.48-.94-.82-1.13c-.28-.15-.68-.52-.01-.53c.63-.01 1.08.58 1.23.82c.72 1.21 1.87.87 2.33.66c.07-.52.28-.87.51-1.07c-1.78-.2-3.64-.89-3.64-3.95c0-.87.31-1.59.82-2.15c-.08-.2-.36-1.02.08-2.12c0 0 .67-.21 2.2.82c.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82c.44 1.1.16 1.92.08 2.12c.51.56.82 1.27.82 2.15c0 3.07-1.87 3.75-3.65 3.95c.29.25.54.73.54 1.48c0 1.07-.01 1.93-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  );
}

export function LinkedinMark() {
  return (
    <svg aria-hidden viewBox="0 0 256 256" className={MARK}>
      <path fill="#0a66c2" d="M218.123 218.127h-37.931v-59.403c0-14.165-.253-32.4-19.728-32.4c-19.756 0-22.779 15.434-22.779 31.369v60.43h-37.93V95.967h36.413v16.694h.51a39.91 39.91 0 0 1 35.928-19.733c38.445 0 45.533 25.288 45.533 58.186zM56.955 79.27c-12.157.002-22.014-9.852-22.016-22.009s9.851-22.014 22.008-22.016c12.157-.003 22.014 9.851 22.016 22.008A22.013 22.013 0 0 1 56.955 79.27m18.966 138.858H37.95V95.967h37.97zM237.033.018H18.89C8.58-.098.125 8.161-.001 18.471v219.053c.122 10.315 8.576 18.582 18.89 18.474h218.144c10.336.128 18.823-8.139 18.966-18.474V18.454c-.147-10.33-8.635-18.588-18.966-18.453" />
    </svg>
  );
}

type Provider = "google" | "apple" | "github" | "linkedin";

const PROVIDERS: { id: Provider; name: string; mark: ReactNode }[] = [
  { id: "google", name: "Google", mark: <GoogleMark /> },
  { id: "apple", name: "Apple", mark: <AppleMark /> },
  { id: "github", name: "GitHub", mark: <GithubMark /> },
  { id: "linkedin", name: "LinkedIn", mark: <LinkedinMark /> },
];

/**
 * Social sign-in: one row of four icon-only outlined pills on Linen (owner, 2026-10-29: "all 4 in one line"; DESIGN.md
 * Ghost Button off art: Paper White, Stone border, Bone on hover; no glass). At 316 px a pill is about 70 px, too narrow
 * for a label, so the name lives in aria-label and the tooltip. Each provider needs its OAuth app on the API (server/src/lib/auth.ts socialProviders);
 * until one is set up, a click says so inline instead of failing silently.
 */
export function SocialButtons({ next = "/dashboard" }: { next?: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(p: (typeof PROVIDERS)[number]) {
    setError(null);
    setPending(p.id);
    // Success leaves the page for the provider; only a failure comes back here.
    const { error: err } = await authClient.signIn.social({ provider: p.id, callbackURL: next }).catch(() => ({ error: true }));
    if (!err) return;
    setPending(null);
    setError(`${p.name} sign-in is not available right now. Use your email, or another option.`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Continue with" className="grid grid-cols-4 gap-3">
        {PROVIDERS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant="secondary"
            disabled={pending !== null}
            aria-label={`Continue with ${p.name}`}
            title={`Continue with ${p.name}`}
            className="w-full px-0 bg-surface backdrop-blur-none hover:bg-sunk"
            onClick={() => start(p)}
          >
            {p.mark}
          </Button>
        ))}
      </div>
      <FormError>{error}</FormError>
    </div>
  );
}
