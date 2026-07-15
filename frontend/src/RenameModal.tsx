import { useState } from "react";
import { Modal } from "./Modal";
import { ErrorText } from "./QueryState";

// A small modal for renaming a player, shared by the tournament roster, the
// competitor career page, and the casual player page.
export function RenameModal({
  title,
  initial,
  onSave,
  onClose,
  saving,
  error,
}: {
  title: string;
  initial: string;
  onSave: (name: string) => void;
  onClose: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState(initial);

  return (
    <Modal width={360} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
        Name
        <input
          type="text"
          className="text-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim());
          }}
          style={{ display: "block", width: "100%", marginTop: "0.25rem", boxSizing: "border-box" }}
        />
      </label>
      {error && <ErrorText message={error} />}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button className="pill" onClick={onClose}>
          Cancel
        </button>
        <button className="pill active" disabled={!name.trim() || saving} onClick={() => onSave(name.trim())}>
          Save
        </button>
      </div>
    </Modal>
  );
}
