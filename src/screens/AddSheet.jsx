import { useEffect, useRef, useState } from "react";
import { X, Camera, ImageIcon, Info } from "../lib/icons.jsx";

const input = { width: "100%", minHeight: 50, background: "#171b18", border: "1px solid #2b342f", borderRadius: 13, padding: 13, color: "#f4f7f6", fontSize: 16, fontFamily: "inherit", outline: "none" };
const label = { fontSize: 13, fontWeight: 700, color: "#8a9994", display: "block", marginBottom: 7 };
const formSection = { padding: 15, border: "1px solid #2b342f", borderRadius: 18, background: "#111512" };
const CONF = { low: "נמוכה", medium: "בינונית", high: "גבוהה" };
const stepBtn = { width: 46, height: 46, border: "1px solid #26302f", background: "#1e1e23", color: "#f4f4f5", borderRadius: 14, fontSize: 24, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" };
const round = (n) => Math.round(Number(n) || 0);

// Add sheet — Quick / Manual / Photo. Opens over the active tab (design §2, "must be fast").
const MEALS = [["breakfast", "בוקר"], ["lunch", "צהריים"], ["dinner", "ערב"], ["snack", "נשנוש"]];
const MEASURES = ["יחידה", "כף", "כפית", "כוס", "פרוסה", "סקופ", "קופסה", "מנה", "100 גרם"];

export default function AddSheet({ tab, onTab, onClose, foods, form, isGeneralFood, onOpenGeneral, onBackGeneral, onBackPhoto, onField, onToggleSave, onSubmit, onQuickAdd, photo, photoFile, onPickPhoto, onAnalyzePhoto, photoGuidance, onPhotoGuidance, date, onDate, minDate, maxDate, mealType, onMealType, error, locked, saving, onBeginQuick }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const closeRef = useRef(null);
  const [q, setQ] = useState("");
  // ponytail: client-side substring filter on name; the list is tiny, no debounce needed.
  const ql = q.trim().toLowerCase();
  const shown = ql ? foods.filter((f) => (f.name || "").toLowerCase().includes(ql)) : foods;
  const [picking, setPicking] = useState(null); // food tapped from the grid, awaiting a quantity
  const [qty, setQty] = useState(1);
  const [quickEntryId, setQuickEntryId] = useState(null);
  const [quickFoodId, setQuickFoodId] = useState(null);
  const disabled = locked || saving;
  const photoControlsDisabled = disabled || photo.state === "loading";

  useEffect(() => {
    closeRef.current?.focus();
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const tabBtn = (key, text) => {
    const active = tab === key;
    return (
      <button disabled={disabled} aria-pressed={active} onClick={() => onTab(key)} style={{ minHeight: 44, flex: 1, border: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 800, padding: 9, borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, background: active ? "#235044" : "transparent", color: active ? "#68edc1" : "#8a9994" }}>{text}</button>
    );
  };

  const pickFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPickPhoto(file);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)", animation: "fadeIn .2s ease", cursor: disabled ? "wait" : "pointer" }} />
      <div role="dialog" aria-modal="true" aria-labelledby="add-sheet-title" aria-busy={saving} style={{ position: "relative", background: "rgba(15,19,17,.97)", WebkitBackdropFilter: "blur(24px)", backdropFilter: "blur(24px)", borderTop: "1px solid #34403b", borderRadius: "28px 28px 0 0", maxHeight: "92%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)", boxShadow: "0 -18px 50px rgba(0,0,0,.35)" }}>
        <div style={{ flex: "none", padding: "18px 20px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div id="add-sheet-title" style={{ fontSize: 22, fontWeight: 900 }}>הוספת מזון</div>
            <button ref={closeRef} onClick={onClose} aria-label="סגור" style={{ width: 44, height: 44, border: "1px solid #333c38", borderRadius: 14, background: "#202521", color: "#aab5b1", display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "wait" : "pointer" }}>
              <X size={18} />
            </button>
          </div>
          <div role="group" aria-label="שיטת הוספה" style={{ display: "flex", gap: 4, background: "#171b18", border: "1px solid #2b342f", padding: 4, borderRadius: 16 }}>
            {tabBtn("quick", "מהיר")}
            {tabBtn("manual", "ידני")}
            {tabBtn("photo", "צילום")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10, marginTop: 12 }}>
            <div><label htmlFor="add-date" style={label}>תאריך</label><input disabled={disabled} id="add-date" type="date" value={date} min={minDate} max={maxDate} onChange={(e) => onDate(e.target.value)} style={{ width: "100%", minHeight: 44, background: "#171b18", border: "1px solid #2b342f", borderRadius: 12, padding: "9px 10px", color: "#f4f7f6", fontSize: 14, fontFamily: "inherit", outline: "none", colorScheme: "dark" }} /></div>
            <div><label htmlFor="add-meal" style={label}>ארוחה</label><select disabled={disabled} id="add-meal" value={mealType} onChange={(event) => onMealType(event.target.value)} style={{ width: "100%", minHeight: 44, background: "#171b18", border: "1px solid #2b342f", borderRadius: 12, padding: "9px 10px", color: "#f4f7f6", fontSize: 14, fontFamily: "inherit" }}>{MEALS.map(([type, title]) => <option key={type} value={type}>{title}</option>)}</select></div>
          </div>
        </div>

        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 20px max(28px, env(safe-area-inset-bottom))" }}>
          {tab === "quick" && (
            picking ? (
              <QtyPanel food={picking} qty={qty} setQty={(value) => { onBeginQuick(); setQty(value); }} onBack={() => setPicking(null)} onAdd={() => onQuickAdd(picking, qty, quickEntryId)} error={error} disabled={disabled} />
            ) : (
              <>
                <button disabled={disabled} onClick={onOpenGeneral} style={{ width: "100%", minHeight: 48, marginBottom: 14, border: "1px solid #39e6b2", background: "transparent", color: "#39e6b2", borderRadius: 15, padding: "11px 14px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, fontFamily: "inherit", fontSize: 14, fontWeight: 800 }}>
                  + מוצר כללי
                </button>
                {foods.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "20px 0" }}>אין מאכלים שמורים עדיין</div>
                ) : (
                  <>
                    <input disabled={disabled} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מאכל…" aria-label="חיפוש מאכל" autoComplete="off" style={{ ...input, minHeight: 50, marginBottom: 12, background: "#171b18" }} />
                    {shown.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "20px 0" }}>לא נמצא מאכל בשם זה</div>
                    ) : (
                      <div style={{ overflow: "hidden", border: "1px solid #2b342f", borderRadius: 18, background: "#111512" }}>
                        {shown.map((f) => (
                          <button disabled={disabled} key={f.id} className="h-quick quick-food-card" onClick={() => { onBeginQuick(); if (quickFoodId !== f.id) { setQuickFoodId(f.id); setQuickEntryId(crypto.randomUUID()); setQty(Number(f.raw?.default_qty) || 1); } setPicking(f); }} style={{ minHeight: 72, textAlign: "right", border: 0, borderBottom: "1px solid #2b342f", background: "transparent", color: "#f4f7f6", padding: "13px 15px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 7 }}>
                            <div className="quick-food-name" style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                            <div className="quick-food-macros" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "ltr" }}>
                              <span className="quick-food-protein" style={{ fontSize: 13, fontWeight: 800, color: "#39e6b2", direction: "rtl" }}>{f.protein} גרם חלבון</span>
                              <span className="quick-food-calories" style={{ fontSize: 12, fontWeight: 700, color: "#7a7a82", direction: "rtl" }}>{f.calories} קל׳</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )
          )}

          {tab === "manual" && (
            <>
              {isGeneralFood && <button disabled={disabled} onClick={onBackGeneral} style={{ alignSelf: "flex-start", marginBottom: 14, background: "none", border: "none", color: "#8a8a93", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, padding: 0 }}>‹ חזרה לרשימה</button>}
              <ManualForm form={form} onField={onField} onToggleSave={onToggleSave} onSubmit={onSubmit} cta={saving ? "שומר..." : locked ? "נסה שוב לשמור את המאכל" : "הוסף לרישום"} showSave showMeasure showQuantity requireAll={isGeneralFood} error={error} locked={locked} saving={saving} />
            </>
          )}

          {tab === "photo" && (
            <div>
              <input disabled={photoControlsDisabled} ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pickFile} />
              <input disabled={photoControlsDisabled} ref={galleryRef} type="file" accept="image/*" hidden onChange={pickFile} />

              <div style={{ marginBottom: 14 }}>
                <label style={label}>פרטים נוספים על המנה (אופציונלי)</label>
                <textarea disabled={photoControlsDisabled} value={photoGuidance} onChange={(e) => onPhotoGuidance(e.target.value)} maxLength={1000} rows={3}
                  placeholder="למשל: שווארמה הודו עם פיתה, טחינה וסלט. בערך 150 גרם בשר"
                  aria-label="פרטים נוספים על המנה" style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
                <div style={{ color: "#6f6f78", fontSize: 12, marginTop: 6 }}>המידע יעזור ל-AI לזהות מרכיבים וכמויות בתמונה.</div>
              </div>

              {photo.state === "idle" && (
                <div>
                  <div style={{ width: "100%", border: "2px dashed #2e2e36", background: "#141417", borderRadius: 20, padding: "26px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(52,211,153,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#39e6b2" }}>
                      <Camera size={30} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#f4f4f5" }}>{photoFile ? "התמונה מוכנה לניתוח" : "צלם או בחר תמונה"}</div>
                      <div style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "#6f6f78", marginTop: 3 }}>{photoFile ? photoFile.name : "הוסף פרטים ואז שלח את הכול יחד ל-AI"}</div>
                    </div>
                    <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <button disabled={photoControlsDisabled} className="h-drop" onClick={() => cameraRef.current?.click()} style={{ border: "1px solid #1f3831", background: "#101918", color: "#39e6b2", borderRadius: 14, padding: "12px 8px", cursor: photoControlsDisabled ? "not-allowed" : "pointer", opacity: photoControlsDisabled ? .45 : 1, fontFamily: "inherit", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                        <Camera size={17} /> צלם עכשיו
                      </button>
                      <button disabled={photoControlsDisabled} className="h-drop" onClick={() => galleryRef.current?.click()} style={{ border: "1px solid #26302f", background: "#111718", color: "#c4c4c9", borderRadius: 14, padding: "12px 8px", cursor: photoControlsDisabled ? "not-allowed" : "pointer", opacity: photoControlsDisabled ? .45 : 1, fontFamily: "inherit", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                        <ImageIcon size={17} /> בחר מהגלריה
                      </button>
                    </div>
                    <button onClick={onAnalyzePhoto} disabled={!photoFile || photoControlsDisabled} style={{ width: "100%", border: "none", background: "linear-gradient(180deg,#39e6b2,#16a985)", color: "#03120d", borderRadius: 14, padding: "13px 10px", cursor: photoFile && !photoControlsDisabled ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 14, fontWeight: 900, opacity: photoFile && !photoControlsDisabled ? 1 : .45 }}>
                      נתח תמונה
                    </button>
                  </div>
                  {photo.error ? (
                    <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#fb7185" }}>{photo.error}</div>
                  ) : (
                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontSize: 12, color: "#5f5f68" }}>
                      <Info size={14} /> הערכת יתרה מקומית: {photo.quota} ניתוחים היום
                    </div>
                  )}
                </div>
              )}

              {photo.state === "loading" && (
                <div style={{ padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                  <div style={{ width: 48, height: 48, border: "4px solid #1e2e26", borderTopColor: "#39e6b2", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#c4c4c9" }}>מנתח את התמונה...</div>
                </div>
              )}

              {photo.state === "done" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <button disabled={disabled} onClick={onBackPhoto} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#8a8a93", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, padding: 0 }}>‹ חזרה לבחירת תמונה</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#101918", border: "1px solid #1f3831", borderRadius: 14, padding: "12px 14px" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(52,211,153,.15)", color: "#39e6b2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>AI</span>
                    <div style={{ flex: 1 }}>
                      {photo.stale ? (
                        <>
                          <div role="status" style={{ fontSize: 13, fontWeight: 700, color: "#fb923c" }}>התיאור השתנה מאז הניתוח</div>
                          <div style={{ fontSize: 12, color: "#8a8a93", marginTop: 1 }}>הערכים המוצגים הם מהניתוח הקודם.</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#39e6b2" }}>זוהה · ודאות {CONF[photo.confidence] || "בינונית"}</div>
                          {photo.note && <div style={{ fontSize: 12, color: "#8a8a93", marginTop: 1 }}>{photo.note} · ניתן לתקן</div>}
                        </>
                      )}
                    </div>
                  </div>
                  {photo.stale && <button disabled={!photoFile || disabled} onClick={onAnalyzePhoto} style={{ border: "none", background: "linear-gradient(180deg,#39e6b2,#16a985)", color: "#03120d", borderRadius: 13, padding: "11px 12px", cursor: photoFile && !disabled ? "pointer" : "not-allowed", opacity: photoFile && !disabled ? 1 : .45, fontFamily: "inherit", fontSize: 13, fontWeight: 900 }}>נתח שוב עם התיאור המעודכן</button>}
                  <ManualForm form={form} onField={onField} onToggleSave={onToggleSave} onSubmit={onSubmit} cta={saving ? "שומר..." : locked ? "נסה שוב לשמור את המאכל" : "אשר והוסף"} showSave error={error} locked={locked} saving={saving} />
                  <button disabled={disabled} onClick={() => galleryRef.current?.click()} style={{ border: "1px solid #26302f", background: "#111718", color: "#c4c4c9", borderRadius: 13, padding: "11px 12px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, fontFamily: "inherit", fontSize: 13, fontWeight: 800 }}>בחר תמונה אחרת לניתוח</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Quantity step: choose how many servings of a saved food to log (foods store per-1 macros).
function QtyPanel({ food, qty, setQty, onBack, onAdd, error, disabled }) {
  const p = Number(food.raw?.protein_g) || food.protein || 0;
  const c = Number(food.raw?.calories) || food.calories || 0;
  const n = Number(qty) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button disabled={disabled} onClick={onBack} style={{ alignSelf: "flex-start", minHeight: 44, background: "none", border: "none", color: "#8a9994", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, padding: "0 4px" }}>‹ חזרה לרשימה</button>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5" }}>{food.name}</div>
        <div style={{ fontSize: 13, color: "#8a9994", marginTop: 4, direction: "rtl" }}>{round(p)} גרם חלבון · {round(c)} קל׳ ל{food.unit || "מנה"}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <button disabled={disabled} onClick={() => setQty(Math.max(1, n - 1))} aria-label="הפחת כמות" style={{ ...stepBtn, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1 }}>−</button>
        <input disabled={disabled} value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="כמות"
          style={{ width: 76, textAlign: "center", background: "#111718", border: "1px solid #26302f", borderRadius: 14, padding: 12, color: "#f4f4f5", fontSize: 26, fontWeight: 800, fontFamily: "inherit", outline: "none" }} />
        <button disabled={disabled} onClick={() => setQty(n + 1)} aria-label="הוסף כמות" style={{ ...stepBtn, border: "1px solid #1f3831", background: "#101918", color: "#39e6b2", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1 }}>+</button>
      </div>

      <div style={{ textAlign: "center", background: "#101918", border: "1px solid #1f3831", borderRadius: 14, padding: "12px 14px", direction: "rtl" }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#39e6b2" }}>{round(p * n)} גרם חלבון</span>
        <span style={{ color: "#7a7a82", margin: "0 8px" }}>·</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fb923c" }}>{round(c * n)} קל׳</span>
      </div>

      <button disabled={disabled} onClick={onAdd} style={{ border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#39e6b2,#16a985)", color: "#03120d", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 15, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1 }}>{disabled ? "שומר..." : "הוסף לרישום"}</button>
      {error && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{error}</div>}
    </div>
  );
}

// Shared name/protein/calories form — manual entry and the editable AI result.
function ManualForm({ form, onField, onToggleSave, onSubmit, cta, showSave, showMeasure = false, showQuantity = false, requireAll = false, error, locked, saving }) {
  const selectedUnit = MEASURES.includes(form.unit) ? form.unit : "אחר";
  const customMeasureMissing = showMeasure && form.save && selectedUnit === "אחר" && !(form.unit || "").trim();
  const validNumber = (value) => String(value ?? "").trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
  const validQuantity = String(form.quantity ?? "").trim() !== "" && Number.isFinite(Number(form.quantity)) && Number(form.quantity) > 0;
  const quantity = validQuantity ? Number(form.quantity) : 0;
  const previewValue = (value) => Number.isFinite(Number(value)) ? Number(value) * quantity : 0;
  const invalidName = requireAll && !(form.name || "").trim();
  const invalidProtein = requireAll && !validNumber(form.protein);
  const invalidCalories = requireAll && !validNumber(form.calories);
  const invalidQuantity = showQuantity && !validQuantity;
  const invalidGeneralFood = invalidName || invalidProtein || invalidCalories || invalidQuantity;
  const controlsDisabled = locked || saving;
  const submitDisabled = saving || customMeasureMissing || invalidGeneralFood;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={formSection}>
      <div>
        <label style={label}>שם {showSave && !requireAll ? "(אופציונלי)" : ""}</label>
        <input disabled={controlsDisabled} value={form.name} onChange={(e) => onField("name", e.target.value)} placeholder="למשל: חזה עוף" aria-label="שם" style={input} />
        {invalidName && <div style={{ color: "#fb7185", fontSize: 12, fontWeight: 700, marginTop: 7 }}>יש להזין שם למאכל</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <div>
          <label style={label}>חלבון (גרם)</label>
          <input disabled={controlsDisabled} value={form.protein} onChange={(e) => onField("protein", e.target.value)} inputMode="decimal" aria-label="חלבון בגרמים" placeholder="0" style={{ ...input, color: "#39e6b2", fontSize: 18, fontWeight: 800 }} />
          {invalidProtein && <div style={{ color: "#fb7185", fontSize: 12, fontWeight: 700, marginTop: 7 }}>יש להזין חלבון תקין</div>}
        </div>
        <div>
          <label style={label}>קלוריות</label>
          <input disabled={controlsDisabled} value={form.calories} onChange={(e) => onField("calories", e.target.value)} inputMode="decimal" aria-label="קלוריות" placeholder="0" style={{ ...input, color: "#fb923c", fontSize: 18, fontWeight: 800 }} />
          {invalidCalories && <div style={{ color: "#fb7185", fontSize: 12, fontWeight: 700, marginTop: 7 }}>יש להזין קלוריות תקינות</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "#75827d", fontSize: 12, fontWeight: 700 }}>
        <span style={{ width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 7, background: "#1f3831", color: "#39e6b2" }}>1</span>
        הערכים יישמרו עבור יחידה אחת
      </div>
      </section>
      {showMeasure && (
        <section style={formSection}>
          <label style={label}>מידה יומית</label>
          <select disabled={controlsDisabled} value={selectedUnit} onChange={(e) => onField("unit", e.target.value === "אחר" ? "" : e.target.value)} aria-label="מידה יומית" style={input}>
            {MEASURES.map((measure) => <option key={measure} value={measure}>{measure}</option>)}
            <option value="אחר">אחר</option>
          </select>
          {selectedUnit === "אחר" && <input disabled={controlsDisabled} value={form.unit || ""} onChange={(e) => onField("unit", e.target.value)} placeholder="למשל: חצי כוס" aria-label="מידה מותאמת" style={{ ...input, marginTop: 10 }} />}
          {customMeasureMissing && <div style={{ color: "#fb7185", fontSize: 12, fontWeight: 700, marginTop: 7 }}>יש להזין מידה מותאמת</div>}
        </section>
      )}
      {showQuantity && (
        <section style={formSection}>
          <div>
            <label style={label}>כמות</label>
            <input disabled={controlsDisabled} value={form.quantity} onChange={(e) => onField("quantity", e.target.value)} inputMode="decimal" aria-label="כמות" placeholder="1" style={input} />
            {invalidQuantity && <div style={{ color: "#fb7185", fontSize: 12, fontWeight: 700, marginTop: 7 }}>יש להזין כמות גדולה מאפס</div>}
          </div>
          <div style={{ marginTop: 10, textAlign: "center", background: "#15231e", border: "1px solid #315548", borderRadius: 13, padding: "12px 14px", direction: "rtl" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#39e6b2" }}>{round(previewValue(form.protein))} גרם חלבון</span>
            <span style={{ color: "#7a7a82", margin: "0 8px" }}>·</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fb923c" }}>{round(previewValue(form.calories))} קל׳</span>
          </div>
        </section>
      )}
      {showQuantity && (
        <section style={formSection}>
          <label style={label}>משקל שנאכל (גרם, אופציונלי)</label>
          <input disabled={controlsDisabled} value={form.grams} onChange={(e) => onField("grams", e.target.value)} inputMode="decimal" aria-label="משקל שנאכל בגרמים" placeholder="למשל: 200" style={input} />
          <div style={{ color: "#6f6f78", fontSize: 12, marginTop: 6 }}>אם המידה היא בגרמים ולא הוזן משקל, הוא יחושב לפי הכמות.</div>
        </section>
      )}
      {showSave && (
        <button type="button" role="switch" aria-checked={form.save} disabled={controlsDisabled} onClick={onToggleSave} style={{ minHeight: 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#111512", border: "1px solid #2b342f", borderRadius: 18, cursor: controlsDisabled ? "not-allowed" : "pointer", opacity: controlsDisabled ? .6 : 1, fontFamily: "inherit", padding: "10px 14px" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#dce4e1" }}>שמור למאכלים שלי</span>
          <span aria-hidden="true" style={{ width: 48, height: 28, borderRadius: 99, padding: 3, background: form.save ? "#39e6b2" : "#343c38", display: "flex", justifyContent: form.save ? "flex-end" : "flex-start", transition: "background .2s ease" }}><span style={{ width: 22, height: 22, borderRadius: "50%", background: "#f4f7f6", boxShadow: "0 1px 4px rgba(0,0,0,.35)" }} /></span>
        </button>
      )}
      {error && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{error}</div>}
      <button disabled={submitDisabled} onClick={onSubmit} style={{ position: "sticky", bottom: 0, minHeight: 52, marginTop: 4, border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#39e6b2,#24bd91)", color: "#03120d", fontSize: 16, fontWeight: 900, padding: 15, borderRadius: 16, cursor: submitDisabled ? "not-allowed" : "pointer", opacity: submitDisabled ? .45 : 1, boxShadow: "0 -10px 26px #0f1311" }}>{cta}</button>
    </div>
  );
}
