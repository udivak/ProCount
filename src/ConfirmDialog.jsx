// Centered confirm dialog — guards destructive actions (entry / food delete). Matches the
// app's dark RTL modal language (backdrop + card), using the existing `pop` animation.
// ponytail: no Esc / focus-trap — no modal in the app does; tap-outside + Cancel is enough.
export default function ConfirmDialog({ title, body, confirmLabel = "מחק", onConfirm, onCancel }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 340, background: "#0b1112", border: "1px solid #26302f", borderRadius: 22, padding: 24, animation: "pop .2s ease" }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "#f4f4f5", marginBottom: body ? 8 : 20 }}>{title}</div>
        {body && <div style={{ fontSize: 14, fontWeight: 500, color: "#8a8a93", marginBottom: 22, lineHeight: 1.5 }}>{body}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, border: "none", fontFamily: "inherit", background: "#1e1e23", color: "#c4c4c9", fontSize: 15, fontWeight: 700, padding: 13, borderRadius: 13, cursor: "pointer" }}>
            ביטול
          </button>
          <button onClick={onConfirm} style={{ flex: 1, border: "none", fontFamily: "inherit", background: "#fb7185", color: "#3a0a12", fontSize: 15, fontWeight: 800, padding: 13, borderRadius: 13, cursor: "pointer" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
