import assert from "node:assert/strict";
import test from "node:test";
import { installStandaloneViewport } from "./viewport.js";

// Browser boundaries only: the production installer owns sampling and recovery.
function browser({ standalone = true, shellHeight = 800 } = {}) {
  const values = new Map();
  const style = {
    setProperty: (key, value) => values.set(key, value),
    getPropertyValue: (key) => values.get(key) || "",
    removeProperty: (key) => values.delete(key),
  };
  const rect = { top: 0, height: shellHeight };
  const doc = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    documentElement: { style },
    querySelector: () => ({ getBoundingClientRect: () => rect }),
  });
  const frames = new Map();
  let nextFrame = 0;
  const win = Object.assign(new EventTarget(), {
    document: doc,
    innerHeight: 850,
    matchMedia: () => ({ matches: standalone }),
    visualViewport: Object.assign(new EventTarget(), { height: 850, offsetTop: 0, scale: 1 }),
    requestAnimationFrame: (callback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  return { win, doc, style, rect, frames, flush, height: () => style.getPropertyValue("--app-viewport-height") };
}

test("standalone shell recovers after resume and tracks rotation without retaining portrait height", () => {
  const b = browser({ shellHeight: 850 });
  const stop = installStandaloneViewport(b.win);
  b.flush();
  assert.equal(b.height(), "", "healthy CSS needs no correction");

  b.doc.visibilityState = "hidden";
  b.rect.height = 800;
  b.doc.dispatchEvent(new Event("visibilitychange"));
  b.flush();
  assert.equal(b.height(), "", "do not measure a suspended page");

  for (let cycle = 0; cycle < 10; cycle++) {
    b.doc.visibilityState = "visible";
    b.doc.dispatchEvent(new Event("visibilitychange"));
    b.flush();
    assert.equal(b.height(), "850px");
    b.doc.visibilityState = "hidden";
    b.doc.dispatchEvent(new Event("visibilitychange"));
    b.flush();
  }

  b.doc.visibilityState = "visible";
  b.win.innerHeight = 390;
  b.win.dispatchEvent(new Event("resize"));
  b.flush();
  assert.equal(b.height(), "390px", "rotation must replace the old height");
  b.win.innerHeight = 850;
  b.win.dispatchEvent(new Event("pageshow"));
  b.flush();
  assert.equal(b.height(), "850px");
  stop();
});

test("keyboard and pinch zoom do not become the app's layout height", () => {
  const b = browser();
  const stop = installStandaloneViewport(b.win);
  b.flush();
  assert.equal(b.height(), "850px");

  b.win.visualViewport.height = 450;
  b.win.visualViewport.dispatchEvent(new Event("resize"));
  b.flush();
  assert.equal(b.height(), "850px", "keyboard shrinks the visual viewport only");

  b.win.visualViewport.scale = 2;
  b.win.innerHeight = 425;
  b.win.dispatchEvent(new Event("resize"));
  b.flush();
  assert.equal(b.height(), "850px", "zoomed measurements must not replace layout height");

  b.win.visualViewport.scale = 1;
  b.win.innerHeight = 900;
  b.win.visualViewport.height = 900;
  b.win.visualViewport.dispatchEvent(new Event("resize"));
  b.flush();
  assert.equal(b.height(), "900px");
  stop();
});

test("browser tabs, invalid heights and panned shells retain native CSS", () => {
  const tab = browser({ standalone: false });
  const stopTab = installStandaloneViewport(tab.win);
  tab.flush();
  tab.win.dispatchEvent(new Event("resize"));
  tab.flush();
  assert.equal(tab.height(), "");
  stopTab();

  const b = browser();
  b.win.innerHeight = 0;
  const stop = installStandaloneViewport(b.win);
  b.flush();
  for (const value of [-1, NaN, Infinity]) {
    b.win.innerHeight = value;
    b.win.dispatchEvent(new Event("resize"));
    b.flush();
    assert.equal(b.height(), "");
  }
  b.win.innerHeight = 850;
  b.rect.top = -24;
  b.win.dispatchEvent(new Event("resize"));
  b.flush();
  assert.equal(b.height(), "", "a shifted top is a different viewport problem");
  stop();
});

test("coalesces events and removes pending work and listeners across StrictMode remounts", () => {
  const b = browser();
  const stop = installStandaloneViewport(b.win);
  b.win.dispatchEvent(new Event("pageshow"));
  b.win.dispatchEvent(new Event("resize"));
  assert.equal(b.frames.size, 1);
  b.flush();
  assert.equal(b.height(), "850px");
  b.win.dispatchEvent(new Event("resize"));
  stop();
  assert.equal(b.frames.size, 0);
  assert.equal(b.height(), "");
  b.win.dispatchEvent(new Event("pageshow"));
  b.doc.dispatchEvent(new Event("visibilitychange"));
  b.win.visualViewport.dispatchEvent(new Event("resize"));
  assert.equal(b.frames.size, 0);

  b.win.visualViewport = undefined;
  const stopAgain = installStandaloneViewport(b.win);
  b.flush();
  assert.equal(b.height(), "850px", "VisualViewport is optional");
  stopAgain();
});
