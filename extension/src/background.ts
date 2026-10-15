import type { SubmissionReport } from "@auto-career/shared";
import { connectWithOneTimeToken, fetchQueue, sendReport } from "./lib/api";
import type { ExtensionMessage, ExternalMessage, FillPayload, QueueItem } from "./lib/messages";

/** Tabs this worker opened, keyed by tab id, with the payload their content script should fill. */
const pending = new Map<number, FillPayload>();
let cachedQueue: QueueItem[] = [];

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId });
});

async function openForApplication(applicationId: string, review: boolean) {
  const item = cachedQueue.find((q) => q.applicationId === applicationId);
  if (!item) throw new Error("not_in_queue");
  // Review mode opens the tab in front and stops before submitting; otherwise it works in the background.
  const tab = await chrome.tabs.create({ url: item.applyUrl, active: review });
  if (tab.id === undefined) throw new Error("tab_failed");
  pending.set(tab.id, { ...item, submit: !review });
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, respond) => {
  (async () => {
    switch (message.type) {
      case "queue:get": {
        const queue = await fetchQueue();
        cachedQueue = queue;
        return { queue };
      }
      case "queue:send":
        await openForApplication(message.applicationId, message.review);
        return { ok: true };
      case "content:ready":
        return sender.tab?.id !== undefined ? (pending.get(sender.tab.id) ?? null) : null;
      case "content:report": {
        const report: SubmissionReport = message.report;
        const tabId = sender.tab?.id;
        const wasAutoSubmit = tabId !== undefined && pending.get(tabId)?.submit === true;
        if (tabId !== undefined) pending.delete(tabId);
        if (report.outcome === "submitted" || wasAutoSubmit) await sendReport(report);
        if (report.outcome === "submitted" && tabId !== undefined) await chrome.tabs.remove(tabId);
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

chrome.tabs.onRemoved.addListener((tabId) => pending.delete(tabId));
