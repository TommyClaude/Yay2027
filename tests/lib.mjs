// Shared helpers for the checks in this folder.
//
// The checks drive the built site (docs/) in headless Chromium through
// Playwright. They never touch the network: every remote request is answered
// locally, so a run is deterministic and works offline.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = process.env.SITE_DIR || path.join(ROOT, 'docs');

export const PAGES = ['index', 'shop', 'yaypricing', 'all-access', 'checkout', 'thank-you', 'account', 'docs', 'support', 'contact'];

// Playwright comes from the project (npm install), or from an install
// elsewhere named by PLAYWRIGHT_PATH (the path of its index.js).
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* not installed here */ }
  if (process.env.PLAYWRIGHT_PATH) return import(process.env.PLAYWRIGHT_PATH);
  throw new Error('Playwright is not installed. Run "npm install", or set PLAYWRIGHT_PATH to an existing install.');
}
const pw = await loadPlaywright();
const chromium = pw.chromium || pw.default.chromium;

/**
 * Start the browser. `classicScrollbars` keeps scrollbars that take up layout
 * width (as on Windows), so a 1280px window lays out about 15px narrower.
 */
export async function launch({ classicScrollbars = false } = {}) {
  return chromium.launch({
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
    ...(classicScrollbars ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {}),
  });
}

const PLACEHOLDER = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="#e9eaec"/></svg>');

/**
 * Open a built page.
 *   name    file in docs/ without ".html"
 *   width   viewport width in CSS px (height defaults to 900)
 *   touch   emulate a phone/tablet: touch input, mobile viewport, no hover
 *   hash    appended to the address: "#licenses", or a query such as "?coupon=X"
 *   frozenClock  stop the page's clock, so anything time-based renders the same
 */
export async function open(browser, name, { width = 1440, height = 900, touch = width <= 1024, hash = '', reducedMotion = 'no-preference', js = true, frozenClock = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: touch,
    hasTouch: touch,
    reducedMotion,
    javaScriptEnabled: js,
  });
  // A page whose clock never moves renders the same countdown every time.
  if (frozenClock) {
    await context.addInitScript((fixed) => {
      const RealDate = Date;
      function FrozenDate(...args) { return args.length ? new RealDate(...args) : new RealDate(fixed); }
      FrozenDate.prototype = RealDate.prototype;
      FrozenDate.now = () => fixed;
      FrozenDate.parse = RealDate.parse;
      FrozenDate.UTC = RealDate.UTC;
      window.Date = FrozenDate;
    }, new Date(2026, 6, 15, 10, 0, 0).getTime());
  }
  await context.route(/^https?:\/\//, (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(route.request().url())) {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLACEHOLDER });
    }
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  // pathToFileURL, not 'file://' + path: the latter is not a valid address on Windows.
  await page.goto(pathToFileURL(path.join(SITE, `${name}.html`)).href + hash, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  return { page, context, errors };
}

/**
 * Bring a page to rest for a full-page capture: scroll past everything once so
 * lazy images are requested, wait for them, and return to the top.
 */
export async function settle(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = page.viewportSize().height;
  for (let y = 0; y < height; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => Promise.all([...document.images].filter((img) => !img.complete).map((img) => Promise.race([
    new Promise((done) => { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }),
    new Promise((done) => setTimeout(done, 3000)),
  ]))));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
}

/** Elements that make the document wider than the viewport (deliberate scrollers and fixed layers excluded). */
export function overflowOffenders(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const over = de.scrollWidth - de.clientWidth;
    if (over <= 0) return [];
    const excused = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const c = getComputedStyle(n);
        if (c.position === 'fixed') return true;
        if (n !== el && /auto|scroll|hidden|clip/.test(c.overflowX)) return true;
      }
      return false;
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.right > de.clientWidth + 0.5 && !excused(el)) {
        out.push(`${el.tagName.toLowerCase()}.${typeof el.className === 'string' ? el.className.split(' ')[0] : ''} +${Math.round(b.right - de.clientWidth)}px`);
      }
    }
    return out.length ? out.slice(0, 4) : [`document +${over}px`];
  });
}

// ---- a very small test harness ----------------------------------------
const results = [];
let currentGroup = '';
export function group(name) { currentGroup = name; }
export async function check(name, fn) {
  try {
    await fn();
    results.push({ group: currentGroup, name, ok: true });
  } catch (e) {
    results.push({ group: currentGroup, name, ok: false, why: String(e && e.message ? e.message : e).split('\n')[0] });
  }
}
export function expect(cond, message) { if (!cond) throw new Error(message); }
export function report() {
  let last = '';
  for (const r of results) {
    if (r.group !== last) { console.log(`\n${r.group}`); last = r.group; }
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : `\n         ${r.why}`}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  return failed;
}
