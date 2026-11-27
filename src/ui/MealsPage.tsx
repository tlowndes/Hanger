import * as M from "../core/meals";
import { addDays, dayText, parseDay } from "../core/md";
import { today } from "../services/ports";
import type { MealsState } from "./useMeals";

const day = (d: string): string => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(parseDay(d));

export function MealsPage({ meals, back }: { meals: MealsState; back(): void }) {
  const t = today();
  const merged = M.mergedNote(meals.shopping);
  const sunday = dayText(addDays(parseDay(meals.monday), 6));
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Meals</h1>
          <p className="sub">Plan the week from your saved recipes. The shopping list merges what you still need. Same notes as Flight Deck.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {meals.error && <div className="banner" role="alert"><span>{meals.error}</span><button className="chip" onClick={meals.clearError}>Dismiss</button></div>}

      <div className="dadd" style={{ marginTop: 0, marginBottom: 12 }}>
        <button className="chip" onClick={() => meals.shift(-1)} aria-label="Previous week">←</button>
        <b>{day(meals.monday)} to {day(sunday)}</b>
        <button className="chip" onClick={() => meals.shift(1)} aria-label="Next week">→</button>
        <button className="chip" onClick={meals.thisWeek}>This week</button>
        <small className="sub">{M.planned(meals.days)} of 7 planned</small>
      </div>

      <section className="hu">
        <ul className="hulist">
          {meals.days.map((d) => (
            <li key={d.date} style={{ flexWrap: "wrap" }}>
              <b style={{ minWidth: 96, ...(d.date === t ? {} : { color: "var(--muted)" }) }}>{day(d.date)}</b>
              <select
                style={{ flex: 1, minWidth: 180 }}
                value={d.recipe !== null ? `r:${d.recipe}` : d.text !== null ? `t:${d.text}` : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  void meals.setDay(d.date, v.startsWith("r:") ? v.slice(2) : null, v.startsWith("t:") ? v.slice(2) : null);
                }}
                aria-label={`Meal for ${day(d.date)}`}
              >
                <option value="">Nothing planned</option>
                <optgroup label="Quick">
                  {M.QUICK.map((q) => <option key={q} value={`t:${q}`}>{q}</option>)}
                  {d.text !== null && !M.QUICK.includes(d.text) && <option value={`t:${d.text}`}>{d.text}</option>}
                </optgroup>
                <optgroup label="Recipes">
                  {meals.recipes.map((r) => <option key={r.path} value={`r:${r.title}`}>{r.title}</option>)}
                  {d.recipe !== null && !meals.recipes.some((r) => r.title === d.recipe) && <option value={`r:${d.recipe}`}>{d.recipe}</option>}
                </optgroup>
              </select>
            </li>
          ))}
        </ul>
        {meals.recipes.length === 0 && !meals.loading && <p className="hunote">No saved recipes found. Save some from Flight Deck and they appear here.</p>}
      </section>

      <section className="hu">
        <div className="row">
          <h2>Shopping for the week ({meals.shopping.length})</h2>
          <button className="btn" disabled={meals.shopping.length === 0} onClick={() => void meals.addShopping()}>Add to shopping list</button>
        </div>
        {meals.note && <p className="hunote" role="status">{meals.note}</p>}
        {meals.shopping.length === 0 ? <p className="hunote">Nothing to buy yet. Plan a recipe and its unticked ingredients appear here.</p> : (
          <>
            <ul className="hulist">
              {meals.shopping.map((s) => <li key={s.text}><span style={{ flex: 1 }}>{s.text}</span><small>{s.from.join(" + ")}</small></li>)}
            </ul>
            {merged && <p className="hunote">{merged}</p>}
          </>
        )}
      </section>
    </div>
  );
}
