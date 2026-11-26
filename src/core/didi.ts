/** Did I?: one tap logs "door locked" or "took meds" with the time. Same notes as Flight Deck's DidI.kt. */

export const DIDI_DIR = "99 - Meta";
export const CHECKS_PATH = `${DIDI_DIR}/Did I checks.md`;
export const LOG_DIR = `${DIDI_DIR}/Did I`;
export const logPath = (day: string): string => `${LOG_DIR}/${day}.md`;

export const STARTER = `# Did I?

One check per line: emoji, name, then an optional question after a ·.
Hanger and Flight Deck log each tap with the time in the Did I folder.

- 💊 Meds · Taken your meds?
- 🔒 Door · Is the door locked?
- 🔥 Hob · Is the hob off?
`;

export interface Check {
  emoji: string;
  name: string;
  question: string;
  /** A Home Assistant link (`ha sensor.x < 5`), kept as written so it round-trips. */
  link: string | null;
}
export interface Stamp {
  time: string; // HH:mm
  name: string;
  auto: boolean;
}
export interface Status {
  check: Check;
  at: string | null;
}

const CHECK_LINE = /^\s*[-*]\s+(?!\[)(.+?)\s*$/;
const STAMP_LINE = /^\s*-\s+(\d{2}:\d{2})\s*·\s*(.+?)\s*$/;
const HA = /^ha\s+\S/i;

export function checks(text: string): Check[] {
  const out: Check[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const whole = CHECK_LINE.exec(line)?.[1];
    if (!whole) continue;
    const parts = whole.split("·").map((p) => p.trim());
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const link = HA.test(last) ? last : null;
    const body = (link ? parts.slice(0, -1) : parts).join(" · ");
    const main = body.split("·")[0].trim();
    const question = body.includes("·") ? body.slice(body.indexOf("·") + 1).trim() : "";
    const first = main.split(" ")[0];
    const hasEmoji = first.length > 0 && !/^[\p{L}\p{N}]/u.test(first) && main.includes(" ");
    const emoji = hasEmoji ? first : "✓";
    const name = (hasEmoji ? main.slice(first.length + 1) : main).trim();
    if (!name) continue;
    out.push({ emoji, name, question: question || `${name} done?`, link });
  }
  const seen = new Set<string>();
  return out.filter((c) => !seen.has(c.name.toLowerCase()) && !!seen.add(c.name.toLowerCase()));
}

export const checkLine = (c: Check): string =>
  (c.question === `${c.name} done?` ? `- ${c.emoji} ${c.name}` : `- ${c.emoji} ${c.name} · ${c.question}`) + (c.link ? ` · ${c.link}` : "");

/** Adds a check after the last check line (or at the end). No change if the name is already there. */
export function addCheck(text: string, c: Check): string {
  if (checks(text).some((x) => x.name.toLowerCase() === c.name.toLowerCase())) return text;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let last = -1;
  lines.forEach((l, i) => CHECK_LINE.test(l) && (last = i));
  if (last >= 0) lines.splice(last + 1, 0, checkLine(c));
  else {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push("", checkLine(c));
  }
  return lines.join("\n").replace(/\n*$/, "\n");
}

/** The note for one day: `# Did I? · Thursday 26 November 2026`. */
export function header(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", o).format(dt);
  const text = `${part({ weekday: "long" })} ${d} ${part({ month: "long" })} ${y}`;
  return `# Did I? · ${text}\n\n`;
}

export const stampLine = (s: Stamp): string => `- ${s.time} · ${s.name}${s.auto ? " · auto" : ""}`;

export function stamps(text: string): Stamp[] {
  const out: Stamp[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const m = STAMP_LINE.exec(line);
    if (!m) continue;
    const auto = /\s*·\s*auto$/.test(m[2]);
    out.push({ time: m[1], name: auto ? m[2].replace(/\s*·\s*auto$/, "").trim() : m[2], auto });
  }
  return out;
}

export function addStamp(text: string, s: Stamp): string {
  return text.replace(/\s+$/, "") + "\n" + stampLine(s) + "\n";
}

/** Removes the newest line for the stamp (Undo). Returns the text unchanged if it isn't there. */
export function removeStamp(text: string, s: Stamp): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const want = stampLine(s);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === want) {
      lines.splice(i, 1);
      return lines.join("\n");
    }
  }
  return text;
}

export const status = (cs: Check[], ss: Stamp[]): Status[] =>
  cs.map((check) => ({
    check,
    at: ss.filter((s) => s.name.toLowerCase() === check.name.toLowerCase()).map((s) => s.time).sort().pop() ?? null,
  }));

export const nextOpen = (st: Status[]): Status | null => st.find((s) => s.at === null) ?? null;

export function progress(st: Status[]): string {
  const done = st.filter((s) => s.at !== null).length;
  return st.length > 0 && done === st.length ? "All done" : `${done} of ${st.length}`;
}

/** HH:mm in local time. */
export function hhmm(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getHours())}:${p(now.getMinutes())}`;
}
