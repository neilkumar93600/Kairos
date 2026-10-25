"use client";

import { useEffect, useState } from "react";
import { connectExtension, isExtensionInstalled } from "@/lib/extension";
import { Button } from "../../shared/button";
import { StatusWord } from "../../shared/status";

export function ExtensionConnect() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "connected" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;
    isExtensionInstalled().then((ok) => !cancelled && setInstalled(ok));
    return () => {
      cancelled = true;
    };
  }, []);

  if (installed === false) {
    return <p className="text-sm text-body">Install the Kairos extension from the Chrome Web Store, then reload this page.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <Button
        disabled={installed === null || state === "connecting" || state === "connected"}
        onClick={async () => {
          setState("connecting");
          setState((await connectExtension()) ? "connected" : "failed");
        }}
      >
        {state === "connecting" ? "Connecting" : "Connect extension"}
      </Button>
      {state === "connected" ? <StatusWord tone="positive">Connected</StatusWord> : null}
      {state === "failed" ? (
        <p role="alert" className="text-sm text-bad">
          Could not connect. Make sure you are signed in, then try again.
        </p>
      ) : null}
    </div>
  );
}
