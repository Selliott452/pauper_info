import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchArchetypes,
  fetchCardNames,
  fetchDecks,
  fetchDecksCount,
  type DeckListQuery,
  type DeckSummary,
} from "./api";
import { ColorSymbols } from "./ManaSymbols";
import { MultiCombobox } from "./ComboBox";
import { ColorFilter } from "./ColorFilter";
import { SearchInput } from "./SearchInput";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SortableTh } from "./SortableTh";
import { Loading, ErrorText } from "./QueryState";

type SortKey = "name" | "archetype" | "author" | "colors";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: [SortKey, string][] = [
  ["name", "Deck"],
  ["archetype", "Archetype"],
  ["author", "Author"],
  ["colors", "Colors"],
];

// Missing values always sort to the bottom regardless of direction.
function compareDecks(a: DeckSummary, b: DeckSummary, sort: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (sort) {
    case "name":
      return compareNullable(a.name, b.name, sign);
    case "archetype":
      return compareNullable(a.archetype, b.archetype, sign);
    case "author":
      return compareNullable(a.author, b.author, sign);
    case "colors":
      return a.colors.join("").localeCompare(b.colors.join("")) * sign;
  }
}

function compareNullable(x: string | null, y: string | null, sign: number): number {
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return x.localeCompare(y) * sign;
}

