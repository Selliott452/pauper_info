import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createCasualPlayer, fetchCasualLeaderboard, type CasualPlayerSummary } from "./api";
import { SortableTh } from "./SortableTh";
import { Loading } from "./QueryState";
import { pct } from "./format";

type SortKey = "name" | "matches" | "record" | "winPct";
type SortDir = "asc" | "desc";

function compareRows(a: CasualPlayerSummary, b: CasualPlayerSummary, sort: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (sort) {
    case "name":
      return a.name.localeCompare(b.name) * sign;
    case "matches":
      return (a.matches - b.matches) * sign;
    case "record":
      return (a.wins - b.wins) * sign;
    case "winPct":
      return (a.matchWinPct - b.matchWinPct) * sign;
  }
}

export function CasualPlayersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["casual-leaderboard"], queryFn: fetchCasualLeaderboard });
  const [newPlayer, setNewPlayer] = useState("");
  const [sort, setSort] = useState<{ col: SortKey; dir: SortDir } | null>(null);
  function toggleSort(col: SortKey) {
    setSort((s) =>
      s && s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "name" ? "asc" : "desc" },
    );
  }
  const rows = data ? (sort ? [...data].sort((a, b) => compareRows(a, b, sort.col, sort.dir)) : data) : [];

  const addPlayer = useMutation({
    mutationFn: () => createCasualPlayer(newPlayer.trim()),
    onSuccess: () => {
      setNewPlayer("");
      queryClient.invalidateQueries({ queryKey: ["casual-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["casual-players"] });
    },
  });

  return (
    <main className="page">
      <h1>Casual players</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Players and their overall record across casual matches.</p>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">New player</span>
          <input
            type="text"
            className="text-input"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newPlayer.trim()) addPlayer.mutate();
            }}
            placeholder="Player name"
            style={{ width: 220 }}
          />
          <button className="pill active" disabled={!newPlayer.trim() || addPlayer.isPending} onClick={() => addPlayer.mutate()}>
            Add
          </button>
        </div>
      </div>

      {isLoading && <Loading />}
      {data && data.length === 0 && <p style={{ color: "#666" }}>No players yet!</p>}

      {data && data.length > 0 && (
        <table className="data-table" style={{ maxWidth: 560 }}>
          <thead>
            <tr>
              <SortableTh label="Player" active={sort?.col === "name"} dir={sort?.dir ?? "asc"} onClick={() => toggleSort("name")} />
              <SortableTh label="Matches" align="center" active={sort?.col === "matches"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("matches")} />
              <SortableTh label="Record" align="center" active={sort?.col === "record"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("record")} />
              <SortableTh label="Win%" align="right" active={sort?.col === "winPct"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("winPct")} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td data-label="Player">
                  <Link to={`/matches/players/${p.id}`}>{p.name}</Link>
                </td>
                <td className="center" data-label="Matches">{p.matches}</td>
                <td className="center" data-label="Record">
                  {p.wins}-{p.losses}-{p.draws}
                </td>
                <td className="num" data-label="Win%">{p.matches > 0 ? pct(p.matchWinPct) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
