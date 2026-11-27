import { useCallback, useEffect, useState } from "react";
import type { Place } from "../core/errands";
import * as S from "../services/errandsService";
import type { VaultPort } from "../services/ports";

export interface ErrandsState {
  places: Place[];
  shopping: string[];
  error: string | null;
  reload(): Promise<void>;
}

export function useErrands(port: VaultPort): ErrandsState {
  const [places, setPlaces] = useState<Place[]>([]);
  const [shopping, setShopping] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([S.loadPlaces(port), S.loadShopping(port)]);
      setPlaces(p);
      setShopping(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read your places.");
    }
  }, [port]);
  useEffect(() => void reload(), [reload]);
  return { places, shopping, error, reload };
}
