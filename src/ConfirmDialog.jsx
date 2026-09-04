import { useRef, useState } from "react";
import { withSubmissionLock } from "./lib/submission.js";

// Centered confirm dialog — guards destructive actions (entry / food delete). Matches the
// app's dark RTL modal language (backdrop + card), using the existing `pop` animation.
// ponytail: no Esc / focus-trap — no modal in the app does; tap-outside + Cancel is enough.
export default function ConfirmDialog({ title, body, confirmLabel = "מחק", onConfirm, onCancel }) {
  const confirmLock = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const cancel = () => { if (!confirmLock.current) onCancel(); };
  const confirm = () => withSubmissionLock(confirmLock, async () => {
    setConfirming(true);
    setError("");
    try {
      const message = await onConfirm();
      if (message) setError(message);
    } catch {
      setError("לא ניתן להשלים את המחיקה כרגע. נסה שוב.");
    } finally {
      setConfirming(false);
    }
  });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={cancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease", cursor: confirming ? "wait" : "pointer" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 340, background: "#0b1112", border: "1px solid #26302f", borderRadius: 22, padding: 24, animation: "pop .2s ease" }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "#f4f4f5", marginBottom: body ? 8 : 20 }}>{title}</div>
        {body && <div style={{ fontSize: 14, fontWeight: 500, color: "#8a8a93", marginBottom: 22, lineHeight: 1.5 }}>{body}</div>}
        {error && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700, marginBottom: 16, lineHeight: 1.45 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button disabled={confirming} onClick={cancel} style={{ flex: 1, border: "none", fontFamily: "inherit", background: "#1e1e23", color: "#c4c4c9", fontSize: 15, fontWeight: 700, padding: 13, borderRadius: 13, cursor: confirming ? "not-allowed" : "pointer", opacity: confirming ? .45 : 1 }}>
            ביטול
          </button>
          <button disabled={confirming} onClick={confirm} aria-busy={confirming} style={{ flex: 1, border: "none", fontFamily: "inherit", background: "#fb7185", color: "#3a0a12", fontSize: 15, fontWeight: 800, padding: 13, borderRadius: 13, cursor: confirming ? "not-allowed" : "pointer", opacity: confirming ? .6 : 1 }}>
            {confirming ? "מוחק..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
