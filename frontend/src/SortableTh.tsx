type Align = "left" | "right" | "center";

// A clickable table header that sorts its column. Shows ▲/▼ when active, ▾ otherwise.
export function SortableTh({
  label,
  align = "left",
  width,
  active,
  dir,
  onClick,
}: {
  label: string;
  align?: Align;
  width?: number;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="sort-th" onClick={onClick} style={{ textAlign: align, width }}>
      {label}
      <span className={`sort-caret${active ? " active" : ""}`}>
        {active ? (dir === "asc" ? "▲" : "▼") : "▾"}
      </span>
    </th>
  );
}
