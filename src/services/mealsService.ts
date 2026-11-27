import * as M from "../core/meals";
import { fmGet, toLines } from "../core/md";
import type { VaultPort } from "./ports";

const folder = async (port: VaultPort): Promise<string> => (await port.findFolder("Recipes")) ?? "Recipes";

/** Every recipe note, A to Z. Meal plan notes in the same folder are skipped. */
export async function recipes(port: VaultPort): Promise<M.Recipe[]> {
  const dir = await folder(port);
  const out: M.Recipe[] = [];
  for (const n of (await port.list(dir)).filter((f) => f.endsWith(".md"))) {
    try {
      const text = await port.read(`${dir}/${n}`);
      if (fmGet(toLines(text), "type")?.trim().toLowerCase() === "meal-plan") continue;
      out.push(M.parseRecipe(`${dir}/${n}`, text));
    } catch {
      /* skip a note that can't be read */
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
}

export async function loadWeek(port: VaultPort, monday: string): Promise<M.MealDay[]> {
  const path = `${await folder(port)}/${M.weekFile(monday)}`;
  return M.parse((await port.exists(path)) ? await port.read(path) : null, monday);
}

export async function saveWeek(port: VaultPort, days: M.MealDay[]): Promise<void> {
  await port.write(`${await folder(port)}/${M.weekFile(days[0].date)}`, M.markdown(days));
}

/** Adds the items to the Shopping list note (made if missing). Returns how many were new. */
export async function addToShopping(port: VaultPort, items: string[]): Promise<number> {
  const text = (await port.exists(M.SHOPPING)) ? await port.read(M.SHOPPING) : "# Shopping list\n\n";
  const r = M.withShopping(text, items);
  if (r.added > 0) await port.write(M.SHOPPING, r.text);
  return r.added;
}
