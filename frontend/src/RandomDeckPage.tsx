import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { fetchArchetypes, fetchDeck, fetchRandomDeck } from "./api";
import { DeckView } from "./DeckPage";
import { ErrorText } from "./QueryState";

const WINDOWS = [
  { label: "Any time", days: "" },
  { label: "Past week", days: "7" },
  { label: "Past month", days: "30" },
  { label: "Past 3 months", days: "90" },
  { label: "Past year", days: "365" },
];

export function RandomDeckPage() {
  const { data: archetypes } = useQuery({ queryKey: ["archetypes"], queryFn: fetchArchetypes, staleTime: Infinity });

  // Filters persist in the URL so they survive back/forward navigation.
  const [params, setParams] = useSearchParams();
  const archetype = params.get("archetype") ?? "";
  const confidences = params.get("confidences")?.split(",").filter(Boolean) ?? [];
  const days = params.get("days") ?? "";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const pick = useMutation({
    mutationFn: () =>
      fetchRandomDeck({
        archetypes: archetype ? [archetype] : undefined,
        confidences: confidences.length ? confidences : undefined,
        updatedWithinDays: days ? Number(days) : undefined,
      }),
  });

  function toggleConfidence(level: string) {
    const next = confidences.includes(level) ? confidences.filter((x) => x !== level) : [...confidences, level];
    setParam("confidences", next.join(","));
  }

  // Load the full deck for the picked summary so it renders like the deck page.
  const pickedId = pick.data?.id ?? null;
  const { data: deck } = useQuery({
    queryKey: ["deck", pickedId],
    queryFn: () => fetchDeck(pickedId!),
    enabled: !!pickedId,
  });

  return (
    <main className="page">
      <h1>Random deck</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Pick a random Pauper deck!</p>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">Archetype</span>
          <select className="text-input" value={archetype} onChange={(e) => setParam("archetype", e.target.value)}>
            <option value="">Any archetype</option>
            {(archetypes ?? []).map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="filter-label" style={{ width: "auto", marginLeft: "1rem" }}>
            Confidence
          </span>
          {["High", "Medium", "Low"].map((level) => (
            <button key={level} className={`pill ${confidences.includes(level) ? "active" : ""}`} onClick={() => toggleConfidence(level)}>
              {level}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span className="filter-label">Updated</span>
          <select className="text-input" value={days} onChange={(e) => setParam("days", e.target.value)}>
            {WINDOWS.map((w) => (
              <option key={w.label} value={w.days}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-row">
          <span className="filter-label"></span>
          <button className="pill active" disabled={pick.isPending} onClick={() => pick.mutate()}>
            {pick.data || pick.isError ? "Pick another" : "Pick a deck"}
          </button>
        </div>
      </div>

      {pick.isError && <ErrorText message={(pick.error as Error).message} />}
      {pick.isSuccess && pick.data === null && <p style={{ color: "#666" }}>No deck matches those filters.</p>}

      {deck && <DeckView deck={deck} showClassification={false} />}
    </main>
  );
}
