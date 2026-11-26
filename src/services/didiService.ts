import * as D from "../core/didi";
import type { VaultPort } from "./ports";

export interface Today {
  checks: D.Check[];
  stamps: D.Stamp[];
}

async function readOr(port: VaultPort, path: string): Promise<string | null> {
  return (await port.exists(path)) ? port.read(path) : null;
}

export async function loadChecks(port: VaultPort): Promise<D.Check[]> {
  let text = await readOr(port, D.CHECKS_PATH);
  if (text === null) {
    await port.write(D.CHECKS_PATH, D.STARTER);
    text = D.STARTER;
  }
  return D.checks(text);
}

export async function loadToday(port: VaultPort, day: string): Promise<Today> {
  const [checks, log] = await Promise.all([loadChecks(port), readOr(port, D.logPath(day))]);
  return { checks, stamps: log ? D.stamps(log) : [] };
}

/** Logs a tap. Makes the day's note when it isn't there yet. */
export async function stamp(port: VaultPort, day: string, s: D.Stamp): Promise<void> {
  const path = D.logPath(day);
  const text = (await readOr(port, path)) ?? D.header(day);
  await port.write(path, D.addStamp(text, s));
}

export async function undo(port: VaultPort, day: string, s: D.Stamp): Promise<void> {
  const path = D.logPath(day);
  const text = await readOr(port, path);
  if (text !== null) await port.write(path, D.removeStamp(text, s));
}

export async function addCheck(port: VaultPort, c: D.Check): Promise<void> {
  const text = (await readOr(port, D.CHECKS_PATH)) ?? D.STARTER;
  await port.write(D.CHECKS_PATH, D.addCheck(text, c));
}
