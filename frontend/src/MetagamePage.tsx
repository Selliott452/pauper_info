import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fetchTournamentMetagame, type ArchetypeMetagameRow } from "./api";
import { Loading, ErrorText } from "./QueryState";
import { pct } from "./format";
import { winrateColor } from "./winrate";

// Warm brass/parchment-friendly slice palette.
const SLICE_COLORS = [
  "#9a5b1e", "#c98a3c", "#5b8a72", "#8a5b9a", "#3d6b8a",
  "#b5453c", "#7a8a3d", "#c9a23c", "#6b5b8a", "#3d8a7a",
];
const OTHER_COLOR = "#bdb3a0";

interface Slice {
  label: string;
  players: number;
  share: number;
  color: string;
}

// Collapse the long tail into a single "Other" slice so the donut stays readable.
function toSlices(rows: ArchetypeMetagameRow[], total: number, topN = 9): Slice[] {
  const top: Slice[] = rows.slice(0, topN).map((r, i) => ({
    label: r.archetype,
    players: r.players,
    share: r.share,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const rest = rows.slice(topN);
  if (rest.length > 0) {
    const players = rest.reduce((s, r) => s + r.players, 0);
    top.push({ label: `Other (${rest.length})`, players, share: total > 0 ? players / total : 0, color: OTHER_COLOR });
  }
  return top;
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
  const slices = data ? toSlices(data, totalPlayers) : [];

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
                  formatter={(value) => <span className="legend-label">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Archetype</th>
                <th className="num">Decks</th>
                <th className="num">Field</th>
                <th className="num">Record</th>
                <th className="num">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const games = r.wins + r.losses + r.draws;
                return (
                  <tr key={r.archetype}>
                    <td>{r.archetype}</td>
                    <td className="num">{r.players.toLocaleString()}</td>
                    <td className="num">{pct(r.share)}</td>
                    <td className="num">{games === 0 ? "-" : `${r.wins}-${r.losses}-${r.draws}`}</td>
                    <td className="num" style={{ color: r.winRate != null ? winrateColor(r.winRate * 100) : "#999" }}>
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
