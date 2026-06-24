import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createTournament, fetchCompetitors, fetchTournaments, type TournamentSummary } from "./api";
import { MultiCombobox } from "./ComboBox";
import { SortableTh } from "./SortableTh";
import { Loading } from "./QueryState";

type SortKey = "name" | "date" | "players" | "round" | "status";
type SortDir = "asc" | "desc";

export function TournamentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const { data: competitors } = useQuery({ queryKey: ["competitors"], queryFn: fetchCompetitors });
  const competitorNames = competitors?.map((c) => c.name);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  const [sort, setSort] = useState<{ col: SortKey; dir: SortDir }>({ col: "date", dir: "desc" });

  function toggleSort(col: SortKey) {
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "name" || col === "status" ? "asc" : "desc" },
    );
  }

  const rows = data ? [...data].sort((a, b) => compareTournaments(a, b, sort.col, sort.dir)) : [];

  const create = useMutation({
    mutationFn: () =>
      createTournament({
        name,
        players,
        date: date || undefined,
      }),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      navigate(`/tournaments/${t.id}`);
    },
  });

  const th = (label: string, col: SortKey, align: "left" | "right") => (
    <SortableTh label={label} align={align} active={sort.col === col} dir={sort.dir} onClick={() => toggleSort(col)} />
  );

  return (
    <main className="page">
      <h1>Tournaments</h1>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">Name</span>
          <input
            type="text"
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday Night Pauper"
            style={{ width: 280 }}
          />
          <span className="filter-label" style={{ width: "auto" }}>
            Date
          </span>
          <input
            type="date"
            className="text-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <MultiCombobox label="Players" options={competitorNames} value={players} onChange={setPlayers} placeholder="Add a player…" allowNew />

        <div className="filter-row">
          <span className="filter-label"></span>
          <button
            className="pill active"
            disabled={players.length < 2 || create.isPending}
            onClick={() => create.mutate()}
            style={{ opacity: players.length < 2 ? 0.5 : 1 }}
          >
            Create ({players.length} player{players.length === 1 ? "" : "s"})
          </button>
        </div>
        {create.isError && (
          <p style={{ color: "crimson", margin: 0 }}>{(create.error as Error).message}</p>
        )}
      </div>

      {isLoading && <Loading />}

      {data && data.length === 0 && <p style={{ color: "#666" }}>No tournaments yet — create one above.</p>}

      {data && data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              {th("Name", "name", "left")}
              {th("Date", "date", "left")}
              {th("Players", "players", "right")}
              {th("Rounds", "round", "right")}
              {th("Status", "status", "right")}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tournaments/${t.id}`}>{t.name}</Link>
                </td>
                <td style={{ color: "#666" }}>{t.date ?? "—"}</td>
                <td className="num">{t.playerCount}</td>
                <td className="num">{t.currentRound}</td>
                <td className="num">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function compareTournaments(a: TournamentSummary, b: TournamentSummary, col: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (col) {
    case "name":
      return a.name.localeCompare(b.name) * sign;
    case "status":
      return a.status.localeCompare(b.status) * sign;
    case "players":
      return (a.playerCount - b.playerCount) * sign;
    case "round":
      return (a.currentRound - b.currentRound) * sign;
    case "date":
      // Undated tournaments always sort to the bottom.
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) * sign;
  }
}
