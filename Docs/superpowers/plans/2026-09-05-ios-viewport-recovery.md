# iOS Standalone Viewport Recovery Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover a shortened installed-app shell after background/resume without moving individual controls or breaking keyboard and zoom behavior.

**Architecture:** Keep the existing fixed shell and shared navigation safe-area geometry. When the shell is measurably shorter than the layout viewport, give the shell an explicit height from `window.innerHeight`, and keep that correction synchronized with subsequent viewport changes. Do not derive app height from the visual viewport, which shrinks for the keyboard and pinch zoom.

**Tech Stack:** React 18, plain JavaScript, CSS custom properties, existing Node test runner; externally available Playwright for a local browser check.

**Spec:** User's September 5 report: full height initially, bottom gap after repeated exits/returns; screenshot attached in this conversation. `Docs/2026-06-18-procount-design.md` defines the installed iPhone app. The earlier `2026-09-03-ios-standalone-gap.md` records the metadata experiment, not proof of a stable fix.

## Global Constraints

- Do not alter the concurrent `feature/apple-ui-redesign` checkout or its staged assets.
- Use `fix/ios-viewport-recovery`, based on verified remote `master` at `4583e239b40152e65ea71d849b468b4c7dc99847`.
- Share `node_modules` with the original checkout during checks; remove the temporary link at handoff. No new application dependency.
- Preserve `black`, `viewport-fit=cover`, manifest standalone mode, and service-worker auto-update configuration.
- No device sizes, user-agent detection, screen-height arithmetic, negative offsets, forced reloads, viewport-meta toggling, or loss of draft/form state.
- Ordinary browser tabs retain their existing dynamic viewport layout.
- Physical iOS reproduction is not available locally. The implemented boundary mitigation and synthetic reproduction must not be described as a confirmed physical-device fix.

## Evidence and chosen boundary

- Live HTML and CSS were checked: `black` and the existing fixed/inset standalone layout are deployed.
- `.bottom-nav` and `.h-fab` are children of `.app`; navigation safe-area padding is included by global `border-box`.
- The app currently has no viewport recovery on lifecycle events.
- A recoverable case is `.app` at top 0 with height less than `innerHeight`, at normal zoom. An explicit height can bypass stale fixed bottom-edge sizing.
- If iOS also under-reports `innerHeight` or paints outside the exposed web view, this mitigation cannot recover that system-owned area. Measure before claiming otherwise.
- Root initialization covers loading, login and authenticated views. Do not couple the recovery to nutrition state or React rerenders.

## Task 1: Implement and check the shared recovery boundary

**Files:**
- Create `src/lib/viewport.js`: `installStandaloneViewport(win = window)` returns lifecycle cleanup.
- Create `src/lib/viewport.test.js`: runnable behavioral regression checks using browser-boundary doubles and real event dispatch.
- Modify `src/Root.jsx`: install once in an effect, using the returned cleanup.
- Modify `src/index.css`: standalone shell uses `height: var(--app-viewport-height, auto)`.

- [x] Read existing shell/auth initialization, all safe-area consumers and previous fix; run baseline `npm test` (53 passing).
- [x] Write and run failing recovery check first. Trigger a hidden/visible transition with an 800px shell and an 850px layout viewport; expect the CSS correction `850px` after animation-frame work. Start with a no-op exported function so failure is a behavioral assertion rather than a missing import.

```js
const stop = installStandaloneViewport(win);
doc.visibilityState = 'hidden';
doc.dispatchEvent(new Event('visibilitychange'));
flushFrames();
doc.visibilityState = 'visible';
doc.dispatchEvent(new Event('visibilitychange'));
flushFrames();
assert.equal(style.getPropertyValue('--app-viewport-height'), '850px');
stop();
```

