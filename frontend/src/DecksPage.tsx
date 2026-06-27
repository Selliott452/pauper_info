import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchArchetypes,
  fetchCardNames,
  fetchDecks,
  fetchDecksCount,
  type DeckListQuery,
} from "./api";
import { ColorSymbols } from "./ManaSymbols";
import { MultiCombobox } from "./ComboBox";
import { ColorFilter } from "./ColorFilter";
import { SearchInput } from "./SearchInput";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Loading, ErrorText } from "./QueryState";

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
              <th>Deck</th>
              <th>Archetype</th>
              <th>Author</th>
              <th>Colors</th>
            </tr>
          </thead>
          <tbody>
            {data.map((deck) => (
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
