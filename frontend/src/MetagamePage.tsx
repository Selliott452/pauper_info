import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fetchTournamentMetagame, type ArchetypeMetagameRow } from "./api";
import { ArchetypeLink } from "./ArchetypeLink";
import { SortableTh } from "./SortableTh";
import { Loading, ErrorText } from "./QueryState";
import { pct } from "./format";
import { winrateColor } from "./winrate";

type SortKey = "archetype" | "players" | "share" | "record" | "winRate";
type SortDir = "asc" | "desc";

// Missing win rates always sort to the bottom regardless of direction.
function compareRows(a: ArchetypeMetagameRow, b: ArchetypeMetagameRow, sort: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (sort) {
    case "archetype":
      return a.archetype.localeCompare(b.archetype) * sign;
    case "players":
      return (a.players - b.players) * sign;
    case "share":
      return (a.share - b.share) * sign;
    case "record":
      return (a.wins - b.wins) * sign;
    case "winRate":
      if (a.winRate == null && b.winRate == null) return 0;
      if (a.winRate == null) return 1;
      if (b.winRate == null) return -1;
      return (a.winRate - b.winRate) * sign;
  }
}

// Warm brass/parchment-friendly slice palette.
const SLICE_COLORS = [
  "#9a5b1e", "#c98a3c", "#5b8a72", "#8a5b9a", "#3d6b8a",
  "#b5453c", "#7a8a3d", "#c9a23c", "#6b5b8a", "#3d8a7a",
];

interface Slice {
  label: string;
  players: number;
  share: number;
  color: string;
}

function toSlices(rows: ArchetypeMetagameRow[]): Slice[] {
  return rows.map((r, i) => ({
    label: r.archetype,
    players: r.players,
    share: r.share,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
}

function SliceTooltip({ active, payload }: { active?: boolean; payload?: { payload: Slice }[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{s.label}</strong>
      <div>
        {s.players.toLocaleString()} deck{s.players === 1 ? "" : "s"} · {pct(s.share)}
      </div>
    </div>
  );
}

// Archetype breakdown of every recorded tournament: how many players brought
// each archetype, its share of the field, and its aggregate match record.
export function MetagamePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tournament-metagame"],
    queryFn: fetchTournamentMetagame,
  });

  const totalPlayers = (data ?? []).reduce((sum, r) => sum + r.players, 0);
  const slices = data ? toSlices(data) : [];

  // Sort state is local (not URL-persisted, unlike filtered pages). Unset by
  // default: the table shows in the API's natural order until a header is clicked.
  const [sort, setSort] = useState<{ col: SortKey; dir: SortDir } | null>(null);
  function toggleSort(col: SortKey) {
    setSort((s) =>
      s && s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "archetype" ? "asc" : "desc" },
    );
  }
  const rows = data ? (sort ? [...data].sort((a, b) => compareRows(a, b, sort.col, sort.dir)) : data) : [];

  return (
    <main className="page">
      <h1>Tournament Metagame</h1>
      <p className="page-subtitle">What's winning at the tables you've recorded.</p>

      {isLoading && <Loading />}
      {isError && <ErrorText message="Failed to load the tournament metagame." />}

      {data && data.length === 0 && (
        <p style={{ color: "#666" }}>No archetypes recorded yet. Add archetypes to your tournament players to populate this page.</p>
      )}

      {data && data.length > 0 && (
        <>
          <p className="result-count">
            {data.length} archetype{data.length === 1 ? "" : "s"} · {totalPlayers} deck{totalPlayers === 1 ? "" : "s"} entered
          </p>

          <div className="metagame-chart">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="players"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={1.5}
                  stroke="var(--paper)"
                  strokeWidth={1.5}
                >
                  {slices.map((s) => (
                    <Cell key={s.label} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<SliceTooltip />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ maxHeight: 300, overflowY: "auto" }}
                  formatter={(value) => <span className="legend-label">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Archetype" active={sort?.col === "archetype"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("archetype")} />
                <SortableTh label="Decks" align="right" active={sort?.col === "players"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("players")} />
                <SortableTh label="Field" align="right" active={sort?.col === "share"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("share")} />
                <SortableTh label="Record" align="right" active={sort?.col === "record"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("record")} />
                <SortableTh label="Win rate" align="right" active={sort?.col === "winRate"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("winRate")} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const games = r.wins + r.losses + r.draws;
                return (
                  <tr key={r.archetype}>
                    <td data-label="Archetype"><ArchetypeLink archetype={r.archetype} /></td>
                    <td className="num" data-label="Decks">{r.players.toLocaleString()}</td>
                    <td className="num" data-label="Field">{pct(r.share)}</td>
                    <td className="num" data-label="Record">{games === 0 ? "-" : `${r.wins}-${r.losses}-${r.draws}`}</td>
                    <td className="num" data-label="Win rate" style={{ color: r.winRate != null ? winrateColor(r.winRate * 100) : "#999" }}>
                      {r.winRate != null ? pct(r.winRate) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
