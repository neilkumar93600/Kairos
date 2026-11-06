/** RFC 5545 3.3.11 TEXT: backslash, semicolon, comma and line breaks escaped; other control characters and Unicode line separators cannot appear in a value. */
export function icsText(s: string): string {
  return (
    s
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
  );
}

/** RFC 5545 3.1: at most 75 octets a line, continued with CRLF and a space, never inside a UTF-8 character. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let octets = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (octets + n > 75) {
      out.push(cur);
      cur = " ";
      octets = 1;
    }
    cur += ch;
    octets += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export interface IcsInterview {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  notes: string;
  updatedAt: Date;
}

/**
 * One interview as a calendar file. The times are UTC with the Z suffix (RFC 5545 form 2): an explicit instant that needs no
 * VTIMEZONE block and that a calendar shows in the viewer's own zone. User text only ever lands inside an escaped value, so it
 * cannot start a property.
 */
export function interviewIcs(iv: IcsInterview, title: string, company: string, now = new Date()): string {
  const end = new Date(iv.startsAt.getTime() + iv.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kairos//Interviews//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${iv.id}@kairos.app`,
    `DTSTAMP:${stamp(now)}`,
    `LAST-MODIFIED:${stamp(iv.updatedAt)}`,
    `DTSTART:${stamp(iv.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${icsText(`Interview: ${title} at ${company}`)}`,
    ...(iv.location ? [`LOCATION:${icsText(iv.location)}`] : []),
    ...(iv.notes ? [`DESCRIPTION:${icsText(iv.notes)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
