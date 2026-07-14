import { useEffect } from "react";
import { pingApi } from "./api";

const PING_INTERVAL_MS = 4 * 60 * 1000;
const MAX_DURATION_MS = 60 * 60 * 1000;

// Pings the API periodically so the same visitor's session doesn't hit a cold
// start mid-visit. Stops after an hour so a tab left open indefinitely doesn't
// keep the Cloud Run instance warm forever.
export function KeepAlive() {
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      if (Date.now() - start > MAX_DURATION_MS) {
        clearInterval(id);
        return;
      }
      pingApi();
    }, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
