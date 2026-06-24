import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SortableTh } from "./SortableTh";
import { Loading } from "./QueryState";
import { pct } from "./format";
import { createCompetitor, fetchCompetitors, type CompetitorSummary } from "./api";

type SortKey = "name" | "events" | "record" | "match" | "game";
type SortDir = "asc" | "desc";

function compareCompetitors(a: CompetitorSummary, b: CompetitorSummary, col: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (col) {
    case "name":
      return a.name.localeCompare(b.name) * sign;
    case "events":
      return (a.events - b.events) * sign;
    case "record":
      return (a.wins - b.wins) * sign;
    case "match":
      return (a.matchWinPct - b.matchWinPct) * sign;
    case "game":
      return (a.gameWinPct - b.gameWinPct) * sign;
  }
}

export function CompetitorsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["competitors"], queryFn: fetchCompetitors });
  const [name, setName] = useState("");
  const [sort, setSort] = useState<{ col: SortKey; dir: SortDir }>({ col: "name", dir: "asc" });

  function toggleSort(col: SortKey) {
    setSort((s) =>
      s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "name" ? "asc" : "desc" },
    );
  }

  const rows = data ? [...data].sort((a, b) => compareCompetitors(a, b, sort.col, sort.dir)) : [];

  const create = useMutation({
    mutationFn: () => createCompetitor(name.trim()),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    },
  });

  const th = (label: string, col: SortKey, align: "left" | "right" | "center") => (
    <SortableTh label={label} align={align} active={sort.col === col} dir={sort.dir} onClick={() => toggleSort(col)} />
  );

  return (
    <main className="page">
      <h1>Players</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Persistent players. Their results are tracked across every tournament they join.
      </p>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">New player</span>
          <input
            type="text"
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) create.mutate();
            }}
            placeholder="Player name"
            style={{ width: 240 }}
          />
          <button className="pill active" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            Add
          </button>
        </div>
      </div>

      {isLoading && <Loading />}
      {data && data.length === 0 && (
        <p style={{ color: "#666" }}>No players yet — add one above, or create a tournament.</p>
      )}

      {data && data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              {th("Player", "name", "left")}
              {th("Events", "events", "right")}
              {th("Record", "record", "center")}
              {th("Match win%", "match", "right")}
              {th("Game win%", "game", "right")}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/players/${c.id}`}>{c.name}</Link>
                </td>
                <td className="num">{c.events}</td>
                <td className="center">
                  {c.wins}-{c.losses}-{c.draws}
                </td>
                <td className="num">{pct(c.matchWinPct)}</td>
                <td className="num">{pct(c.gameWinPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
