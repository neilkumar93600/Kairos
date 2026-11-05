const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML element content and quoted attributes. Everything a database or employer string prints goes through it. */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** One line of plain text from untrusted input (a job title, a name): control characters and runs of space collapse to one space. */
export const oneLine = (s: string, max = 200) => s.replace(/[\u0000-\u001f\u007f\u2028\u2029\s]+/g, " ").trim().slice(0, max);
