import * as P from "../core/people";
import { toLines } from "../core/md";
import type { VaultPort } from "./ports";

const folder = async (port: VaultPort): Promise<string> => (await port.findFolder("People")) ?? P.DIR;

export async function list(port: VaultPort): Promise<P.Person[]> {
  const dir = await folder(port);
  const names = (await port.list(dir)).filter((n) => n.endsWith(".md"));
  const out: P.Person[] = [];
  for (const n of names) {
    try {
      out.push(P.parse(`${dir}/${n}`, await port.read(`${dir}/${n}`)));
    } catch {
      /* a note that can't be read is skipped */
    }
  }
  return out.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** Re-reads the note, changes it and writes it back, so an edit made in Obsidian meanwhile isn't lost. */
export async function edit(port: VaultPort, path: string, change: (lines: string[]) => void): Promise<void> {
  const lines = toLines(await port.read(path));
  change(lines);
  await port.write(path, lines.join("\n").replace(/\n*$/, "\n"));
}

export async function create(port: VaultPort, name: string, birthday: string | null, every: number | null): Promise<string> {
  const dir = await folder(port);
  const c = P.created(name, birthday, every);
  let file = c.file;
  for (let i = 2; await port.exists(`${dir}/${file}`); i++) file = c.file.replace(/\.md$/, ` ${i}.md`);
  await port.write(`${dir}/${file}`, c.text);
  return `${dir}/${file}`;
}
