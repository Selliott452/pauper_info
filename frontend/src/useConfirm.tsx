import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";

// Confirmation dialog for a destructive action. The hook returns an `onClick` to
// open the dialog and a `dialog` node to render somewhere in the component; the
// action only fires when the user clicks the confirm button.
export function useConfirm(
  action: () => void,
  opts: { title: string; message?: ReactNode; confirmLabel?: string },
) {
  const [open, setOpen] = useState(false);
  const onClick = () => setOpen(true);
  const dialog = open ? (
    <ConfirmDialog
      title={opts.title}
      message={opts.message}
      confirmLabel={opts.confirmLabel ?? "Confirm"}
      onCancel={() => setOpen(false)}
      onConfirm={() => {
        setOpen(false);
        action();
      }}
    />
  ) : null;
  return { onClick, dialog };
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal width={400} onClose={onCancel}>
      <h3 style={{ margin: "0 0 0.75rem" }}>{title}</h3>
      {message && <p style={{ margin: "0 0 1.25rem", color: "#555" }}>{message}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button className="pill" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="pill active"
          style={{ background: "#dc2626", borderColor: "#dc2626" }}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
