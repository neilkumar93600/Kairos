import type { SubmissionReport } from "@auto-career/shared";
import { connectWithOneTimeToken, fetchQueue, sendReport } from "./lib/api";
import { unrecordedKey, type ExtensionMessage, type ExternalMessage, type FillPayload, type PanelMessage, type QueueItem, type QueueOutcome } from "./lib/messages";

/**
 * The tabs this worker opened, with the payload their content script should fill. In session storage, not a variable:
 * Chrome stops an idle MV3 worker after about 30 seconds and a variable would be gone. Session storage is memory-only,
 * clears with the browser and is closed to content scripts by default, which matters because payloads hold answers.
 */
const pendingKey = (tabId: number) => `pending:${tabId}`;
const remember = (tabId: number, payload: FillPayload) => chrome.storage.session.set({ [pendingKey(tabId)]: payload });
const forget = (tabId: number) => chrome.storage.session.remove(pendingKey(tabId));
async function recall(tabId: number): Promise<FillPayload | null> {
  const stored = await chrome.storage.session.get(pendingKey(tabId));
  return (stored[pendingKey(tabId)] as FillPayload | undefined) ?? null;
}

let cachedQueue: QueueItem[] = [];
async function refreshQueue() {
  cachedQueue = await fetchQueue();
  return cachedQueue;
}

/** Tells the side panel how an application ended. Rejects when the panel is closed, which is fine: it reloads on open. */
function notifyPanel(applicationId: string, outcome: QueueOutcome) {
  const message: PanelMessage = { type: "queue:update", applicationId, ...outcome };
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId });
});

async function openForApplication(applicationId: string, review: boolean) {
  // The cache is empty if the worker restarted between the panel loading and this press.
  const find = (queue: QueueItem[]) => queue.find((q) => q.applicationId === applicationId);
  const item = find(cachedQueue) ?? find(await refreshQueue());
  if (!item) throw new Error("not_in_queue");
  // Review mode opens the tab in front and stops before submitting; otherwise it works in the background.
  // Parked on a blank page first, so the payload is stored before the real page can ask for it.
  const tab = await chrome.tabs.create({ url: "about:blank", active: review });
  if (tab.id === undefined) throw new Error("tab_failed");
  await remember(tab.id, { ...item, submit: !review });
  await chrome.tabs.update(tab.id, { url: item.applyUrl });
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, respond) => {
  (async () => {
    switch (message.type) {
      case "queue:get":
        return { queue: await refreshQueue() };
      case "queue:send":
        await openForApplication(message.applicationId, message.review);
        return { ok: true };
      case "content:ready":
        return sender.tab?.id !== undefined ? recall(sender.tab.id) : null;
      case "content:report": {
        const report: SubmissionReport = message.report;
        const tabId = sender.tab?.id;
        const sent = tabId !== undefined ? await recall(tabId) : null;
        // Only a tab this worker opened, reporting the application it was given. A report is a charge, so nothing else counts.
        if (tabId === undefined || !sent || report.applicationId !== sent.applicationId) return { ok: true };
        await forget(tabId);
        let recorded = true;
        if (report.outcome === "submitted" || sent.submit) {
          await sendReport(report).catch(() => {
            recorded = false;
          });
        }
        if (report.outcome === "submitted" && !recorded) {
          // The employer has it and our API does not, so the queue will offer it again. Keep the tab, whose page is the only
          // proof, and remember this beyond the panel, or reopening it would bring Send back. ponytail: the warning lasts until
          // the browser closes; a retry queue for the report would be the full fix.
          await chrome.storage.session.set({ [unrecordedKey(report.applicationId)]: true });
          notifyPanel(report.applicationId, { outcome: "unrecorded" });
        } else if (report.outcome === "submitted") {
          await chrome.tabs.remove(tabId);
          notifyPanel(report.applicationId, { outcome: "submitted" });
        } else {
          notifyPanel(report.applicationId, { outcome: "failed", reason: report.failureReason });
        }
        return { ok: true };
      }
    }
  })()
    .then(respond)
    .catch((err: unknown) => respond({ error: err instanceof Error ? err.message : "unknown" }));
  return true; // keep the channel open for the async response
});

// The web app's Settings page hands over a one-time token to connect this extension to the account.
chrome.runtime.onMessageExternal.addListener((message: ExternalMessage, _sender, respond) => {
  if (message.type === "ping") return respond({ ok: true, version: chrome.runtime.getManifest().version });
  connectWithOneTimeToken(message.oneTimeToken)
    .then(() => respond({ ok: true }))
    .catch(() => respond({ ok: false }));
  return true;
});

// A job page that redirects off the supported boards has no content script, so it would never report.
const SUPPORTED = new Set((chrome.runtime.getManifest().content_scripts ?? []).flatMap((c) => c.matches ?? []).map((m) => new URL(m).hostname));
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url || !tab.url.startsWith("http") || SUPPORTED.has(new URL(tab.url).hostname)) return;
  void recall(tabId).then((sent) => {
    if (!sent) return;
    void forget(tabId);
    notifyPanel(sent.applicationId, { outcome: "failed", reason: "This job page moved off a board Kairos can fill" });
  });
});

// A tab still pending when it closes never reported, so the panel must not keep saying "Sending".
chrome.tabs.onRemoved.addListener((tabId) => {
  void recall(tabId).then((sent) => {
    if (!sent) return;
    void forget(tabId);
    notifyPanel(sent.applicationId, { outcome: "closed" });
  });
});
