import { useEffect, useRef, useState } from "react";
import { withSubmissionLock } from "./lib/submission.js";

// Centered confirm dialog — guards destructive actions (entry / food delete). Matches the
// app's dark RTL modal language (backdrop + card), using the existing `pop` animation.
export default function ConfirmDialog({ title, body, confirmLabel = "מחק", onConfirm, onCancel }) {
  const confirmLock = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef(null);
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

  useEffect(() => {
    cancelRef.current?.focus();
    const escape = (event) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={cancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease", cursor: confirming ? "wait" : "pointer" }} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={body ? "confirm-body" : undefined} aria-busy={confirming} style={{ position: "relative", width: "100%", maxWidth: 340, background: "#111512", border: "1px solid #3b4540", borderRadius: 22, padding: 24, animation: "pop .2s ease", boxShadow: "0 24px 70px rgba(0,0,0,.45)" }}>
        <div id="confirm-title" style={{ fontSize: 19, fontWeight: 900, color: "#f4f7f6", marginBottom: body ? 8 : 20 }}>{title}</div>
        {body && <div id="confirm-body" style={{ fontSize: 14, fontWeight: 500, color: "#8a9994", marginBottom: 22, lineHeight: 1.5 }}>{body}</div>}
        {error && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700, marginBottom: 16, lineHeight: 1.45 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button ref={cancelRef} disabled={confirming} onClick={cancel} style={{ minHeight: 48, flex: 1, border: "1px solid #333c38", fontFamily: "inherit", background: "#202521", color: "#d5ddda", fontSize: 15, fontWeight: 700, padding: 13, borderRadius: 13, cursor: confirming ? "not-allowed" : "pointer", opacity: confirming ? .45 : 1 }}>
            ביטול
          </button>
          <button disabled={confirming} onClick={confirm} style={{ minHeight: 48, flex: 1, border: "none", fontFamily: "inherit", background: "#fb5d67", color: "#39080c", fontSize: 15, fontWeight: 900, padding: 13, borderRadius: 13, cursor: confirming ? "not-allowed" : "pointer", opacity: confirming ? .6 : 1 }}>
            {confirming ? "מוחק..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
