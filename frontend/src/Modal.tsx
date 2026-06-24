import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// A centered modal rendered into document.body. Clicking the backdrop closes it;
// clicks inside the card are swallowed. `width` sizes the card.
export function Modal({
  width = 460,
  onClose,
  children,
}: {
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ width }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
