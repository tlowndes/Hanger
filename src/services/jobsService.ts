import * as J from "../core/jobs";
import { toLines } from "../core/md";
import type { VaultPort } from "./ports";

export async function list(port: VaultPort): Promise<J.Job[]> {
  const out: J.Job[] = [];
  for (const n of (await port.list(J.DIR)).filter((f) => f.endsWith(".md"))) {
    try {
      const j = J.parse(`${J.DIR}/${n}`, await port.read(`${J.DIR}/${n}`));
      if (j) out.push(j);
    } catch {
      /* skip a note that can't be read */
    }
  }
  return out;
}

/** Re-reads the note, changes it and writes it back, so an edit made in Obsidian meanwhile isn't lost. */
export async function edit(port: VaultPort, path: string, change: (lines: string[]) => void): Promise<void> {
  const lines = toLines(await port.read(path));
  change(lines);
  await port.write(path, lines.join("\n").replace(/\n*$/, "\n"));
}

export async function create(port: VaultPort, company: string, role: string, today: string): Promise<string> {
  const template = (await port.exists(J.TEMPLATE)) ? await port.read(J.TEMPLATE) : null;
  const c = J.created(company, role, today, template);
  let file = c.file;
  for (let i = 2; await port.exists(`${J.DIR}/${file}`); i++) file = c.file.replace(/\.md$/, ` ${i}.md`);
  await port.write(`${J.DIR}/${file}`, c.text);
  return `${J.DIR}/${file}`;
}
