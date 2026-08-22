# Implementation Plan: Food Input Upgrades and Daily Pace

## Overview

Starting from the freshly updated `origin/master`, create `feature/photo-food-measures` and ship five independently buildable commits: gallery photo selection, reusable daily measures, a validated `מוצר כללי` flow, a clean red delete icon, and a non-redundant daily pace card. Preserve the current untracked workspace files throughout branch preparation.

## Architecture Decisions

- Keep the existing `foods.unit` text field. It stores a chosen serving label; no database migration, RLS change, or Edge Function change is required.
- Camera and gallery inputs both use the existing client compression and AI analysis flow.
- The food catalog remains shared, as defined by the current `foods` policy.
- Use the device's local calendar day for pace. The pace card compares protein-goal completion with the elapsed percentage of the 00:00–24:00 local day.

## Branch Preparation

Run these commands before implementation, after confirming the dirty working tree contains only the existing untracked user files:

```sh
git fetch origin master --prune
git switch master
git pull --ff-only origin master
git switch -c feature/photo-food-measures
```

Do not stage or alter `.claude/`, `.superpowers/`, `AGENTS.md`, or `InBody 19:8:26.jpg`.

## Commit 1: Add gallery upload to food-photo analysis

**Commit:** `feat: add gallery upload to food photo analysis`

**Description:** Replace the camera-only file-input hint with two explicit Photo-tab actions: `צלם עכשיו` and `בחר מהגלריה`. The camera input retains `capture="environment"`; the gallery input has no capture hint. Both pass their selected file to the current `onPickPhoto` flow.

**Acceptance criteria:**

- [ ] Camera selection opens the device camera; gallery selection opens the image picker.
- [ ] Either source reaches the existing compression, AI quota, result-editing, and confirm flow.
- [ ] Cancelling selection performs no analysis; existing analysis errors still use the current fallback UI.

**Files likely touched:** `src/screens/AddSheet.jsx`, `src/lib/icons.jsx`.

**Verification:** `npm test`, `npm run build`, then manually test one camera and one gallery image.

## Commit 2: Add reusable daily serving measures

**Commit:** `feat: support daily serving measures for foods`

**Description:** Add a shared measure control to saved-food creation and editing. It offers `יחידה`, `כף`, `כפית`, `כוס`, `פרוסה`, `סקופ`, `קופסה`, `מנה`, and `100 גרם`; choosing `אחר` reveals a required custom label. Protein and calories always represent one selected measure, while the existing Quick Add quantity step multiplies them.

**Acceptance criteria:**

- [ ] New and edited catalog foods persist the selected or custom label through `foods.unit`.
- [ ] Existing free-text units remain readable and editable without data migration.
- [ ] A saved food measured in `כף` multiplies its macros by the Quick Add quantity; only gram-denominated units produce an entry `grams` value.

**Files likely touched:** `src/screens/AddSheet.jsx`, `src/FoodEditor.jsx`, `src/App.jsx`, `src/store.js`.

**Verification:** `npm test`, `npm run build`, and manually add/edit a `כף`, `100 גרם`, and custom-measure food.

## Commit 3: Add validated `מוצר כללי` Quick Add flow

**Commit:** `feat: add validated general-food quick entry`

**Description:** Replace the current `מאכל שלא במאגר` Quick Add shortcut with `מוצר כללי`. The form records macros for one chosen serving measure and uses an unchecked `שמור למאכלים שלי` toggle to choose between an entry only and an entry plus a reusable catalog food.

**Acceptance criteria:**

- [ ] The shortcut opens the custom-food form from Quick Add.
- [ ] A non-empty name plus valid non-negative protein and calorie values are required; zero is valid, while blank or invalid values show Hebrew inline validation and prevent submission.
- [ ] Submission creates one `manual` entry on the selected date; when saving is selected, it also inserts a food with the chosen unit and macros.
- [ ] The unsaved path leaves the catalog unchanged.

**Dependencies:** Commit 2.

**Files likely touched:** `src/screens/AddSheet.jsx`, `src/App.jsx`, `src/store.js`.

**Verification:** `npm test`, `npm run build`, and manually verify valid, invalid, saved, and one-off flows.

## Commit 4: Polish the eaten-food delete icon

**Commit:** `fix: polish eaten-food delete icon`

**Description:** Restyle the meal-row control as the approved clean red trash icon: `#fb7185`, no persistent background or border, and the existing subtle destructive hover/press treatment. Keep the current confirmation dialog and click isolation intact.

**Acceptance criteria:**

- [ ] The visible control is the existing trash SVG in red, without the oversized white container from the reference screenshot.
- [ ] Pressing the icon does not open entry details and instead opens the existing deletion confirmation.
- [ ] Keyboard focus and `aria-label="מחק רישום"` remain available.

**Files likely touched:** `src/screens/Today.jsx`, `src/index.css`.

**Verification:** `npm test`, `npm run build`, and manually confirm/cancel a deletion.

## Commit 5: Replace the duplicate protein tile with daily pace

**Commit:** `feat: replace duplicate protein metric with daily pace`

**Description:** Replace the redundant right-side protein tile with `קצב יומי`. For the current day, compare the protein-goal percentage against the elapsed local-day percentage and show a coaching status instead of repeating the hero's gram total. For a historical selected day, render a static day-result state rather than a live pace calculation.

**Acceptance criteria:**

- [ ] Today's tile shows protein completion percentage, `מול X% מהיום שעבר`, and one of `בקצב מצוין`, `בקצב טוב`, or `קצת מאחור`.
- [ ] The status is derived by comparing protein progress to elapsed local-day progress, with a 15-percentage-point tolerance for `בקצב טוב`.
- [ ] A past day never shows a live clock-derived pace; it shows a static daily result.
- [ ] The calories tile and protein hero remain unchanged.

**Files likely touched:** `src/lib/nutrition.js`, `src/lib/nutrition.test.js`, `src/App.jsx`, `src/screens/Today.jsx`.

**Verification:** Add pure-function coverage for ahead, within-tolerance, behind, and historical-day cases; run `npm test`, `npm run build`, and inspect today plus a previous day.

## Checkpoints

- [ ] After Commit 3: both photo sources and saved/one-off custom-food flows work end-to-end.
- [ ] After Commit 5: `npm test` and `npm run build` pass from the final branch.
- [ ] Review each commit separately before opening a pull request.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| The current local branch contains redesign work not on `master`. | Reinspect the target UI after branch preparation and apply the approved behavior to its actual markup. |
| Free-text legacy units vary. | Preserve their strings; parse grams only from explicit gram-denominated labels. |
| The custom form silently converts invalid values to zero today. | Add explicit field validation only to the new `מוצר כללי` path. |
