import { useNavigate } from "react-router-dom";

// Returns to the previous page (preserving its filters via history).
export function BackLink() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(-1)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        marginBottom: "1.25rem",
        color: "#2563eb",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      ← Back
    </button>
  );
}
