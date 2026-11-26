/** Cool-off and Refill notes, plus the Did I? history Refill counts from. */
import * as C from "../core/cooloff";
import * as D from "../core/didi";
import * as R from "../core/refill";
import { addDays, dayText, parseDay } from "../core/md";
import type { VaultPort } from "./ports";

async function readOr(port: VaultPort, path: string, starter: string): Promise<string> {
  if (await port.exists(path)) return port.read(path);
  await port.write(path, starter);
  return starter;
}

export async function loadCool(port: VaultPort): Promise<C.Item[]> {
  return C.parse(await readOr(port, C.NOTE, C.STARTER));
}
/** Rewrites the list part of the note with `items`, keeping its header. */
export async function saveCool(port: VaultPort, items: C.Item[]): Promise<void> {
  await port.write(C.NOTE, C.render(await readOr(port, C.NOTE, C.STARTER), items));
}

export async function loadMeds(port: VaultPort): Promise<R.Med[]> {
  return R.parse(await readOr(port, R.NOTE, R.STARTER));
}
export async function saveMeds(port: VaultPort, meds: R.Med[]): Promise<void> {
  await port.write(R.NOTE, R.render(await readOr(port, R.NOTE, R.STARTER), meds));
}

/** Did I? stamps from the oldest count up to `today`, at most 120 days back. */
export async function didiHistory(port: VaultPort, meds: R.Med[], today: string): Promise<R.DatedStamp[]> {
  if (!meds.length) return [];
  const oldest = dayText(meds.reduce((a, m) => (m.counted < a ? m.counted : a), meds[0].counted));
  const floor = dayText(addDays(parseDay(today), -R.MAX_DAYS));
  const out: R.DatedStamp[] = [];
  for (let d = parseDay(oldest > floor ? oldest : floor); dayText(d) <= today; d = addDays(d, 1)) {
    const day = dayText(d);
    if (await port.exists(D.logPath(day))) for (const stamp of D.stamps(await port.read(D.logPath(day)))) out.push({ day, stamp });
  }
  return out;
}
