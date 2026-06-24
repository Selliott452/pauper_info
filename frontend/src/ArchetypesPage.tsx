import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { fetchArchetypes, type ArchetypeSummary } from "./api";
import { ColorIdentity } from "./ManaSymbols";
import { ColorFilter } from "./ColorFilter";
import { SortableTh } from "./SortableTh";
import { Loading, ErrorText } from "./QueryState";
import { COLORS } from "./colors";
import { winrateColor } from "./winrate";

type SortKey = "name" | "decks" | "winrate" | "matches" | "representation";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: [SortKey, string, "left" | "right"][] = [
  ["name", "Archetype", "left"],
  ["decks", "Decks", "right"],
  ["representation", "Deck share", "right"],
  ["winrate", "Win rate", "right"],
  ["matches", "Games", "right"],
];

// Does an archetype's color identity match the selected color filter?
function colorMatches(
  archetypeColors: string[],
  selectedNames: string[],
  exact: boolean,
  includeColorless: boolean,
): boolean {
  if (selectedNames.length === 0 && !includeColorless) return true; // no filter
  const isColorless = archetypeColors.length === 0;
  if (isColorless) return includeColorless;
  if (selectedNames.length === 0) return false; // only colorless requested
  const selected = new Set(selectedNames);
  return exact
    ? archetypeColors.length === selected.size && archetypeColors.every((c) => selected.has(c))
    : archetypeColors.every((c) => selected.has(c)); // within identity
}

export function ArchetypesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["archetypes"],
    queryFn: fetchArchetypes,
  });

  // Search persists in the URL like the other pages.
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";

  function setSearch(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

  // Sort column + direction also persist in the URL. Default: most decks first.
  const sort = (params.get("sort") as SortKey) ?? "decks";
  const dir = (params.get("dir") as SortDir) ?? "desc";

  // Click a header to sort by it; click the active one again to flip direction.
  // A newly-selected column starts ascending for text, descending for numbers.
  function setSort(key: SortKey) {
    const nextDir = sort === key ? (dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc";
    const next = new URLSearchParams(params);
    next.set("sort", key);
    next.set("dir", nextDir);
    setParams(next, { replace: true });
  }

  // Color filter (client-side, on the colors already in the list response).
  const selectedCodes = params.get("colors")?.split(",").filter(Boolean) ?? [];
  const colorMatch = params.get("colorMatch") === "exact" ? "exact" : "within";
  const includeColorless = selectedCodes.includes("C");
  const selectedNames = COLORS.filter((c) => selectedCodes.includes(c.code)).map((c) => c.name);

  function toggleColor(code: string) {
    const next = selectedCodes.includes(code)
      ? selectedCodes.filter((c) => c !== code)
      : [...selectedCodes, code];
    const params2 = new URLSearchParams(params);
    if (next.length) params2.set("colors", next.join(","));
    else params2.delete("colors");
    setParams(params2, { replace: true });
  }

  function setColorMatch(value: "within" | "exact") {
    const next = new URLSearchParams(params);
    next.set("colorMatch", value);
    setParams(next, { replace: true });
  }

  const term = search.trim().toLowerCase();
  const totalDecks = (data ?? []).reduce((sum, a) => sum + a.deckCount, 0);
  const rows = (data ?? [])
    .filter((a) => !term || a.name.toLowerCase().includes(term))
    .filter((a) => colorMatches(a.colors, selectedNames, colorMatch === "exact", includeColorless))
    .sort((a, b) => compareRows(a, b, sort, dir));

  return (
    <main className="page">
      <h1>Pauper Archetypes</h1>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">Search</span>
          <input
            type="text"
            className="text-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archetype…"
            style={{ width: 280 }}
          />
        </div>

        <ColorFilter
          noun="Archetypes"
          selected={selectedCodes}
          onToggle={toggleColor}
          colorMatch={colorMatch}
          onColorMatch={setColorMatch}
          colorless
        />
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorText message="Failed to load archetypes." />}

      {data && (
        <>
          <p className="result-count">
            {rows.length} archetype{rows.length === 1 ? "" : "s"}
          </p>
          <table className="data-table">
            <thead>
              <tr>
                {SORT_COLUMNS.map(([col, label, align]) => (
                  <SortableTh key={col} label={label} align={align} active={sort === col} dir={dir} onClick={() => setSort(col)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.name}>
                  <td>
                    <Link to={`/archetypes/${encodeURIComponent(a.name)}`}>{a.name}</Link>
                    <span style={{ marginLeft: 6 }}>
                      <ColorIdentity colors={a.colors} />
                    </span>
                  </td>
                  <td className="num">{a.deckCount.toLocaleString()}</td>
                  <td className="num">{totalDecks > 0 ? `${((a.deckCount / totalDecks) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="num" style={{ color: a.overallWinrate != null ? winrateColor(a.overallWinrate) : "#999" }}>
                    {a.overallWinrate != null ? `${a.overallWinrate}%` : "—"}
                  </td>
                  <td className="num">{a.overallMatches != null ? a.overallMatches.toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

// Compares two archetypes by the active column. Missing win-rate/games values
// always sort to the bottom regardless of direction. "Representation" is
// proportional to deck count, so it orders identically to "Decks".
function compareRows(a: ArchetypeSummary, b: ArchetypeSummary, sort: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (sort) {
    case "name":
      return a.name.localeCompare(b.name) * sign;
    case "decks":
    case "representation":
      return (a.deckCount - b.deckCount) * sign;
    case "winrate":
      return compareNullable(a.overallWinrate, b.overallWinrate, sign);
    case "matches":
      return compareNullable(a.overallMatches, b.overallMatches, sign);
  }
}

// Numeric compare with nulls forced last (independent of sort direction).
function compareNullable(x: number | null, y: number | null, sign: number): number {
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return (x - y) * sign;
}
