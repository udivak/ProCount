import { useRef, useState } from "react";
import { X, Camera, ImageIcon, Info } from "../lib/icons.jsx";

const input = { width: "100%", background: "#111718", border: "1px solid #26302f", borderRadius: 14, padding: 14, color: "#f4f4f5", fontSize: 16, fontFamily: "inherit", outline: "none" };
const label = { fontSize: 13, fontWeight: 600, color: "#8a8a93", display: "block", marginBottom: 7 };
const CONF = { low: "נמוכה", medium: "בינונית", high: "גבוהה" };
const stepBtn = { width: 46, height: 46, border: "1px solid #26302f", background: "#1e1e23", color: "#f4f4f5", borderRadius: 14, fontSize: 24, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" };
const round = (n) => Math.round(Number(n) || 0);

// Add sheet — Quick / Manual / Photo. Opens over the active tab (design §2, "must be fast").
const MEALS = [["breakfast", "בוקר"], ["lunch", "צהריים"], ["dinner", "ערב"], ["snack", "נשנוש"]];
const MEASURES = ["יחידה", "כף", "כפית", "כוס", "פרוסה", "סקופ", "קופסה", "מנה", "100 גרם"];

export default function AddSheet({ tab, onTab, onClose, foods, form, isGeneralFood, onOpenGeneral, onBackGeneral, onBackPhoto, onField, onToggleSave, onSubmit, onQuickAdd, photo, photoFile, onPickPhoto, onAnalyzePhoto, photoGuidance, onPhotoGuidance, date, onDate, minDate, maxDate, mealType, onMealType, error, locked, saving, onBeginQuick }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [q, setQ] = useState("");
  // ponytail: client-side substring filter on name; the list is tiny, no debounce needed.
  const ql = q.trim().toLowerCase();
  const shown = ql ? foods.filter((f) => (f.name || "").toLowerCase().includes(ql)) : foods;
  const [picking, setPicking] = useState(null); // food tapped from the grid, awaiting a quantity
  const [qty, setQty] = useState(1);
  const [quickEntryId, setQuickEntryId] = useState(null);
  const [quickFoodId, setQuickFoodId] = useState(null);
  const disabled = locked || saving;

  const tabBtn = (key, text) => {
    const active = tab === key;
    return (
      <button disabled={disabled} onClick={() => onTab(key)} style={{ flex: 1, border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 800, padding: 9, borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, background: active ? "#39e6b2" : "transparent", color: active ? "#03120d" : "#8a8a93" }}>{text}</button>
    );
  };

  const pickFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPickPhoto(file);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{ position: "relative", background: "#0b1112", borderTop: "1px solid #26302f", borderRadius: "26px 26px 0 0", maxHeight: "90%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ flex: "none", padding: "14px 20px 8px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "#33333a", margin: "0 auto 16px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>הוספת מזון</div>
            <button onClick={onClose} aria-label="סגור" style={{ width: 34, height: 34, border: "none", borderRadius: 10, background: "#1e1e23", color: "#8a8a93", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, background: "#1a1a1e", padding: 5, borderRadius: 14 }}>
            {tabBtn("quick", "מהיר")}
            {tabBtn("manual", "ידני")}
            {tabBtn("photo", "צילום")}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
            <label htmlFor="add-date" style={label}>תאריך</label>
            <input disabled={disabled} id="add-date" type="date" value={date} min={minDate} max={maxDate} onChange={(e) => onDate(e.target.value)}
              style={{ background: "#111718", border: "1px solid #26302f", borderRadius: 12, padding: "10px 12px", color: "#f4f4f5", fontSize: 15, fontFamily: "inherit", outline: "none", colorScheme: "dark" }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={label}>ארוחה</label>
            <div style={{ display: "flex", gap: 6 }}>
              {MEALS.map(([type, title]) => <button disabled={disabled} key={type} onClick={() => onMealType(type)} style={{ flex: 1, border: `1px solid ${mealType === type ? "#39e6b2" : "#26302f"}`, background: mealType === type ? "rgba(57,230,178,.14)" : "#111718", color: mealType === type ? "#39e6b2" : "#8a8a93", borderRadius: 10, padding: "8px 4px", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1 }}>{title}</button>)}
            </div>
          </div>
        </div>

        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 20px 28px" }}>
          {tab === "quick" && (
            picking ? (
              <QtyPanel food={picking} qty={qty} setQty={(value) => { onBeginQuick(); setQty(value); }} onBack={() => setPicking(null)} onAdd={() => onQuickAdd(picking, qty, quickEntryId)} error={error} disabled={disabled} />
            ) : (
              <>
                <button disabled={disabled} onClick={onOpenGeneral} style={{ width: "100%", marginBottom: 14, border: "1px dashed #2d6354", background: "#0e1c19", color: "#39e6b2", borderRadius: 14, padding: "11px 14px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, fontFamily: "inherit", fontSize: 13, fontWeight: 800 }}>
                  + מוצר כללי · הזן ערכים למידה אחת
                </button>
                {foods.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "20px 0" }}>אין מאכלים שמורים עדיין</div>
                ) : (
                  <>
                    <input disabled={disabled} value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מאכל…" aria-label="חיפוש מאכל"
                      style={{ ...input, marginBottom: 12 }} />
                    {shown.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "20px 0" }}>לא נמצא מאכל בשם זה</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                        {shown.map((f) => (
                          <button disabled={disabled} key={f.id} className="h-quick quick-food-card" onClick={() => { onBeginQuick(); if (quickFoodId !== f.id) { setQuickFoodId(f.id); setQuickEntryId(crypto.randomUUID()); setQty(Number(f.raw?.default_qty) || 1); } setPicking(f); }} style={{ textAlign: "right", border: "1px solid #232328", background: "#111718", borderRadius: 16, padding: 14, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
                            <div className="quick-food-name" style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                            <div className="quick-food-macros" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "ltr" }}>
                              <span className="quick-food-protein" style={{ fontSize: 13, fontWeight: 800, color: "#39e6b2", direction: "rtl" }}>{f.protein}g חלבון</span>
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
              <input disabled={disabled} ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pickFile} />
              <input disabled={disabled} ref={galleryRef} type="file" accept="image/*" hidden onChange={pickFile} />

              <div style={{ marginBottom: 14 }}>
                <label style={label}>פרטים נוספים על המנה (אופציונלי)</label>
                <textarea disabled={disabled} value={photoGuidance} onChange={(e) => onPhotoGuidance(e.target.value)} maxLength={1000} rows={3}
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
                      <button disabled={disabled} className="h-drop" onClick={() => cameraRef.current?.click()} style={{ border: "1px solid #1f3831", background: "#101918", color: "#39e6b2", borderRadius: 14, padding: "12px 8px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, fontFamily: "inherit", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                        <Camera size={17} /> צלם עכשיו
                      </button>
                      <button disabled={disabled} className="h-drop" onClick={() => galleryRef.current?.click()} style={{ border: "1px solid #26302f", background: "#111718", color: "#c4c4c9", borderRadius: 14, padding: "12px 8px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, fontFamily: "inherit", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                        <ImageIcon size={17} /> בחר מהגלריה
                      </button>
                    </div>
                    <button onClick={onAnalyzePhoto} disabled={!photoFile || disabled} style={{ width: "100%", border: "none", background: "linear-gradient(180deg,#39e6b2,#16a985)", color: "#03120d", borderRadius: 14, padding: "13px 10px", cursor: photoFile && !disabled ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 14, fontWeight: 900, opacity: photoFile && !disabled ? 1 : .45 }}>
                      נתח תמונה
                    </button>
                  </div>
                  {photo.error ? (
                    <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#fb7185" }}>{photo.error}</div>
                  ) : (
                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontSize: 12, color: "#5f5f68" }}>
                      <Info size={14} /> נותרו {photo.quota} ניתוחים היום
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
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#39e6b2" }}>זוהה · ודאות {CONF[photo.confidence] || "בינונית"}</div>
                      {photo.note && <div style={{ fontSize: 12, color: "#8a8a93", marginTop: 1 }}>{photo.note} · ניתן לתקן</div>}
                    </div>
                  </div>
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
      <button disabled={disabled} onClick={onBack} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#8a8a93", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1, padding: 0 }}>‹ חזרה לרשימה</button>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5" }}>{food.name}</div>
        <div style={{ fontSize: 13, color: "#6f6f78", marginTop: 4, direction: "rtl" }}>{round(p)}g חלבון · {round(c)} קל׳ ל{food.unit || "מנה"}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <button disabled={disabled} onClick={() => setQty(Math.max(1, n - 1))} aria-label="הפחת כמות" style={{ ...stepBtn, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1 }}>−</button>
        <input disabled={disabled} value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="כמות"
          style={{ width: 76, textAlign: "center", background: "#111718", border: "1px solid #26302f", borderRadius: 14, padding: 12, color: "#f4f4f5", fontSize: 26, fontWeight: 800, fontFamily: "inherit", outline: "none" }} />
        <button disabled={disabled} onClick={() => setQty(n + 1)} aria-label="הוסף כמות" style={{ ...stepBtn, border: "1px solid #1f3831", background: "#101918", color: "#39e6b2", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1 }}>+</button>
      </div>

      <div style={{ textAlign: "center", background: "#101918", border: "1px solid #1f3831", borderRadius: 14, padding: "12px 14px", direction: "rtl" }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#39e6b2" }}>{round(p * n)}g חלבון</span>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={label}>שם {showSave && !requireAll ? "(אופציונלי)" : ""}</label>
        <input disabled={controlsDisabled} value={form.name} onChange={(e) => onField("name", e.target.value)} placeholder="למשל: חזה עוף" aria-label="שם" style={input} />
        {invalidName && <div style={{ color: "#fb7185", fontSize: 12, fontWeight: 700, marginTop: 7 }}>יש להזין שם למאכל</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#697874", fontSize: 12, fontWeight: 700 }}>
        <span style={{ width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 7, background: "#1f3831", color: "#39e6b2" }}>1</span>
        הערכים יישמרו עבור יחידה אחת
      </div>
      {showQuantity && (
        <>
          <div>
            <label style={label}>כמות</label>
            <input disabled={controlsDisabled} value={form.quantity} onChange={(e) => onField("quantity", e.target.value)} inputMode="decimal" aria-label="כמות" placeholder="1" style={input} />
            {invalidQuantity && <div style={{ color: "#fb7185", fontSize: 12, fontWeight: 700, marginTop: 7 }}>יש להזין כמות גדולה מאפס</div>}
          </div>
          <div style={{ textAlign: "center", background: "#101918", border: "1px solid #1f3831", borderRadius: 14, padding: "12px 14px", direction: "rtl" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#39e6b2" }}>{round(previewValue(form.protein))}g חלבון</span>
            <span style={{ color: "#7a7a82", margin: "0 8px" }}>·</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fb923c" }}>{round(previewValue(form.calories))} קל׳</span>
          </div>
        </>
      )}
      {showMeasure && (
        <div>
          <label style={label}>מידה יומית</label>
          <select disabled={controlsDisabled} value={selectedUnit} onChange={(e) => onField("unit", e.target.value === "אחר" ? "" : e.target.value)} aria-label="מידה יומית" style={input}>
            {MEASURES.map((measure) => <option key={measure} value={measure}>{measure}</option>)}
            <option value="אחר">אחר</option>
          </select>
          {selectedUnit === "אחר" && <input disabled={controlsDisabled} value={form.unit || ""} onChange={(e) => onField("unit", e.target.value)} placeholder="למשל: חצי כוס" aria-label="מידה מותאמת" style={{ ...input, marginTop: 10 }} />}
          {customMeasureMissing && <div style={{ color: "#fb7185", fontSize: 12, fontWeight: 700, marginTop: 7 }}>יש להזין מידה מותאמת</div>}
        </div>
      )}
      {showQuantity && (
        <div>
          <label style={label}>משקל שנאכל (גרם, אופציונלי)</label>
          <input disabled={controlsDisabled} value={form.grams} onChange={(e) => onField("grams", e.target.value)} inputMode="decimal" aria-label="משקל שנאכל בגרמים" placeholder="למשל: 200" style={input} />
          <div style={{ color: "#6f6f78", fontSize: 12, marginTop: 6 }}>אם המידה היא בגרמים ולא הוזן משקל, הוא יחושב לפי הכמות.</div>
        </div>
      )}
      {showSave && (
        <button disabled={controlsDisabled} onClick={onToggleSave} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: controlsDisabled ? "not-allowed" : "pointer", opacity: controlsDisabled ? .6 : 1, fontFamily: "inherit", padding: 2 }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${form.save ? "#39e6b2" : "#3a3a42"}`, background: form.save ? "#39e6b2" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#03120d" }}>{form.save ? "✓" : ""}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#c4c4c9" }}>שמור למאכלים שלי</span>
        </button>
      )}
      <button disabled={submitDisabled} onClick={onSubmit} style={{ marginTop: 4, border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#39e6b2,#16a985)", color: "#03120d", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 15, cursor: submitDisabled ? "not-allowed" : "pointer", opacity: submitDisabled ? .45 : 1 }}>{cta}</button>
      {error && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{error}</div>}
    </div>
  );
}
