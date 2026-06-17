# Handoff: ProCount — מעקב חלבון וקלוריות

## Overview
ProCount is a personal, single-user mobile web app (PWA, used primarily on iPhone) for daily tracking of **protein** and **calories**. The guiding principle is *efficient, convenient, not complicated* — protein has a daily goal; calories are a running number with no goal. This package contains the **visual/UX design** for the app. The functional spec (data model, Supabase backend, AI photo flow, auth) lives in `procount-spec.md`.

The design is **fully Hebrew, RTL, dark-mode, mobile-first** (390 × 844, iPhone-class viewport).

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, **not production code to copy directly**. `ProCount.dc.html` is a "Design Component" that uses a custom runtime (`<x-dc>`, `<sc-if>`, `<sc-for>`, `{{ }}` holes, a `DCLogic` class) — that runtime is **not** a shippable framework.

Your task: **recreate this design in the target codebase's environment** using its established patterns and libraries. Per the spec, the intended stack is a **React/Vite SPA packaged as a PWA + Supabase** (Postgres + Auth + an Edge Function for AI photo analysis). If you're starting fresh, React + Vite + a Supabase client is the recommended target. Treat the HTML as the source of truth for *visuals and interaction*, and `procount-spec.md` as the source of truth for *data, backend, and business logic*.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interactions are all specified. Recreate the UI pixel-accurately. All hex values, sizes, and copy below are exact and taken from the prototype.

---

## Layout Shell (applies to all screens)

- Root frame: `390 × 844`, `background #0a0a0c`, `color #f4f4f5`, `dir="rtl"`, `font-family: Heebo`, `display:flex; flex-direction:column; overflow:hidden; position:relative`.
- **Header** (`flex:none`, padding `18px 20px 10px`): right side = two-line title (subtitle `13px/600 #6f6f78` over title `24px/800`); left side = settings gear button (`42×42`, radius `14px`, bg `#161619`, icon `#8a8a93`; hover bg `#1e1e23` icon `#f4f4f5`).
- **Scroll content** (`flex:1; overflow-y:auto; padding:0 20px 110px`). Scrollbar hidden.
- **FAB** "הוסף" (Add): centered, `bottom:90px`, gradient `linear-gradient(180deg,#34d399,#1f9d6f)`, text `#06120c 16px/800`, padding `15px 28px`, radius `999px`, shadow `0 8px 28px rgba(52,211,153,.45), 0 2px 8px rgba(0,0,0,.4)`. Hidden when the add-sheet or settings overlay is open.
- **Bottom nav** (`position:absolute; bottom:0; height:80px`): `background rgba(10,10,12,.92)`, `backdrop-filter:blur(16px)`, top border `#1c1c20`, padding `8px 16px 22px`. Three equal tabs, each a column (icon 24px + label `11px/700`). Active tab color `#34d399`, inactive `#6f6f78`.

### Navigation model
3 bottom tabs — **היום (Today) · מגמות (Trends) · מאכלים (My Foods)**. Settings is **not** a tab; it opens as a full-screen overlay from the header gear. The Add flow opens as a bottom sheet over any tab.

---

## Screens / Views

### 1. היום — Today (home)
Header subtitle "יום רביעי, 18 ביוני", title "ProCount".