export function DecksPage() {
  // Filter state lives in the URL so it persists across navigation/refresh.
  const [params, setParams] = useSearchParams();
  const colors = params.get("colors")?.split(",").filter(Boolean) ?? [];
  const colorMatch = params.get("colorMatch") === "exact" ? "exact" : "within";
  const author = params.get("author") ?? "";
  const name = params.get("name") ?? "";
  const archetypes = params.getAll("archetypes");
  const confidences = params.get("confidence")?.split(",").filter(Boolean) ?? [];
  const mainboardCards = params.getAll("mainboardCards");
  const sideboardCards = params.getAll("sideboardCards");

  // Sort column + direction persist in the URL. Unset by default: the table shows
  // in the API's natural order until a header is clicked.
  const sort = params.get("sort") as SortKey | null;
  const dir = (params.get("dir") as SortDir) ?? "asc";

  function setSort(key: SortKey) {
    const nextDir = sort === key ? (dir === "asc" ? "desc" : "asc") : "asc";
    const next = new URLSearchParams(params);
    next.set("sort", key);
    next.set("dir", nextDir);
    setParams(next, { replace: true });
  }

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  function setListParam(key: string, values: string[]) {
    const next = new URLSearchParams(params);
    next.delete(key);
    for (const v of values) next.append(key, v);
    setParams(next, { replace: true });
  }

  const { data: cardNames } = useQuery({
    queryKey: ["card-names"],
    queryFn: fetchCardNames,
    staleTime: Infinity,
  });

  const { data: archetypeList } = useQuery({
    queryKey: ["archetypes"],
    queryFn: fetchArchetypes,
    staleTime: Infinity,
  });
  const archetypeNames = archetypeList?.map((a) => a.name);

  // Debounce filters so typing doesn't fire a request per keystroke.
  const [applied, setApplied] = useState<DeckListQuery>({ limit: 100 });
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied({
        colors: colors.length ? colors : undefined,
        colorMatch,
        author: author.trim() || undefined,
        name: name.trim() || undefined,
        archetypes: archetypes.length ? archetypes : undefined,
        confidences: confidences.length ? confidences : undefined,
        mainboardCards: mainboardCards.length ? mainboardCards : undefined,
        sideboardCards: sideboardCards.length ? sideboardCards : undefined,
        limit: 100,
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["decks", applied],
    queryFn: () => fetchDecks(applied),
  });

  const { data: totalCount } = useQuery({
    queryKey: ["decks-count", applied],
    queryFn: () => fetchDecksCount(applied),
  });

  function toggleColor(code: string) {
    const next = colors.includes(code)
      ? colors.filter((c) => c !== code)
      : [...colors, code];
    setParam("colors", next.join(","));
  }

  function toggleConfidence(level: string) {
    const next = confidences.includes(level)
      ? confidences.filter((c) => c !== level)
      : [...confidences, level];
    setParam("confidence", next.join(","));
  }

  // Count active filters (each group counts once) to label and gate "Clear all".
  const activeFilters =
    (name ? 1 : 0) +
    (author ? 1 : 0) +
    (colors.length ? 1 : 0) +
    (archetypes.length ? 1 : 0) +
    (confidences.length ? 1 : 0) +
    (mainboardCards.length ? 1 : 0) +
    (sideboardCards.length ? 1 : 0);

  function clearFilters() {
    const next = new URLSearchParams(params);
    for (const key of [
      "name",
      "author",
      "colors",
      "colorMatch",
      "archetypes",
      "confidence",
      "mainboardCards",
      "sideboardCards",
    ]) {
      next.delete(key);
    }
    setParams(next, { replace: true });
  }

  return (
    <main className="page">
      <h1>Decks</h1>

      <div className="filter-panel">
        <div className="filter-row">
          <SearchInput
            value={name}
            onChange={(v) => setParam("name", v)}
            placeholder="Deck name…"
            width={220}
            ariaLabel="Search deck name"
          />
          <SearchInput
            value={author}
            onChange={(v) => setParam("author", v)}
            placeholder="Author…"
            width={200}
            ariaLabel="Search author"
          />
          {activeFilters > 0 && (
            <button className="filter-clear" onClick={clearFilters}>
              <span className="filter-clear-count">{activeFilters}</span>
              Clear all
            </button>
          )}
        </div>

        <ColorFilter
          noun="Decks"
          selected={colors}
          onToggle={toggleColor}
          colorMatch={colorMatch}
          onColorMatch={(v) => setParam("colorMatch", v)}
        />

        <MultiCombobox
          label="Archetype"
          options={archetypeNames}
          value={archetypes}
          onChange={(next) => setListParam("archetypes", next)}
          placeholder="Add an archetype…"
        />

        <div className="filter-row">
          <span className="filter-label">Confidence</span>
          {["High", "Medium", "Low"].map((level) => (
            <button
              key={level}
              className={`pill ${confidences.includes(level) ? "active" : ""}`}
              onClick={() => toggleConfidence(level)}
            >
              {level}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <MultiCombobox
            label="Mainboard"
            options={cardNames}
            value={mainboardCards}
            onChange={(next) => setListParam("mainboardCards", next)}
            placeholder="Add a card…"
          />
          <MultiCombobox
            label="Sideboard"
            options={cardNames}
            value={sideboardCards}
            onChange={(next) => setListParam("sideboardCards", next)}
            placeholder="Add a card…"
          />
        </div>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorText message="Failed to load decks." />}

      {data && totalCount != null && (
        <p className="result-count">
          {totalCount.toLocaleString()} deck{totalCount === 1 ? "" : "s"}
          {totalCount > data.length && ` (showing first ${data.length})`}
        </p>
      )}

      {data && (
        <table className="data-table">
          <thead>
            <tr>
              {SORT_COLUMNS.map(([col, label]) => (
                <SortableTh key={col} label={label} active={sort === col} dir={dir} onClick={() => setSort(col)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {(sort ? [...data].sort((a, b) => compareDecks(a, b, sort, dir)) : data).map((deck) => (
              <tr key={deck.id}>
                <td data-label="Deck">
                  <Link to={`/decks/${encodeURIComponent(deck.id)}`}>{deck.name ?? "(untitled deck)"}</Link>
                </td>
                <td data-label="Archetype">
                  {deck.archetype ? (
                    <>
                      <Link to={`/archetypes/${encodeURIComponent(deck.archetype)}`}>{deck.archetype}</Link>
                      <ConfidenceBadge level={deck.archetypeConfidence} />
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td data-label="Author">{deck.author ?? "-"}</td>
                <td data-label="Colors">
                  <ColorSymbols colors={deck.colors} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
