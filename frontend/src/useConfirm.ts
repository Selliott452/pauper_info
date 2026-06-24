import { useState } from "react";

// Two-step confirmation for a destructive button: the first click arms it (and
// shows a confirm label) and a second click within `timeoutMs` performs the
// action; otherwise it disarms. Returns the armed flag and a click handler.
export function useConfirm(action: () => void, timeoutMs = 4000) {
  const [armed, setArmed] = useState(false);
  function onClick() {
    if (armed) {
      action();
      setArmed(false);
    } else {
      setArmed(true);
      setTimeout(() => setArmed(false), timeoutMs);
    }
  }
  return { armed, onClick };
}
