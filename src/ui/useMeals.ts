import { useCallback, useEffect, useRef, useState } from "react";
import * as M from "../core/meals";
import { addDays, dayText, parseDay } from "../core/md";
import * as S from "../services/mealsService";
import { today, type VaultPort } from "../services/ports";

export interface MealsState {
  /** The Monday of the week shown. */
  monday: string;
  days: M.MealDay[];
  recipes: M.Recipe[];
  shopping: M.ShopItem[];
  loading: boolean;
  error: string | null;
  /** What the last "Add to shopping list" did, e.g. "Added 4 to your shopping list." */
  note: string | null;
  clearError(): void;
  shift(weeks: number): void;
  thisWeek(): void;
  setDay(date: string, recipe: string | null, text?: string | null): Promise<void>;
  addShopping(): Promise<void>;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function useMeals(port: VaultPort): MealsState {
  const [monday, setMonday] = useState(() => M.monday(today()));
  const [days, setDays] = useState<M.MealDay[]>(() => M.parse(null, M.monday(today())));
  const [recipes, setRecipes] = useState<M.Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([S.recipes(port), S.loadWeek(port, monday)]);
      setRecipes(r);
      setDays(d);
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [port, monday]);
  useEffect(() => void load(), [load]);

  return {
    monday, days, recipes, loading, error, note,
    shopping: M.shopping(days, recipes),
    clearError: () => setError(null),
    shift: (weeks) => {
      setNote(null);
      setMonday((m) => dayText(addDays(parseDay(m), weeks * 7)));
    },
    thisWeek: () => {
      setNote(null);
      setMonday(M.monday(today()));
    },
    setDay: (date, recipe, text = null) => {
      const next = M.set(days, date, recipe, text);
      setDays(next);
      const job = () => S.saveWeek(port, next);
      const run = queue.current.then(job, job).then(() => undefined, (e) => { setError(message(e)); return load(); });
      queue.current = run;
      return run;
    },
    addShopping: async () => {
      try {
        const n = await S.addToShopping(port, M.shopping(days, recipes).map((s) => s.text));
        setNote(n === 0 ? "Everything is already on your shopping list." : `Added ${n} to your shopping list.`);
      } catch (e) {
        setError(message(e));
      }
    },
  };
}
