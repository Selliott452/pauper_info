import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createCasualPlayer, fetchCasualLeaderboard } from "./api";
import { Loading } from "./QueryState";
import { pct } from "./format";

export function CasualPlayersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["casual-leaderboard"], queryFn: fetchCasualLeaderboard });
  const [newPlayer, setNewPlayer] = useState("");

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
              <th>Player</th>
              <th className="center">Matches</th>
              <th className="center">Record</th>
              <th className="num">Win%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/matches/players/${p.id}`}>{p.name}</Link>
                </td>
                <td className="center">{p.matches}</td>
                <td className="center">
                  {p.wins}-{p.losses}-{p.draws}
                </td>
                <td className="num">{p.matches > 0 ? pct(p.matchWinPct) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
