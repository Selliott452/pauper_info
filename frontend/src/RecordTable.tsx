import { useState, type ReactNode } from "react";
import { IconEye } from "@tabler/icons-react";
import { SortableTh } from "./SortableTh";
import { recordWinRate } from "./format";

export interface RecordRow {
  key: string;
  // Plain-text version of `label`, used for sorting (label may be a Link/other node).
  name: string;
  label: ReactNode;
  wins: number;
  losses: number;
  draws: number;
  // Optional underlying game record. When present (and `showGames`), an extra
  // "Game record" column is rendered.
  gameWins?: number;
  gameLosses?: number;
  gameDraws?: number;
  // When set, a "view" button is rendered that runs this callback (used to filter
  // the match history on the casual player page).
  onView?: () => void;
}

type SortKey = "name" | "record" | "gameRecord" | "winPct";
type SortDir = "asc" | "desc";

function winPct(r: RecordRow): number {
  const total = r.wins + r.losses + r.draws;
  return total === 0 ? -1 : r.wins / total;
}

function compareRows(a: RecordRow, b: RecordRow, sort: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (sort) {
    case "name":
      return a.name.localeCompare(b.name) * sign;
    case "record":
      return (a.wins - b.wins) * sign;
    case "gameRecord":
      return ((a.gameWins ?? 0) - (b.gameWins ?? 0)) * sign;
    case "winPct":
      return (winPct(a) - winPct(b)) * sign;
  }
}

// A "label · record · win%" table shared by the competitor and casual player pages.
// Renders nothing when there are no rows. Pass `showGames` to add a game-record
// column (rows must carry gameWins/gameLosses/gameDraws).
export function RecordTable({
  heading,
  firstCol,
  rows,
  showGames = false,
  emptyMessage,
}: {
  heading: string;
  firstCol: string;
  rows: RecordRow[];
  showGames?: boolean;
  // When set, an empty table renders the heading plus this message instead of
  // collapsing to nothing.
  emptyMessage?: string;
}) {
  // Sort state is local to each table instance. Unset by default: rows show in
  // the order passed in until a header is clicked.
  const [sort, setSort] = useState<{ col: SortKey; dir: SortDir } | null>(null);
  function toggleSort(col: SortKey) {
    setSort((s) =>
      s && s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "name" ? "asc" : "desc" },
    );
  }

  if (rows.length === 0) {
    if (!emptyMessage) return null;
    return (
      <>
        <h2 style={{ margin: "1.5rem 0 0.5rem" }}>{heading}</h2>
        <p style={{ color: "#666", margin: 0 }}>{emptyMessage}</p>
      </>
    );
  }
  const hasActions = rows.some((r) => r.onView);
  const sortedRows = sort ? [...rows].sort((a, b) => compareRows(a, b, sort.col, sort.dir)) : rows;
  return (
    <>
      <h2 style={{ margin: "1.5rem 0 0.5rem" }}>{heading}</h2>
      <table className="data-table" style={{ maxWidth: showGames ? 640 : 520 }}>
        <thead>
          <tr>
            <SortableTh label={firstCol} active={sort?.col === "name"} dir={sort?.dir ?? "asc"} onClick={() => toggleSort("name")} />
            <SortableTh
              label={showGames ? "Match record" : "Record"}
              align="center"
              active={sort?.col === "record"}
              dir={sort?.dir ?? "desc"}
              onClick={() => toggleSort("record")}
            />
            {showGames && (
              <SortableTh
                label="Game record"
                align="center"
                active={sort?.col === "gameRecord"}
                dir={sort?.dir ?? "desc"}
                onClick={() => toggleSort("gameRecord")}
              />
            )}
            <SortableTh label="Win%" align="right" active={sort?.col === "winPct"} dir={sort?.dir ?? "desc"} onClick={() => toggleSort("winPct")} />
            {hasActions && <th aria-label="View" />}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => (
            <tr key={r.key}>
              <td data-label={firstCol}>{r.label}</td>
              <td className="center" data-label={showGames ? "Match record" : "Record"}>
                {r.wins}-{r.losses}-{r.draws}
              </td>
              {showGames && (
                <td className="center" data-label="Game record">
                  {r.gameWins ?? 0}-{r.gameLosses ?? 0}-{r.gameDraws ?? 0}
                </td>
              )}
              <td className="num" data-label="Win%">{recordWinRate(r.wins, r.losses, r.draws)}</td>
              {hasActions && (
                <td className="num" data-label="">
                  {r.onView && (
                    <button
                      onClick={r.onView}
                      title="View in match history"
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#2563eb", display: "inline-flex" }}
                    >
                      <IconEye size={16} stroke={2} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
