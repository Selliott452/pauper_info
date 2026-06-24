// Small colored pill for an archetype classification confidence (High/Medium/Low).
export function ConfidenceBadge({
  level,
  title,
}: {
  level: string | null;
  title?: string;
}) {
  if (!level) return null;
  const color = level === "High" ? "#16a34a" : level === "Medium" ? "#d97706" : "#888";
  return (
    <span
      title={title}
      style={{
        marginLeft: 6,
        padding: "0.05rem 0.4rem",
        borderRadius: 999,
        fontSize: "0.7rem",
        fontWeight: 700,
        color: "#fff",
        background: color,
        verticalAlign: "middle",
      }}
    >
      {level}
    </span>
  );
}
