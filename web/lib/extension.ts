import { authClient } from "./auth-client";

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID ?? "";

type ChromeRuntime = { sendMessage: (id: string, message: unknown, callback: (response: unknown) => void) => void };

function runtime(): ChromeRuntime | null {
  const chromeGlobal = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome;
  return chromeGlobal?.runtime?.sendMessage ? chromeGlobal.runtime : null;
}

function send(message: unknown): Promise<{ ok?: boolean } | null> {
  const rt = runtime();
  if (!rt || !EXTENSION_ID) return Promise.resolve(null);
  return new Promise((resolve) => rt.sendMessage(EXTENSION_ID, message, (r) => resolve((r as { ok?: boolean }) ?? null)));
}

export async function isExtensionInstalled(): Promise<boolean> {
  return Boolean((await send({ type: "ping" }))?.ok);
}

/** Hands the extension a 5-minute one-time token; it trades it for its own session. */
export async function connectExtension(): Promise<boolean> {
  const { data, error } = await authClient.oneTimeToken.generate();
  if (error || !data?.token) return false;
  return Boolean((await send({ type: "connect", oneTimeToken: data.token }))?.ok);
}
