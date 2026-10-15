import type { SubmissionReport } from "@auto-career/shared";
import type { QueueItem } from "./messages";

declare const __API_BASE__: string;
export const API_BASE = __API_BASE__;

const TOKEN_KEY = "authToken";

export async function getToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  const token = stored[TOKEN_KEY];
  return typeof token === "string" ? token : null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("not_connected");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init.headers },
  });
  if (res.status === 401) {
    await chrome.storage.local.remove(TOKEN_KEY);
    throw new Error("not_connected");
  }
  if (!res.ok) throw new Error(`api_${res.status}`);
  return (await res.json()) as T;
}

/** Trades the one-time token the web app hands over for a session token used as a bearer. */
export async function connectWithOneTimeToken(oneTimeToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/one-time-token/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: oneTimeToken }),
  });
  if (!res.ok) throw new Error("connect_failed");
  const body = (await res.json()) as { session?: { token?: string } };
  if (!body.session?.token) throw new Error("connect_failed");
  await chrome.storage.local.set({ [TOKEN_KEY]: body.session.token });
}

export const fetchQueue = () => call<{ queue: QueueItem[] }>("/api/extension/queue").then((r) => r.queue);

export const sendReport = (report: SubmissionReport) =>
  call<{ status: string | null }>("/api/extension/report", { method: "POST", body: JSON.stringify(report) });
