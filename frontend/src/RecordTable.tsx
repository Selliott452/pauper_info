import type { ReactNode } from "react";
import { recordWinRate } from "./format";

export interface RecordRow {
  key: string;
  label: ReactNode;
  wins: number;
  losses: number;
  draws: number;
}

// A "label · record · win%" table shared by the competitor and casual player pages.
// Renders nothing when there are no rows.
export function RecordTable({
  heading,
  firstCol,
  rows,
}: {
  heading: string;
  firstCol: string;
  rows: RecordRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <h2 style={{ margin: "1.5rem 0 0.5rem" }}>{heading}</h2>
      <table className="data-table" style={{ maxWidth: 520 }}>
        <thead>
          <tr>
            <th>{firstCol}</th>
            <th className="center">Record</th>
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
              <td className="num">{recordWinRate(r.wins, r.losses, r.draws)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
