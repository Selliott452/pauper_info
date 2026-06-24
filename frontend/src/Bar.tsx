// A horizontal progress bar with a trailing value label, used for inclusion rates,
// win rates, and classification scores. `ratio` is the fill fraction (0..1).
export function Bar({
  ratio,
  label,
  color = "#3b82f6",
}: {
  ratio: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="bar-cell">
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: color }} />
      </div>
      <span className="bar-value">{label}</span>
    </div>
  );
}
