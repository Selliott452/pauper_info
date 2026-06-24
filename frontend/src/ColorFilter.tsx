import { COLORS } from "./colors";

// The shared "Colors" filter row: a pill per color (optionally a Colorless pill),
// plus a Within-identity / Exact match toggle. `selected` holds the chosen color
// codes (W/U/B/R/G and "C" for colorless).
export function ColorFilter({
  noun,
  selected,
  onToggle,
  colorMatch,
  onColorMatch,
  colorless = false,
}: {
  noun: string;
  selected: string[];
  onToggle: (code: string) => void;
  colorMatch: "within" | "exact";
  onColorMatch: (value: "within" | "exact") => void;
  colorless?: boolean;
}) {
  return (
    <div className="filter-row">
      <span className="filter-label">Colors</span>
      {COLORS.map((c) => (
        <button key={c.code} className={`pill ${selected.includes(c.code) ? "active" : ""}`} onClick={() => onToggle(c.code)}>
          {c.label}
        </button>
      ))}
      {colorless && (
        <button className={`pill ${selected.includes("C") ? "active" : ""}`} onClick={() => onToggle("C")}>
          Colorless
        </button>
      )}
      <span style={{ marginLeft: "0.75rem", display: "inline-flex", gap: "0.4rem" }}>
        <button
          className={`pill ${colorMatch === "within" ? "active" : ""}`}
          onClick={() => onColorMatch("within")}
          title={`${noun} whose colors fall within the selected set`}
        >
          Within identity
        </button>
        <button
          className={`pill ${colorMatch === "exact" ? "active" : ""}`}
          onClick={() => onColorMatch("exact")}
          title={`${noun} whose colors exactly match the selected set`}
        >
          Exact
        </button>
      </span>
    </div>
  );
}
