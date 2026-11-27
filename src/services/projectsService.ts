import * as P from "../core/projects";
import { toLines } from "../core/md";
import type { VaultPort } from "./ports";

/** Every project folder with its note, e.g. `03 - Projects/Hanger/Hanger.md`. Folders without a matching note are skipped. */
export async function list(port: VaultPort): Promise<P.Project[]> {
  const root = await port.findFolder("Projects");
  if (!root) return [];
  const out: P.Project[] = [];
  for (const title of await port.dirs(root)) {
    const path = `${root}/${title}/${title}.md`;
    try {
      if (await port.exists(path)) out.push(P.parse(title, path, await port.read(path)));
    } catch {
      /* skip a note that can't be read */
    }
  }
  return out;
}

export async function setStatus(port: VaultPort, path: string, status: string): Promise<void> {
  const lines = toLines(await port.read(path));
  P.setStatus(lines, status);
  await port.write(path, lines.join("\n").replace(/\n*$/, "\n"));
}
