import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchArchetypes, fetchMatchup } from "./api";
import { ComboBox } from "./ComboBox";
import { Loading } from "./QueryState";
import { pct } from "./format";

const SOURCES = [
  { key: "global", label: "Global", hint: "mtgdecks metagame win rates" },
  { key: "tournament", label: "Tournaments", hint: "your recorded tournament matches" },
  { key: "casual", label: "Casual", hint: "your recorded casual matches" },
];

function winColor(v: number): string {
  if (v >= 0.53) return "#16a34a";
  if (v <= 0.47) return "#dc2626";
  return "#555";
}

export function MatchupsPage() {
  const { data: archetypes } = useQuery({ queryKey: ["archetypes"], queryFn: fetchArchetypes, staleTime: Infinity });
  const archetypeNames = archetypes?.map((a) => a.name) ?? [];

  const [archetype, setArchetype] = useState("");
  const [opponent, setOpponent] = useState("");
  const [source, setSource] = useState("global");

  const ready = archetype.trim() !== "" && opponent.trim() !== "";
  const { data: result, isFetching } = useQuery({
    queryKey: ["matchup", archetype, opponent, source],
    queryFn: () => fetchMatchup(archetype.trim(), opponent.trim(), source),
    enabled: ready,
  });

  const noData = result && result.games === 0 && result.winRate == null;

  return (
    <main className="page">
      <h1>Matchups</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Win rate of one archetype against another.</p>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">Your deck</span>
          <ComboBox value={archetype} onChange={setArchetype} options={archetypeNames} placeholder="Your archetype" inputStyle={{ width: 200 }} />
          <span className="filter-label" style={{ width: "auto", marginLeft: "1rem" }}>
            vs
          </span>
          <ComboBox value={opponent} onChange={setOpponent} options={archetypeNames} placeholder="Opponent archetype" inputStyle={{ width: 200 }} />
        </div>
        <div className="filter-row">
          <span className="filter-label">Source</span>
          {SOURCES.map((s) => (
            <button key={s.key} className={`pill ${source === s.key ? "active" : ""}`} title={s.hint} onClick={() => setSource(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {!ready && <p style={{ color: "#666" }}>Pick both archetypes to see the matchup.</p>}
      {ready && isFetching && <Loading />}
      {ready && !isFetching && noData && (
        <p style={{ color: "#666" }}>No {source} data for {archetype} vs {opponent}.</p>
      )}

      {ready && result && result.winRate != null && (
        <div style={{ marginTop: "0.5rem" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: winColor(result.winRate) }}>{pct(result.winRate)}</div>
          <p style={{ color: "#555", margin: "0.25rem 0 0" }}>
            <strong>{result.archetype}</strong> vs <strong>{result.opponent}</strong> ·{" "}
            {result.wins != null ? (
              <>
                {result.wins}-{result.losses}-{result.draws} over {result.games} match{result.games === 1 ? "" : "es"}
              </>
            ) : (
              <>{result.games.toLocaleString()} matches (mtgdecks)</>
            )}
          </p>
        </div>
      )}
    </main>
  );
}
