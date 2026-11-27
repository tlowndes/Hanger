import * as E from "../core/errands";
import { SHOPPING, shoppingOpen } from "../core/meals";
import type { VaultPort } from "./ports";

export async function loadPlaces(port: VaultPort): Promise<E.Place[]> {
  return E.parsePlaces((await port.exists(E.PLACES)) ? await port.read(E.PLACES) : null);
}
export async function loadShopping(port: VaultPort): Promise<string[]> {
  return (await port.exists(SHOPPING)) ? shoppingOpen(await port.read(SHOPPING)) : [];
}
