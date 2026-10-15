/** DOM helpers that fill forms the way a person would, so React-controlled inputs see the change. */

export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Escapes a value for use inside a double-quoted attribute selector. */
const attr = (value: string) => value.replace(/["\\]/g, "\\$&");

function labelTextFor(el: Field, doc: Document): string {
  const byFor = el.id ? doc.querySelector(`label[for="${attr(el.id)}"]`)?.textContent : null;
  const wrapping = el.closest("label")?.textContent;
  const aria = el.getAttribute("aria-label");
  const describedBy = el.getAttribute("aria-labelledby");
  const labelled = describedBy ? doc.getElementById(describedBy)?.textContent : null;
  return normalizeLabel(byFor ?? wrapping ?? aria ?? labelled ?? el.getAttribute("placeholder") ?? "");
}

/** Finds a field by exact name or id first, then by its visible label. */
export function findField(doc: Document, fieldKey: string, label: string): Field | null {
  const direct = doc.querySelector<Field>(`[name="${attr(fieldKey)}"], [id="${attr(fieldKey)}"]`);
  if (direct && ["INPUT", "TEXTAREA", "SELECT"].includes(direct.tagName)) return direct;
  const wanted = normalizeLabel(label);
  if (!wanted) return null;
  const fields = Array.from(doc.querySelectorAll<Field>("input:not([type=hidden]):not([type=file]), textarea, select"));
  return fields.find((f) => labelTextFor(f, doc) === wanted) ?? fields.find((f) => labelTextFor(f, doc).startsWith(wanted)) ?? null;
}

/** Sets a value through the native setter and fires input + change, which React and Vue listen for. */
export function setValue(el: Field, value: string): boolean {
  if (el instanceof HTMLSelectElement) {
    const option = Array.from(el.options).find((o) => normalizeLabel(o.text) === normalizeLabel(value) || o.value === value);
    if (!option) return false;
    el.value = option.value;
  } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    el.checked = ["yes", "true", "1"].includes(value.trim().toLowerCase());
  } else {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/** Downloads a file and drops it into a file input via DataTransfer. */
export async function attachFile(input: HTMLInputElement, url: string, filename: string): Promise<boolean> {
  const res = await fetch(url);
  if (!res.ok) return false;
  const blob = await res.blob();
  const transfer = new DataTransfer();
  transfer.items.add(new File([blob], filename, { type: blob.type || "application/pdf" }));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function waitFor<T>(check: () => T | null | undefined, timeoutMs: number, intervalMs = 250): Promise<T | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const value = check();
      if (value) return resolve(value);
      if (Date.now() - started > timeoutMs) return resolve(null);
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}
