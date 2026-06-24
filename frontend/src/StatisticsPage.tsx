import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  fetchCardStatistics,
  fetchDecksCount,
  type SortBy,
  type SortDirection,
  type StatisticsQuery,
} from "./api";
import { CardLink } from "./CardLink";
import { ColorSymbols } from "./ManaSymbols";
import { ColorFilter } from "./ColorFilter";
import { SortableTh } from "./SortableTh";
import { Loading, ErrorText } from "./QueryState";

const TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Land",
];

// Columns that map to a backend sort key, so headers are clickable.
const COLUMNS: { key: SortBy; label: string }[] = [
  { key: "NAME", label: "Name" },
  { key: "MAINBOARD_DECK_COUNT", label: "Mainboard decks" },
  { key: "SIDEBOARD_DECK_COUNT", label: "Sideboard decks" },
];

export function StatisticsPage() {
  // Filter state lives in the URL so it persists across navigation/refresh.
  const [params, setParams] = useSearchParams();
  const colors = params.get("colors")?.split(",").filter(Boolean) ?? [];
  const colorMatch = params.get("colorMatch") === "exact" ? "exact" : "within";
  const types = params.get("types")?.split(",").filter(Boolean) ?? [];
  const sortBy = (params.get("sortBy") as SortBy) ?? "MAINBOARD_DECK_COUNT";
  const direction = (params.get("direction") as SortDirection) ?? "DESC";
  const search = params.get("q") ?? "";

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  // Fetch the full result set for the current filters (the DB does the same
  // aggregation regardless of limit), so name search can filter client-side.
  const query: StatisticsQuery = { colors, colorMatch, types, sortBy, direction, limit: 20000 };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["card-statistics", query],
    queryFn: () => fetchCardStatistics(query),
  });

  // Total deck count, for the mainboard play-rate percentage.
  const { data: totalDecks } = useQuery({
    queryKey: ["decks-count", {}],
    queryFn: () => fetchDecksCount({}),
    staleTime: Infinity,
  });

  // Name search filters in-browser (no refetch). Cap rows so the DOM stays light.
  const term = search.trim().toLowerCase();
  const filtered = (data ?? []).filter(
    (c) => !term || c.name.toLowerCase().includes(term),
  );
  const rows = filtered.slice(0, term ? 300 : 100);

  function toggleColor(code: string) {
    const next = colors.includes(code)
      ? colors.filter((c) => c !== code)
      : [...colors, code];
    setParam("colors", next.join(","));
  }

  function toggleType(type: string) {
    const next = types.includes(type)
      ? types.filter((t) => t !== type)
      : [...types, type];
    setParam("types", next.join(","));
  }

  // Clicking a header sorts by it; clicking the active one flips direction.
  function sortByColumn(key: SortBy) {
    if (key === sortBy) {
      setParam("direction", direction === "ASC" ? "DESC" : "ASC");
    } else {
      const next = new URLSearchParams(params);
      next.set("sortBy", key);
      next.set("direction", "DESC");
      setParams(next, { replace: true });
    }
  }

  return (
    <main className="page">
      <h1>Pauper Card Statistics</h1>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">Search</span>
          <input
            type="text"
            className="text-input"
            value={search}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Search card name…"
            style={{ width: 280 }}
          />
        </div>

        <ColorFilter
          noun="Cards"
          selected={colors}
          onToggle={toggleColor}
          colorMatch={colorMatch}
          onColorMatch={(v) => setParam("colorMatch", v)}
          colorless
        />

        <div className="filter-row">
          <span className="filter-label">Types</span>
          {TYPES.map((t) => (
            <button
              key={t}
              className={`pill ${types.includes(t) ? "active" : ""}`}
              onClick={() => toggleType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorText message={`Error: ${String(error)}`} />}

      {data && (
        <p className="result-count">
          {filtered.length.toLocaleString()} card{filtered.length === 1 ? "" : "s"}
          {filtered.length > rows.length && ` (showing first ${rows.length})`}
        </p>
      )}

      {data && (
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <SortableTh
                  key={col.key}
                  label={col.label}
                  active={sortBy === col.key}
                  dir={direction === "ASC" ? "asc" : "desc"}
                  onClick={() => sortByColumn(col.key)}
                />
              ))}
              <th title="Share of all decks running this card in the mainboard">% of decks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((card) => (
              <tr key={card.id}>
                <td>
                  <CardLink name={card.name} />
                  {card.colors.length > 0 && (
                    <span style={{ marginLeft: 6 }}>
                      <ColorSymbols colors={card.colors} />
                    </span>
                  )}
                </td>
                <td>{card.mainboardDeckCount.toLocaleString()}</td>
                <td>{card.sideboardDeckCount.toLocaleString()}</td>
                <td>{totalDecks ? `${((card.mainboardDeckCount / totalDecks) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
