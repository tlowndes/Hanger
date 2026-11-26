/** Cool-off and Refill notes, plus the Did I? history Refill counts from. */
import * as C from "../core/cooloff";
import * as D from "../core/didi";
import * as LP from "../core/launchpad";
import * as LS from "../core/lastseen";
import * as PP from "../core/pocketpass";
import * as R from "../core/refill";
import * as RR from "../core/returns";
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

// ---- Return Radar and Pocket Pass ----

export async function loadReturns(port: VaultPort): Promise<RR.Return[]> {
  return RR.parse(await readOr(port, RR.NOTE, RR.STARTER));
}
export async function saveReturns(port: VaultPort, rs: RR.Return[]): Promise<void> {
  await port.write(RR.NOTE, RR.render(await readOr(port, RR.NOTE, RR.STARTER), rs));
}
export async function loadCodes(port: VaultPort): Promise<PP.Code[]> {
  return PP.parse(await readOr(port, PP.NOTE, PP.STARTER));
}
export async function saveCodes(port: VaultPort, cs: PP.Code[]): Promise<void> {
  await port.write(PP.NOTE, PP.render(await readOr(port, PP.NOTE, PP.STARTER), cs));
}

// ---- Last Seen ----
export async function loadSeen(port: VaultPort): Promise<LS.Seen[]> {
  return LS.parse(await readOr(port, LS.NOTE, LS.STARTER));
}
export async function saveSeen(port: VaultPort, items: LS.Seen[], today: string): Promise<void> {
  await port.write(LS.NOTE, LS.render(await readOr(port, LS.NOTE, LS.STARTER), LS.prune(items, today)));
}

// ---- Launch Pad ----

/** The Launch Pad kit note, written from the starter the first time. */
export async function loadLaunchKit(port: VaultPort): Promise<LP.Kit> {
  return LP.parse(await readOr(port, LP.NOTE, LP.STARTER));
}
