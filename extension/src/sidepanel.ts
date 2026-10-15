import type { QueueItem } from "./lib/messages";

const list = document.getElementById("queue") as HTMLUListElement;
const summary = document.getElementById("summary") as HTMLParagraphElement;

function render(queue: QueueItem[]) {
  list.replaceChildren();
  summary.textContent = queue.length
    ? `${queue.length} approved application${queue.length === 1 ? "" : "s"} waiting. Send one at a time or review first.`
    : "Nothing approved yet. Approve applications in your Kairos queue.";
  for (const item of queue) {
    const li = document.createElement("li");
    const label = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = item.title;
    const status = document.createElement("div");
    status.className = "status";
    status.textContent = new URL(item.applyUrl).hostname;
    label.append(title, status);

    const review = document.createElement("button");
    review.textContent = "Review";
    review.style.background = "transparent";
    review.style.color = "inherit";
    review.style.border = "1px solid var(--line)";
    const send = document.createElement("button");
    send.textContent = "Send";

    const act = async (reviewMode: boolean) => {
      send.disabled = review.disabled = true;
      status.textContent = reviewMode ? "Opened for review" : "Sending…";
      const res = await chrome.runtime.sendMessage({ type: "queue:send", applicationId: item.applicationId, review: reviewMode });
      if (res?.error) status.textContent = `Could not open: ${res.error}`;
    };
    review.addEventListener("click", () => void act(true));
    send.addEventListener("click", () => void act(false));

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.append(review, send);
    li.append(label, actions);
    list.append(li);
  }
}

async function load() {
  const res = await chrome.runtime.sendMessage({ type: "queue:get" });
  if (res?.error === "not_connected") {
    summary.textContent = "Connect the extension from Settings in your Kairos dashboard.";
    return;
  }
  if (res?.error) {
    summary.textContent = "Could not load your queue. Try again in a moment.";
    return;
  }
  render(res.queue as QueueItem[]);
}

void load();
