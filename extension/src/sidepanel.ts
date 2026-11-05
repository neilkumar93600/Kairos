import { API_BASE } from "./lib/api";
import { unrecordedKey, type PanelMessage, type QueueItem } from "./lib/messages";
import { describeSource, stateFor, summarize, type RowState } from "./lib/panel";

const main = document.getElementById("main") as HTMLElement;
const refresh = document.getElementById("refresh") as HTMLButtonElement;
(document.getElementById("home") as HTMLAnchorElement).href = `${API_BASE}/dashboard`;

interface Row {
  item: QueueItem;
  state: RowState;
  el: HTMLLIElement;
  status: HTMLElement;
  actions: HTMLElement;
}

/** Rows survive a refresh: a sent application leaves the server's queue, but its result stays on screen until the panel closes. */
const rows = new Map<string, Row>();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function link(label: string, path: string, className?: string): HTMLAnchorElement {
  const a = el("a", className, label);
  a.href = `${API_BASE}${path}`;
  a.target = "_blank";
  a.rel = "noreferrer";
  return a;
}

function setStatus(row: Row) {
  const { state, item, status } = row;
  status.replaceChildren();
  status.className = "status";
  const line = (mark: "square" | "dot" | null, text: string, after?: HTMLElement) => {
    if (mark) status.append(el("span", mark));
    const body = el("span", undefined, text);
    if (after) body.append(" ", after);
    status.append(body);
  };
  const open = (label: string) => link(label, `/applications/${item.applicationId}`);
  switch (state.kind) {
    case "idle":
      if (state.note) line(null, state.note);
      break;
    case "sending":
      line("square", "Sending in a background tab…");
      break;
    case "review":
      line("square", "Filled in the open tab. Check it, then press the employer's submit button.");
      break;
    case "submitted":
      line("dot", "Submitted.", open("See receipt"));
      break;
    case "failed":
      status.classList.add("status--bad");
      line(null, state.text, open("Open in Kairos"));
      break;
    case "unrecorded":
      status.classList.add("status--bad");
      line(null, "The employer confirmed it, but Kairos could not record it. Do not send it again.", open("Open in Kairos"));
      break;
  }
}

function update(row: Row, state: RowState, moveFocus = false) {
  row.state = state;
  setStatus(row);
  row.actions.style.display = state.kind === "idle" ? "" : "none";
  if (moveFocus) row.status.focus({ preventScroll: true });
}

async function act(row: Row, review: boolean) {
  update(row, { kind: review ? "review" : "sending" }, true);
  const res = await chrome.runtime.sendMessage({ type: "queue:send", applicationId: row.item.applicationId, review });
  if (res?.error) update(row, { kind: "failed", text: "Could not open the application page. Nothing was sent and no credit was used." });
}

function buildRow(item: QueueItem): Row {
  const li = el("li", "row");
  const head = el("div");
  head.append(el("h2", undefined, item.title), el("p", "meta", describeSource(item.applyUrl)));
  const status = el("div", "status");
  status.tabIndex = -1;
  status.setAttribute("aria-live", "polite");
  const actions = el("div", "actions");
  const review = el("button", "btn btn--ghost", "Review");
  const send = el("button", "btn", "Send");
  review.type = send.type = "button";
  review.setAttribute("aria-label", `Review ${item.title}`);
  send.setAttribute("aria-label", `Send ${item.title}`);
  actions.append(review, send);
  li.append(head, status, actions);

  const row: Row = { item, state: { kind: "idle" }, el: li, status, actions };
  review.addEventListener("click", () => void act(row, true));
  send.addEventListener("click", () => void act(row, false));
  return row;
}

function renderMessage(title: string, body: string, action?: HTMLElement) {
  const box = el("section", "message");
  box.append(el("h1", undefined, title), el("p", undefined, body));
  if (action) box.append(action);
  main.replaceChildren(box);
}

/** One list for the life of the panel: a row is never detached once shown, so focus and its live region survive an update. */
const list = el("ul", "rows");
const summary = el("p");

function renderQueue() {
  const live = [...rows.values()];
  for (const li of [...list.children]) if (!live.some((r) => r.el === li)) li.remove();
  for (const r of live) if (r.el.parentElement !== list) list.append(r.el);
  summary.textContent = summarize(live.filter((r) => r.state.kind === "idle").length);
  if (list.isConnected) return;
  const head = el("div", "head");
  head.append(el("h1", undefined, "Ready to send"), summary);
  const how = el("p", "how", "Send fills and submits in a background tab. Review fills the form and leaves the submit button to you.");
  main.replaceChildren(head, how, list);
}

async function load() {
  const res = await chrome.runtime.sendMessage({ type: "queue:get" });
  main.setAttribute("aria-busy", "false");
  if (res?.error === "not_connected") {
    renderMessage("Connect the extension", "Connect the extension from Settings in your Kairos dashboard.", link("Open Settings", "/settings", "btn"));
    return;
  }
  if (res?.error) {
    const retry = el("button", "btn", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () => void load());
    renderMessage("Could not load your queue", "Check your connection, then try again.", retry);
    return;
  }
  const queue = res.queue as QueueItem[];
  const live = new Set(queue.map((q) => q.applicationId));
  for (const [id, row] of rows) {
    if (row.state.kind === "idle" && !live.has(id)) rows.delete(id); // withdrawn or sent elsewhere
  }
  const unrecorded = await chrome.storage.session.get(queue.map((q) => unrecordedKey(q.applicationId)));
  for (const item of queue) {
    if (rows.has(item.applicationId)) continue;
    const row = buildRow(item);
    rows.set(item.applicationId, row);
    if (unrecorded[unrecordedKey(item.applicationId)]) update(row, { kind: "unrecorded" });
  }
  if (rows.size === 0) {
    renderMessage("Nothing approved yet", "Approve applications in your Kairos queue, then send them from here.", link("Open your queue", "/queue", "btn btn--ghost"));
    return;
  }
  renderQueue();
}

chrome.runtime.onMessage.addListener((message: PanelMessage) => {
  if (message.type !== "queue:update") return;
  const row = rows.get(message.applicationId);
  if (!row) return;
  update(row, stateFor(message));
  renderQueue();
});

refresh.addEventListener("click", () => void load());
// The panel stays open beside the dashboard, so reload when the reader comes back to it after approving something there.
window.addEventListener("focus", () => void load());

void load();
