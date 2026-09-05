// Synthetic rendering regression, not a physical iOS test. No application data/network.
// Uses an externally installed Playwright; no project dependency is required.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
const source = await readFile(new URL("../src/lib/viewport.js", import.meta.url), "utf8");
const baseline = process.argv.includes("--baseline");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});

try {
  const page = await browser.newPage();
  await page.route("**/*", (route) => route.abort());
  const settle = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const check = async (label) => {
    const geometry = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { height: innerHeight, app: rect(".app"), nav: rect(".bottom-nav"), fab: rect(".h-fab"),
        padding: getComputedStyle(document.querySelector(".bottom-nav")).paddingBottom,
        draft: document.querySelector("input").value };
    });
    assert.ok(Math.abs(geometry.app.bottom - geometry.height) <= 1, `${label}: shortened app ${JSON.stringify(geometry)}`);
    assert.ok(Math.abs(geometry.nav.bottom - geometry.height) <= 1, `${label}: navigation detached`);
    assert.equal(geometry.padding, "34px", `${label}: safe-area clearance lost`);
    assert.ok(Math.abs(geometry.nav.top - geometry.fab.bottom - 12) <= 1, `${label}: FAB detached`);
    assert.equal(geometry.draft, "טיוטה שלא נשמרה", `${label}: draft lost`);
    console.log(`PASS ${label}`);
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent('<html dir="rtl"><body><div id="root"><div class="app"><header style="height:100px;flex:none">ProCount</header><div class="app-scroll" style="flex:1;overflow-y:auto"><input value="טיוטה שלא נשמרה"><div style="height:1400px"></div><button id="last-control">הפעולה האחרונה</button></div><button class="h-fab" style="position:absolute;height:68px;width:68px">+</button><nav class="bottom-nav"><button>היום</button></nav></div></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ content: ":root { --safe-area-bottom:34px; }" });
  // Native browser-tab CSS is exercised before promoting the fixture to standalone.
  await check("native browser tab");
  await page.evaluate(async (source) => {
    const { installStandaloneViewport } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
    window.stopViewport = installStandaloneViewport();
  }, source);
  await settle();
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--app-viewport-height")), "");
  await page.evaluate(() => window.stopViewport());

  // Chrome does not emulate display-mode via CDP: promote the actual production
  // standalone rule, and override only its JS mode query. This is fault injection.
  await page.evaluate(() => {
    const rule = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules])
      .find((rule) => rule.conditionText?.includes("display-mode: standalone"));
    const standaloneStyle = document.createElement("style");
    standaloneStyle.textContent = [...rule.cssRules].map((rule) => rule.cssText).join("\n");
    document.head.append(standaloneStyle);
    const match = window.matchMedia.bind(window);
    window.matchMedia = (query) => query.includes("display-mode") ? { matches: true } : match(query);
  });
  if (!baseline) {
    await page.evaluate(async (source) => {
      const { installStandaloneViewport } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
      window.stopViewport = installStandaloneViewport();
    }, source);
  }
  await settle();
  await check("healthy standalone");
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--app-viewport-height")), "");
  await page.addStyleTag({ content: ".app { bottom:50px !important; }" });
  for (let cycle = 1; cycle <= 10; cycle++) {
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await settle();
    await check(`resume ${cycle} with stale bottom constraint`);
  }
  for (const viewport of [{ width: 844, height: 390 }, { width: 430, height: 932 }, { width: 320, height: 568 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await settle();
    await check(`resize ${viewport.width}x${viewport.height}`);
  }
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, "height", { value: 350, configurable: true });
    document.querySelector("input").focus();
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await settle();
  await check("keyboard-only visual viewport shrink");
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, "scale", { value: 2, configurable: true });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await settle();
  await check("pinch zoom does not resize the shell");
  await page.evaluate(() => {
    delete visualViewport.height;
    delete visualViewport.scale;
    document.querySelector("input").blur();
    const scroll = document.querySelector(".app-scroll");
    scroll.scrollTop = scroll.scrollHeight;
  });
  const reachable = await page.evaluate(() => document.querySelector("#last-control").getBoundingClientRect().bottom <= document.querySelector(".bottom-nav").getBoundingClientRect().top);
  assert.ok(reachable, "last content control must scroll above navigation");
  console.log("PASS last scroll control reachable");
  await page.evaluate(() => window.stopViewport());
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--app-viewport-height")), "");
  console.log("PASS cleanup");

  if (process.env.PROCOUNT_PREVIEW_URL) {
    const preview = new URL(process.env.PROCOUNT_PREVIEW_URL);
    assert.ok(["localhost", "127.0.0.1"].includes(preview.hostname), "integration check must use a local build");
    const appPage = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const errors = [];
    appPage.on("pageerror", (error) => errors.push(error.message));
    await appPage.route("**/*", (route) => new URL(route.request().url()).origin === preview.origin ? route.continue() : route.abort());
    await appPage.addInitScript(() => {
      const match = window.matchMedia.bind(window);
      window.matchMedia = (query) => query.includes("display-mode") ? { matches: true } : match(query);
    });
    await appPage.goto(preview.href);
    await appPage.locator('input[type="email"]').fill("draft@example.com");
    await appPage.evaluate(() => {
      const rule = [...document.styleSheets]
        .filter((sheet) => !sheet.href || new URL(sheet.href).origin === location.origin)
        .flatMap((sheet) => [...sheet.cssRules])
        .find((rule) => rule.conditionText?.includes("display-mode: standalone"));
      const style = document.createElement("style");
      style.textContent = [...rule.cssRules].map((rule) => rule.cssText).join("\n") + ".app{bottom:50px !important}";
      document.head.append(style);
      window.dispatchEvent(new Event("pageshow"));
    });
    await appPage.waitForFunction(() => Math.abs(document.querySelector(".app").getBoundingClientRect().bottom - innerHeight) <= 1);
    assert.equal(await appPage.locator('input[type="email"]').inputValue(), "draft@example.com");
    assert.deepEqual(errors, []);
    console.log("PASS built React Root/Login integration, no reload or draft loss");
    await appPage.close();
  }
} finally {
  await browser.close();
}
