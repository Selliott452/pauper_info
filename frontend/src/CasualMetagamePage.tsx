import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fetchCasualMetagame, type ArchetypeMetagameRow } from "./api";
import { Loading, ErrorText } from "./QueryState";
import { pct } from "./format";
import { winrateColor } from "./winrate";

// Warm brass/parchment-friendly slice palette (matches the tournament metagame).
const SLICE_COLORS = [
  "#9a5b1e", "#c98a3c", "#5b8a72", "#8a5b9a", "#3d6b8a",
  "#b5453c", "#7a8a3d", "#c9a23c", "#6b5b8a", "#3d8a7a",
];
const OTHER_COLOR = "#bdb3a0";

interface Slice {
  label: string;
  appearances: number;
  share: number;
  color: string;
}

// Collapse the long tail into a single "Other" slice so the donut stays readable.
function toSlices(rows: ArchetypeMetagameRow[], total: number, topN = 9): Slice[] {
  const top: Slice[] = rows.slice(0, topN).map((r, i) => ({
    label: r.archetype,
    appearances: r.players,
    share: r.share,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const rest = rows.slice(topN);
  if (rest.length > 0) {
    const appearances = rest.reduce((s, r) => s + r.players, 0);
    top.push({ label: `Other (${rest.length})`, appearances, share: total > 0 ? appearances / total : 0, color: OTHER_COLOR });
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
        {s.appearances.toLocaleString()} appearance{s.appearances === 1 ? "" : "s"} · {pct(s.share)}
      </div>
    </div>
  );
}

// Archetype breakdown of recorded casual matches: how often each archetype shows
// up, its share of the field, and its aggregate match record.
export function CasualMetagamePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["casual-metagame"],
    queryFn: fetchCasualMetagame,
  });

  const totalAppearances = (data ?? []).reduce((sum, r) => sum + r.players, 0);
  const slices = data ? toSlices(data, totalAppearances) : [];

  return (
    <main className="page">
      <h1>Casual Metagame</h1>
      <p className="page-subtitle">What's showing up in your recorded casual matches.</p>

      {isLoading && <Loading />}
      {isError && <ErrorText message="Failed to load the casual metagame." />}

      {data && data.length === 0 && (
        <p style={{ color: "#666" }}>No archetypes recorded yet. Add archetypes to your casual matches to populate this page.</p>
      )}

      {data && data.length > 0 && (
        <>
          <p className="result-count">
            {data.length} archetype{data.length === 1 ? "" : "s"} · {totalAppearances} appearance{totalAppearances === 1 ? "" : "s"}
          </p>

          <div className="metagame-chart">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="appearances"
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
                <th className="num">Appearances</th>
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
