import type { ReactNode } from "react";
import { recordWinRate } from "./format";

export interface RecordRow {
  key: string;
  label: ReactNode;
  wins: number;
  losses: number;
  draws: number;
  // Optional underlying game record. When present (and `showGames`), an extra
  // "Game record" column is rendered.
  gameWins?: number;
  gameLosses?: number;
  gameDraws?: number;
}

// A "label · record · win%" table shared by the competitor and casual player pages.
// Renders nothing when there are no rows. Pass `showGames` to add a game-record
// column (rows must carry gameWins/gameLosses/gameDraws).
export function RecordTable({
  heading,
  firstCol,
  rows,
  showGames = false,
}: {
  heading: string;
  firstCol: string;
  rows: RecordRow[];
  showGames?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <h2 style={{ margin: "1.5rem 0 0.5rem" }}>{heading}</h2>
      <table className="data-table" style={{ maxWidth: showGames ? 640 : 520 }}>
        <thead>
          <tr>
            <th>{firstCol}</th>
            <th className="center">{showGames ? "Match record" : "Record"}</th>
            {showGames && <th className="center">Game record</th>}
            <th className="num">Win%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="center">
                {r.wins}-{r.losses}-{r.draws}
              </td>
              {showGames && (
                <td className="center">
                  {r.gameWins ?? 0}-{r.gameLosses ?? 0}-{r.gameDraws ?? 0}
                </td>
              )}
              <td className="num">{recordWinRate(r.wins, r.losses, r.draws)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
