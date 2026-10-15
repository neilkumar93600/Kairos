"use client";

import { useEffect, useState } from "react";
import { connectExtension, isExtensionInstalled } from "@/lib/extension";
import { Button } from "../../shared/button";

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
    <div className="flex items-center gap-3">
      <Button
        disabled={installed === null || state === "connecting"}
        onClick={async () => {
          setState("connecting");
          setState((await connectExtension()) ? "connected" : "failed");
        }}
      >
        {state === "connected" ? "Connected" : "Connect extension"}
      </Button>
      {state === "failed" ? <span className="text-sm text-bad">Could not connect. Make sure you are signed in, then try again.</span> : null}
    </div>
  );
}
