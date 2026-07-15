const WEEKS = 53;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function colorFor(count: number): string {
  if (count === 0) return "var(--surface-alt)";
  if (count === 1) return "#cda868";
  if (count <= 3) return "#b07f34";
  if (count <= 5) return "#8a5119";
  return "#6b3d10";
}

// GitHub-style calendar heatmap: one column per week (Sun-Sat), shaded by how
// many matches were played that day, covering the trailing year.
export function PlayHeatmap({ dates }: { dates: (string | null)[] }) {
  const counts = new Map<string, number>();
  for (const d of dates) {
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay());

  const days: { date: Date; count: number }[] = [];
  for (const t = new Date(start); t <= today; t.setDate(t.getDate() + 1)) {
    days.push({ date: new Date(t), count: counts.get(isoDate(t)) ?? 0 });
  }

  const weeks: { date: Date; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const monthLabels = weeks.map((week, i) => {
    const first = week[0].date;
    return i === 0 || first.getMonth() !== weeks[i - 1][0].date.getMonth()
      ? first.toLocaleDateString(undefined, { month: "short" })
      : "";
  });

  // Panel hugs the grid's exact pixel width (52 x 12px cells + gaps) rather than
  // stretching to the page column - `width: fit-content` doesn't reliably shrink
  // through the nested overflow-x:auto scroller, so compute it directly instead.
  const gridWidth = weeks.length * 12 + (weeks.length - 1) * 3;

  return (
    <div className="filter-panel heatmap-panel" style={{ width: gridWidth + 40, maxWidth: "100%" }}>
      <h2 style={{ margin: 0 }}>Play activity</h2>

      <div className="heatmap-scroll">
        <div
          style={{
            display: "inline-grid",
            gridTemplateColumns: `repeat(${weeks.length}, 12px)`,
            gridTemplateRows: "12px repeat(7, 12px)",
            gap: 3,
          }}
        >
          {monthLabels.map((label, wi) => (
            <span key={`m${wi}`} className="heatmap-month-label" style={{ gridColumn: wi + 1, gridRow: 1 }}>
              {label}
            </span>
          ))}
          {weeks.map((week, wi) =>
            week.map(({ date, count }, di) => (
              <div
                key={`${wi}-${di}`}
                className="heatmap-cell"
                style={{ gridColumn: wi + 1, gridRow: di + 2, background: colorFor(count), border: count === 0 ? "1px solid var(--line)" : "none" }}
                title={`${count} match${count === 1 ? "" : "es"} on ${date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`}
              />
            )),
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9a9082" }}>
        <span>Less</span>
        {[0, 1, 2, 4, 6].map((c) => (
          <span
            key={c}
            className="heatmap-cell"
            style={{
              background: colorFor(c),
              border: c === 0 ? "1px solid var(--line)" : "none",
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
