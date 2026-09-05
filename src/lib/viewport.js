export function installStandaloneViewport(win = window) {
  if (!win.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches) return () => {};

  const doc = win.document;
  const style = doc.documentElement.style;
  const viewport = win.visualViewport;
  const property = "--app-viewport-height";
  let frame = 0;

  const sync = () => {
    frame = 0;
    if (doc.visibilityState !== "visible" || (viewport && viewport.scale !== 1)) return;
    const height = win.innerHeight;
    const app = doc.querySelector(".app");
    if (!app || !Number.isFinite(height) || height <= 0) return;
    const rect = app.getBoundingClientRect();
    if (Math.abs(rect.top) > 1) return; // Panning is not a shortened shell.

    // ponytail: recover only a stale shell boundary; an OS-clipped web view needs device diagnosis.
    const current = style.getPropertyValue(property);
    if (!current && rect.height >= height - 1) return;
    // The visual viewport shrinks with the keyboard/zoom; it must not size the app.
    const next = `${height}px`;
    if (current !== next) style.setProperty(property, next);
  };

  const schedule = () => {
    if (!frame && doc.visibilityState === "visible") frame = win.requestAnimationFrame(sync);
  };
  const events = [[win, "resize"], [win, "pageshow"], [doc, "visibilitychange"]];
  if (viewport) events.push([viewport, "resize"]);
  events.forEach(([target, event]) => target.addEventListener(event, schedule));
  schedule();

  return () => {
    events.forEach(([target, event]) => target.removeEventListener(event, schedule));
    if (frame) win.cancelAnimationFrame(frame);
    style.removeProperty(property);
  };
}
