import type { VaultPort } from "../src/services/ports";

/** An in-memory vault for tests. */
export class MemoryVault implements VaultPort {
  files = new Map<string, string>();
  writes: string[] = [];
  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.files.set(k, v);
  }
  async list(dir: string) {
    const prefix = dir.replace(/\/+$/, "") + "/";
    return [...this.files.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/")).map((k) => k.slice(prefix.length)).sort();
  }
  async read(path: string) {
    const v = this.files.get(path);
    if (v === undefined) throw new Error(`No note at ${path}`);
    return v;
  }
  async write(path: string, text: string) {
    this.files.set(path, text);
    this.writes.push(path);
  }
  async remove(path: string) {
    this.files.delete(path);
  }
  async exists(path: string) {
    return this.files.has(path);
  }
  async dirs(dir: string) {
    const prefix = dir.replace(/\/+$/, "") + "/";
    return [...new Set([...this.files.keys()].filter((k) => k.startsWith(prefix) && k.slice(prefix.length).includes("/")).map((k) => k.slice(prefix.length).split("/")[0]))].sort();
  }
  async findFolder(name: "People" | "Recipes") {
    const keys = [...this.files.keys()];
    if (keys.some((k) => k.startsWith(`${name}/`))) return name;
    return keys.map((k) => k.split("/").slice(0, 2).join("/")).find((k) => k.split("/")[1] === name) ?? null;
  }
}