- [x] Implement the boundary: only standalone/fullscreen; sample in one coalesced animation frame; skip hidden, zoomed, missing-shell, invalid-height and vertically panned samples. Activate only for a shell shorter than `innerHeight` (1px rounding tolerance), then follow current `innerHeight` on resize. No maximum-height cache across orientations.
- [x] Observe `resize`, `pageshow`, visible `visibilitychange`, and `visualViewport.resize`. Clear pending work, listeners and owned CSS property on cleanup; this must tolerate React StrictMode setup/cleanup/setup.
- [x] Verify unchanged normal/browser layout, repeated resume, page restoration, orientation changes, keyboard-only visual viewport shrink, pinch zoom, invalid samples and cleanup with `node --test src/lib/viewport.test.js`.
- [x] Integrate in Root and CSS:

```js
import { installStandaloneViewport } from './lib/viewport.js';
// Inside Root, independently of the auth effect:
useEffect(() => installStandaloneViewport(), []);
```

```css
@media (display-mode: standalone), (display-mode: fullscreen) {
  .app { position: fixed; inset: 0; height: var(--app-viewport-height, auto); }
}
```

## Task 2: Verify rendered behavior, review and handoff

- [x] Run an isolated Chromium check with production CSS and the real recovery module. Inject a stale 50px bottom constraint, retain a valid layout viewport, and verify the shell/nav bottom and FAB clearance return to their expected values. Run the same check with recovery disabled and require failure.
- [x] Check normal browser mode, several viewport sizes, orientation changes, repeated lifecycle events, visual viewport keyboard/zoom changes, safe-area padding and retained input text. Record synthetic checks as synthetic.
- [x] Run `npm test`, `npm run build` and `git diff --check` in the fix worktree. No live user data is required for the isolated layout fixture.
- [x] Request independent code review; resolve substantive findings and rerun affected checks.
- [x] Record results and commit only this plan and the scoped fix. Keep the original worktree and staged redesign files intact.
- [ ] Physical acceptance after deployment: verify loaded asset version, compare shell/viewport/safe-area measurements in healthy and failed states, then perform 10 background/resume cycles, lock/unlock, keyboard dismissal and portrait/landscape/portrait. No persistent gap; Home indicator clearance and all final controls remain reachable.

## Verification record

- Baseline: 53/53 Node tests passed.
- Node red/green: no-op installer failed three recovery assertions, then 4/4 viewport tests passed; complete suite 57/57 passed.
- Rendered red/green: `scripts/check-viewport.mjs --baseline` failed on the first injected gap, with app/nav bottom 794px and layout height 844px. Recovery enabled passed 20 fixture checks, including 10 lifecycle cycles and four resized layouts.
- Actual built React integration: one additional check passed through Root/Login (not a manually installed helper), with local-only requests, preserved typed email and no uncaught page error. Total 21 rendered checks with the integration option.
- Build passed with existing configuration; `git diff --check` passed.
- Independent review: mitigation spec approved; code quality approved; no substantive blocker. Reviewer explicitly does not certify the physical iPhone symptom.
- The rendering test intentionally promotes the real standalone CSS rule and overrides the JS display-mode query because desktop Chrome does not emulate installed iOS mode. It injects a shortened bottom constraint; it does not emulate WebKit internals.
- Physical iPhone checks: not run; no connected iOS simulator/device available in this environment.
- Production deployment of this change: not performed by this plan's local implementation steps.

### Re-run the rendering check

Use an already installed Playwright and browser; the project adds no package:

```sh
PLAYWRIGHT_MODULE_PATH=/path/to/node_modules/playwright \
CHROME_EXECUTABLE_PATH=/path/to/chrome \
node scripts/check-viewport.mjs
```

Add `--baseline` to require the original shortened-shell failure. To check Root integration, build and run `npm run preview -- --port 5187`, then add `PROCOUNT_PREVIEW_URL=http://127.0.0.1:5187` to the same command. All non-local requests are blocked by that check.

## References

- https://bugs.webkit.org/show_bug.cgi?id=254868 — inconsistent installed-web-app height/inset values.
- https://bugs.webkit.org/show_bug.cgi?id=297779 — fixed positioning and system viewport regression.
- https://bugs.webkit.org/show_bug.cgi?id=301994 — related system-owned display-area limitations.