**This screen has TWO design variations** (a prop `homeStyle` toggles them — in the prototype it's a tweak; in production pick ONE, default **ring**):

**Variation A — `ring`** (default):
- Hero card: `background linear-gradient(160deg,#16201b,#121214)`, border `1px #21302a`, radius `28px`, padding `26px 20px 22px`, centered column. Decorative radial glow top-right (`rgba(52,211,153,.16)`).
- Label "חלבון היום" (`13px/600 #7bd6ad`).
- **Progress ring**: SVG `208×208`, rotated `-90deg`. Track circle r=78, stroke `#1c2a24`, width 16. Progress circle r=78, stroke `#34d399`, width 16, `stroke-linecap:round`, `stroke-dasharray:490`, `stroke-dashoffset = 490 × (1 − pct)` where `pct = min(1, total/goal)`. Drop-shadow `0 0 8px rgba(52,211,153,.5)`; draw-in animation 1s ease-out.
- Center of ring: total protein number `56px/900`, then "מתוך {goal} גרם" `14px/600 #6f6f78`.
- Pill below ring: bg `#0f1714`, border `#1f2e27`, radius `999px` — "נשאר {remaining} גרם" (`15px/700 #34d399`) · "{pct}% מהיעד" (`13px/600 #8a8a93`).
- **Calories strip** (below card): row card bg `#161619`, border `#232328`, radius `20px`, padding `16px 20px`. Left: amber flame icon in `40×40` rounded tile (`rgba(251,191,36,.12)`) + "קלוריות היום" / "ללא יעד · מספר רץ". Right: calorie total `26px/800 #fbbf24`.

**Variation B — `panel`**:
- Hero card (similar gradient/border, radius `24px`): top row shows big protein number `52px/900` + "/ {goal}g" (`18px/700 #6f6f78`) on the right; "נשאר {remaining}g" (`28px/800 #34d399`) on the left.
- Horizontal progress bar: track `#1c2a24`, height `14px`, radius `999px`; fill width = `{pct}%`, `linear-gradient(90deg,#1f8a5b,#34d399)`, glow `0 0 12px rgba(52,211,153,.5)`. "{pct}% מהיעד" caption below.
- Two stat cards (grid 1fr 1fr): "קלוריות" (`28px/800 #fbbf24`, "ללא יעד") and "רישומים" (count `28px/800`, "ארוחות היום").

**Today entries list** (both variations):
- Section header row: "מה אכלת היום" (`16px/700`) + "{count} פריטים" (`13px/600 #6f6f78`).
- Entry rows (gap 10px): card bg `#161619`, border `#1f1f24`, radius `18px`, padding `14px 16px`, flex row. Left→right (RTL): source-tag tile (`38×38`, radius 11px) → name (`15px/700`, ellipsis) + sub (`12px/500 #6f6f78`) → protein `16px/800 #34d399` + calories `11px/600 #7a7a82` → delete button (`30×30`; hover bg `#241619`, icon `#fb7185`).
- **Source tags**: `saved`→"מהיר" (bg `rgba(52,211,153,.12)`, icon `#34d399`); `manual`→"ידני" (bg `rgba(96,165,250,.12)`, icon `#60a5fa`); `ai`→"AI" (bg `rgba(167,139,250,.14)`, icon `#a78bfa`).

### 2. הוספה — Add (bottom sheet)
Most-used screen; must be fast. Opens over the current tab. Backdrop `rgba(0,0,0,.6)` (fadeIn .2s), tapping it closes. Sheet: bg `#121215`, top border `#2a2a30`, radius `26px 26px 0 0`, `max-height:90%`, slide-up `sheetUp .28s cubic-bezier(.2,.8,.2,1)`. Grab-handle `40×4` `#33333a`. Title "הוספת מזון" `20px/800` + close button.

**Segmented tabs** (bg `#1a1a1e`, padding 5px, radius 14px): מהיר / ידני / צילום. Active pill bg `#2c2c33`, text `#f4f4f5`; inactive text `#8a8a93`.

- **מהיר (Quick)**: 2-col grid of saved-food buttons. Each: bg `#18181c`, border `#232328`, radius 16px, padding 14px; name `14px/700` + protein `15px/800 #34d399` + calories `12px/600 #7a7a82`. Hover border `#34d399`, bg `#16201b`. **Tap = immediately adds an entry** (source `saved`, qty ×1) and closes the sheet.
- **ידני (Manual)**: form — name (optional) text input; protein (numeric, text `#34d399`) + calories (numeric, text `#fbbf24`) in a 2-col grid; "שמור למאכלים שלי" checkbox (custom `22×22` box; checked = bg/border `#34d399`, ✓ `#06120c`); primary "הוסף לרישום" button. Inputs: bg `#18181c`, border `#2a2a30`, radius 14px, padding 14px. Submitting creates an entry (source `manual`); if checkbox on, also creates a saved food.
- **צילום (Photo)**: three states.
  - *idle*: dashed dropzone (border `2px dashed #2e2e36`, hover `#34d399`) with camera icon tile + "צלם או בחר תמונה" / "Claude יאמוד חלבון וקלוריות"; below it "נותרו {quota} ניתוחים היום" (quota = 6 − today's AI entries — soft daily AI cap of 6, per spec).
  - *loading*: spinner (`48×48`, border `#1e2e26`, top `#34d399`, `spin .8s linear infinite`) + "מנתח את התמונה...".
  - *done*: AI result banner (bg `#16201b`, border `#21302a`) "זוהה · ודאות בינונית" + assumption note; then **editable** name/protein/calories fields (same styling as manual) + "אשר והוסף" button. Result must always be editable before saving (source `ai`).

### 3. מגמות — Trends
Header subtitle "מעקב לאורך זמן", title "מגמות".
- Two stat cards (grid): **streak** card (warm gradient `linear-gradient(150deg,#241a12,#161619)`, border `#34291a`, orange flame `#fb923c`) — "רצף ימים", value `34px/900`, "ימים ברצף ביעד". **Average** card (bg `#161619`) — "ממוצע שבועי", value `34px/900 #34d399` + "g", "חלבון ליום".
- **Protein bar chart** card (bg `#161619`, border `#232328`, radius 22px): header "חלבון · 7 ימים" + שבוע/חודש pills (active שבוע: bg `#34d399`, text `#0a0a0c`). Chart area height 148px, bars flex-end. Dashed goal line at `bottom = goal/200 × 132 px` (border-top `1.5px dashed #34d399`, opacity .55) with "יעד {goal}" label. Each bar: `max-width 26px`, `height = val/200 × 132 px`, radius `7px 7px 4px 4px`. Today's bar = gradient `linear-gradient(180deg,#6ee7b7,#34d399)` + glow; days that met goal = `#2a9d6f`; missed = `#2b2b31`. Day labels `11px/600` (today `#34d399`, else `#6f6f78`).
- **Calories secondary** card: "קלוריות · ממוצע שבועי" + value `26px/800 #fbbf24` + a small amber polyline sparkline.

### 4. מאכלים שלי — My Foods
Header subtitle "התבניות שלי", title "מאכלים שלי".
- Top row: "{n} מאכלים שמורים" + "מאכל חדש" button (border `#21302a`, bg `#16201b`, text `#34d399`, plus icon) → opens Add sheet on the Manual tab.
- Food rows (bg `#161619`, border `#1f1f24`, radius 18px, padding `14px 16px`): name `15px/700` + unit `12px/500 #6f6f78`; two centered stats — protein `16px/800 #34d399` ("חלבון") and calories `16px/800 #fbbf24` ("קל'"); an edit (pencil) button (hover bg `#1e1e23`, icon `#8a8a93`). Edit/delete management per spec.

### 5. הגדרות — Settings (full-screen overlay)
Opens from header gear; bg `#0a0a0c`, fadeIn .2s. Back chevron (`40×40`, bg `#161619`) + title "הגדרות".
- **Protein goal** card: "יעד חלבון יומי" with − / + stepper (`46×46` buttons; minus neutral `#1e1e23`, plus accent bg `#16201b` text `#34d399`) around the goal number (`40px/900`) + "גרם". Step 5, range 80–260.
- **Account** card: "חשבון" / email; "התנתקות" (logout) in `#fb7185`.
- Footer "ProCount · גרסה 1.0".

---

## Interactions & Behavior
- **Tab switch**: sets active screen, closes settings. Active nav color `#34d399`.
- **FAB → Add sheet**: opens on Quick tab, resets photo state to idle. Backdrop click or close button dismisses.
- **Quick add**: tap a saved food → append entry (`source:'saved'`, multiplier ×1), close sheet, totals + ring/bar update live.
- **Manual add**: parse protein/calories as non-negative numbers (`name` optional, defaults to "רישום ללא שם"); optional "save to my foods" also creates a food template.
- **Photo flow**: idle → loading (~1.4s mock; real = compress image client-side, POST to `analyze-food-photo` Edge Function) → done with **editable** fields → confirm saves as `source:'ai'`. Soft cap 6 AI calls/day.
- **Delete entry**: removes from today's list; totals recompute.
- **Live recompute**: total protein, total calories, remaining (`max(0, goal − total)`), pct (`min(1, total/goal)`), entry count, and AI quota all derive from the entries array on every render.
- **Animations**: ring draw-in 1s ease-out; sheet slide-up .28s `cubic-bezier(.2,.8,.2,1)`; backdrop/overlay fadeIn .2s; spinner `spin` .8s linear infinite.

## State Management
Local UI state in the prototype: `screen` (today|trends|foods), `addOpen`, `addTab` (quick|manual|photo), `settingsOpen`, `photoState` (idle|loading|done), `form` ({name, protein, calories, save}), `entries[]`, `foods[]`, `nextId`. Tweakable props: `homeStyle` (ring|panel), `proteinGoal` (int, default 175 in current file, step 5, 80–260).

In production these map to Supabase tables (see spec §4): `entries`, `foods`, `profile.protein_goal_g`. Trends/streak are computed client-side by aggregating `entries` by `eaten_on`. "Today" = entries with `eaten_on` == local current date.

## Design Tokens

**Colors**
| Token | Hex |
|---|---|
| App background | `#0a0a0c` |
| Surface / card | `#161619` |
| Surface (inputs/quick) | `#18181c` |
| Surface alt | `#1e1e23` / `#1a1a1e` |
| Sheet background | `#121215` |
| Border (default) | `#232328` / `#1f1f24` |
| Border (accent) | `#21302a` |
| Text primary | `#f4f4f5` |
| Text secondary | `#c4c4c9` |
| Text muted | `#8a8a93` / `#6f6f78` |
| Text faint | `#5f5f68` / `#3f3f47` |
| **Accent / protein (green)** | `#34d399` (light `#6ee7b7`, dark `#1f9d6f` / `#1f8a5b`, met-goal bar `#2a9d6f`) |
| Accent surface | `#16201b` |
| **Calories (amber)** | `#fbbf24` |
| Streak flame (orange) | `#fb923c` / `#f59e0b` warm card `#241a12` |
| Source: manual (blue) | `#60a5fa` |
| Source: AI (purple) | `#a78bfa` |
| Danger / logout / delete | `#fb7185` |
| FAB text / on-accent | `#06120c` |

**Typography** — Heebo (Google Fonts), weights 400/500/600/700/800/900. Display numbers 56/52/40/34px @900; titles 20–24px @800; body 13–16px; captions 10–13px. Negative letter-spacing (−.02 to −.03em) on big numbers.

**Radius** — pills `999px`; hero cards `24–28px`; section cards `18–22px`; inputs/quick `14–16px`; small tiles/icons `9–14px`.

**Spacing** — screen padding 20px; card gaps 10–14px; card padding 14–22px; bottom-scroll padding 110px (clears nav + FAB).

**Shadows / effects** — FAB `0 8px 28px rgba(52,211,153,.45), 0 2px 8px rgba(0,0,0,.4)`; accent glow `0 0 12px rgba(52,211,153,.5)`; nav `backdrop-filter:blur(16px)`.

## Assets
- **Font**: Heebo via Google Fonts.
- **Icons**: all inline SVG (stroke-width 2–3, `currentColor`) — settings gear, home, bar-chart, list, plus, trash, pencil, camera, flame, info, X, chevron. In production substitute your icon library (e.g. lucide-react: `Settings, Home, BarChart3, List, Plus, Trash2, Pencil, Camera, Flame, Info, X, ChevronLeft`). No raster images.
- No logos or brand assets.

## Files
- `ProCount.dc.html` — the full hi-fi design prototype (all 5 screens + add sheet + 2 home variations). Open in a browser to interact with it.
- `procount-spec.md` — the original functional spec (data model, Supabase backend, AI photo flow, auth, AI quota, testing, out-of-scope).
