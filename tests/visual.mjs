#!/usr/bin/env node
// Visual regression: snapshot every page, then compare two snapshot sets.
//
//   node tests/visual.mjs snap <dir>              capture docs/ into <dir>
//   node tests/visual.mjs diff <before> <after>   report what changed, page by page
//
// Use it around a change to shared CSS: snap before, make the change, rebuild,
// snap again, diff. A page you did not mean to touch should report "identical",
// and one you did should change only where you expect: each changed band is
// listed with its rows and the columns it spans.
//
// Captures are made repeatable: the page's clock is stopped (so the promo
// countdown is constant), reduced motion is on (so the animated icon is its
// still frame) and lazy images are loaded before the shot.
//
// SITE_DIR=<folder> points the capture at another build, for example the
// docs/ of a clean checkout of the previous commit.

import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { launch, open, settle, PAGES } from './lib.mjs';

const WIDTHS = [1440, 768, 390];
const [cmd, a, b] = process.argv.slice(2);

if (cmd === 'snap') {
  mkdirSync(a, { recursive: true });
  const browser = await launch();
  for (const name of PAGES) {
    for (const width of WIDTHS) {
      const { page, context } = await open(browser, name, { width, reducedMotion: 'reduce', frozenClock: true });
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }' });
      await settle(page);
      await page.screenshot({ path: path.join(a, `${name}-${width}.png`), fullPage: true });
      await context.close();
    }
    console.log('snap', name);
  }
  await browser.close();
} else if (cmd === 'diff') {
  const browser = await launch();
  const page = await browser.newPage();
  const files = readdirSync(a).filter((f) => f.endsWith('.png')).sort();
  let changed = 0;
  for (const f of files) {
    let other;
    try { other = readFileSync(path.join(b, f)); } catch { console.log(`${f}: missing in ${b}`); changed++; continue; }
    const r = await page.evaluate(async ([A, B]) => {
      const load = async (b64) => createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
      const data = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const da = data(ia), db = data(ib);
      let n = 0;
      const lo = new Int32Array(h).fill(-1), hi = new Int32Array(h).fill(-1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (Math.abs(da[i] - db[i]) > 6 || Math.abs(da[i + 1] - db[i + 1]) > 6 || Math.abs(da[i + 2] - db[i + 2]) > 6) {
          n++;
          if (lo[y] < 0) lo[y] = x;
          hi[y] = x;
        }
      }
      // Collapse changed rows into vertical bands, each with the columns it spans.
      const bands = [];
      for (let y = 0; y < h; y++) {
        if (lo[y] < 0) continue;
        const last = bands[bands.length - 1];
        if (last && y - last.y1 < 24) { last.y1 = y; last.x0 = Math.min(last.x0, lo[y]); last.x1 = Math.max(last.x1, hi[y]); }
        else bands.push({ y0: y, y1: y, x0: lo[y], x1: hi[y] });
      }
      return { n, w, h, ha: ia.height, hb: ib.height, bands: bands.slice(0, 16), more: Math.max(0, bands.length - 16) };
    }, [readFileSync(path.join(a, f)).toString('base64'), other.toString('base64')]);
    if (r.n) {
      changed++;
      const where = r.bands.map((k) => `y${k.y0}-${k.y1} x${k.x0}-${k.x1}`).join('; ');
      console.log(`${f}: ${r.n} px differ (${(100 * r.n / (r.w * r.h)).toFixed(2)}%)${r.ha !== r.hb ? `, height ${r.ha} to ${r.hb}` : ''}\n    ${where}${r.more ? `; and ${r.more} more bands` : ''}`);
    } else console.log(`${f}: identical`);
  }
  await browser.close();
  console.log(changed ? `\n${changed} of ${files.length} snapshots changed` : `\nall ${files.length} snapshots identical`);
} else {
  console.error('usage: visual.mjs snap <dir> | diff <before> <after>');
  process.exit(2);
}
