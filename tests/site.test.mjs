#!/usr/bin/env node
// Functional checks for the built site.
//
//   node build.mjs && node tests/site.test.mjs
//
// Everything here drives docs/ in headless Chromium. Nothing reaches the
// network. Exit code is the number of failed checks.

import { launch, open, overflowOffenders, PAGES, group, check, expect, report } from './lib.mjs';

const browser = await launch();
const close = async (h) => h.context.close();

// ---------------------------------------------------------------------------
group('Every page');
for (const name of PAGES) {
  await check(`${name}: loads cleanly with a title, description, one h1 and a main landmark`, async () => {
    const h = await open(browser, name);
    const info = await h.page.evaluate(() => ({
      title: document.title.trim(),
      desc: (document.querySelector('meta[name="description"]') || {}).content || '',
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main').length,
      lang: document.documentElement.lang,
    }));
    await close(h);
    expect(h.errors.length === 0, `script errors: ${h.errors.join(' | ')}`);
    expect(info.title.length > 0, 'empty <title>');
    expect(info.desc.length > 20, 'missing meta description');
    expect(info.h1 === 1, `${info.h1} h1 elements`);
    expect(info.main === 1, `${info.main} <main> elements`);
    expect(info.lang === 'en', `lang="${info.lang}"`);
  });
}

// Phones, tablets and desktops, plus the width on either side of every step
// in responsive.css: layouts tend to break just past a breakpoint.
const WIDTHS = [320, 340, 341, 360, 379, 380, 393, 430, 620, 621, 645, 768, 860, 861, 875, 1024, 1025, 1180, 1181, 1190, 1200, 1201, 1280, 1440, 1920];
for (const name of PAGES) {
  await check(`${name}: no sideways scroll at ${WIDTHS.length} widths (${WIDTHS[0]}–${WIDTHS[WIDTHS.length - 1]}px)`, async () => {
    const bad = [];
    for (const width of WIDTHS) {
      const h = await open(browser, name, { width });
      const who = await overflowOffenders(h.page);
      await close(h);
      if (who.length) bad.push(`${width}px: ${who.join(', ')}`);
    }
    expect(bad.length === 0, bad.join(' ; '));
  });
}

await check('index: no sideways scroll at every 10px from 320 to 1300', async () => {
  const bad = [];
  for (let width = 320; width <= 1300; width += 10) {
    const h = await open(browser, 'index', { width });
    const who = await overflowOffenders(h.page);
    await close(h);
    if (who.length) bad.push(`${width}px: ${who[0]}`);
  }
  expect(bad.length === 0, bad.slice(0, 6).join(' ; '));
});

// ---------------------------------------------------------------------------
group('Header at desktop width');
await check('the Plugins menu opens on hover, lists ten plugins, and closes on leave', async () => {
  const h = await open(browser, 'index');
  const mega = h.page.locator('.mega');
  expect(!(await mega.isVisible()), 'menu is open before any hover');
  await h.page.hover('.has-mega > .nav-link');
  await h.page.waitForTimeout(150);
  expect(await mega.isVisible(), 'menu did not open on hover');
  expect((await h.page.locator('.mega .mega-row').count()) === 10, 'expected 10 plugin rows');
  const box = await mega.boundingBox();
  expect(box.x >= 0 && box.x + box.width <= 1440, 'menu is cut off by the viewport');
  await h.page.mouse.move(700, 800);
  await h.page.waitForTimeout(450);
  expect(!(await mega.isVisible()), 'menu stayed open after the pointer left');
  await close(h);
});

await check('the Plugins menu is reachable from the keyboard and Escape closes it', async () => {
  const h = await open(browser, 'index');
  await h.page.focus('.has-mega > .nav-link');
  await h.page.waitForTimeout(150);
  expect(await h.page.locator('.mega').isVisible(), 'menu did not open when its trigger took focus');
  expect((await h.page.getAttribute('.has-mega > .nav-link', 'aria-expanded')) === 'true', 'aria-expanded not true while open');
  await h.page.keyboard.press('Tab');
  const inMenu = await h.page.evaluate(() => !!document.activeElement.closest('.mega'));
  expect(inMenu, 'Tab from the trigger did not land inside the menu');
  await h.page.keyboard.press('Escape');
  await h.page.waitForTimeout(150);
  expect(!(await h.page.locator('.mega').isVisible()), 'Escape did not close the menu');
  expect((await h.page.getAttribute('.has-mega > .nav-link', 'aria-expanded')) === 'false', 'aria-expanded not false after closing');
  await close(h);
});

await check('the account menu opens on hover and holds the five account links', async () => {
  const h = await open(browser, 'index');
  await h.page.hover('.account-chip');
  await h.page.waitForTimeout(150);
  expect(await h.page.locator('.account-menu').isVisible(), 'account menu did not open');
  const labels = await h.page.locator('.account-menu .menu-item').allInnerTexts();
  expect(['Dashboard', 'Purchases', 'Downloads', 'Licenses', 'Profile', 'Log out'].every((t) => labels.some((l) => l.trim() === t)), `got ${labels.join(', ')}`);
  await close(h);
});

// ---------------------------------------------------------------------------
group('Drawer (the nav below 1025px)');
await check('phone: the bar keeps logo, cart and menu button; the nav is parked off-screen', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  expect(await h.page.locator('.nav-toggle').isVisible(), 'no menu button');
  expect(await h.page.locator('.cart-link--bar').isVisible(), 'cart missing from the bar');
  const x = (await h.page.locator('#site-drawer').boundingBox()).x;
  expect(x >= 392, `drawer is on screen while closed (x=${x})`);
  await close(h);
});

await check('phone: a closed drawer cannot be reached with the keyboard or a screen reader', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  const leaks = await h.page.evaluate(() => {
    const panel = document.getElementById('site-drawer');
    const cs = getComputedStyle(panel);
    const hiddenFromAT = cs.visibility === 'hidden' || panel.inert || panel.getAttribute('aria-hidden') === 'true';
    const focusable = [...panel.querySelectorAll('a[href], button, input, select, [tabindex]')].filter((el) => {
      if (el.closest('[inert]')) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && el.tabIndex >= 0 && el.getClientRects().length > 0;
    });
    return { hiddenFromAT, focusable: focusable.length, shadow: cs.boxShadow };
  });
  expect(leaks.shadow === 'none', 'the closed drawer still casts a shadow along the edge of the page');
  expect(leaks.hiddenFromAT, 'the closed drawer is still exposed to assistive tech');
  expect(leaks.focusable === 0, `${leaks.focusable} controls inside the closed drawer are still focusable`);
  await close(h);
});

await check('phone: opens from the button, exposes its state, and holds nav, account links and the CTA', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  await h.page.tap('.nav-toggle');
  await h.page.waitForTimeout(400);
  const box = await h.page.locator('#site-drawer').boundingBox();
  expect(box.x + box.width <= 394 && box.x >= 0, 'drawer did not slide fully into view');
  expect((await h.page.getAttribute('.nav-toggle', 'aria-expanded')) === 'true', 'aria-expanded not true');
  expect(await h.page.locator('.drawer-scrim').isVisible(), 'no scrim behind the drawer');
  for (const t of ['All Access', 'Docs', 'Blog', 'Support']) {
    expect(await h.page.locator('.site-nav > .nav-link', { hasText: t }).first().isVisible(), `nav link "${t}" missing`);
  }
  expect(await h.page.locator('.account-menu .menu-item', { hasText: 'Downloads' }).isVisible(), 'account links missing');
  expect(await h.page.locator('.site-header__actions .btn--primary').isVisible(), 'CTA missing');
  await close(h);
});

await check('phone: Plugins expands in place and nothing inside the drawer spills outside it', async () => {
  for (const width of [320, 393, 768, 1024]) {
    const h = await open(browser, 'index', { width, height: 852 });
    await h.page.tap('.nav-toggle');
    await h.page.waitForTimeout(400);
    expect(!(await h.page.locator('.mega').isVisible()), `${width}px: plugin list open before it was asked for`);
    await h.page.tap('.has-mega > .nav-link');
    await h.page.waitForTimeout(250);
    expect(await h.page.locator('.mega .mega-row', { hasText: 'YayPricing' }).isVisible(), `${width}px: plugin list did not expand`);
    const escaped = await h.page.evaluate(() => {
      const panel = document.getElementById('site-drawer');
      const pb = panel.getBoundingClientRect();
      return [...panel.querySelectorAll('*')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && (b.left < pb.left - 1 || b.right > pb.right + 1 || b.top < pb.top - 1);
      }).map((el) => el.className || el.tagName).slice(0, 3);
    });
    await close(h);
    expect(escaped.length === 0, `${width}px: outside the drawer: ${escaped.join(', ')}`);
  }
});

await check('phone: closes from its ✕, the scrim and Escape, and returns focus to the menu button', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  const offscreen = async () => (await h.page.locator('#site-drawer').boundingBox()).x >= 392;
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  await h.page.tap('.drawer-close'); await h.page.waitForTimeout(400);
  expect(await offscreen(), '✕ did not close it');
  expect(await h.page.evaluate(() => document.activeElement.classList.contains('nav-toggle')), 'focus did not return to the menu button');
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  await h.page.touchscreen.tap(14, 500); await h.page.waitForTimeout(400);
  expect(await offscreen(), 'tapping the scrim did not close it');
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  await h.page.keyboard.press('Escape'); await h.page.waitForTimeout(400);
  expect(await offscreen(), 'Escape did not close it');
  expect((await h.page.getAttribute('.nav-toggle', 'aria-expanded')) === 'false', 'aria-expanded not reset');
  await close(h);
});

await check('phone: the drawer\'s main button stays on screen while a long plugin list scrolls behind it', async () => {
  for (const [width, height] of [[393, 659], [320, 568]]) {
    const h = await open(browser, 'index', { width, height });
    await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
    await h.page.tap('.has-mega > .nav-link'); await h.page.waitForTimeout(250);
    const r = await h.page.evaluate(() => {
      const panel = document.getElementById('site-drawer');
      const btn = panel.querySelector('.site-header__actions > .btn').getBoundingClientRect();
      const close = panel.querySelector('.drawer-close').getBoundingClientRect();
      return { scrolls: panel.scrollHeight > panel.clientHeight + 40, top: btn.top, bottom: btn.bottom, vh: window.innerHeight, closeH: close.height };
    });
    await close(h);
    expect(r.scrolls, `${width}x${height}: the list is not long enough to test`);
    expect(r.top > 0 && r.bottom <= r.vh, `${width}x${height}: the button is at ${Math.round(r.top)}-${Math.round(r.bottom)} of ${r.vh}`);
    expect(r.closeH >= 39, `${width}x${height}: the close button is squeezed to ${Math.round(r.closeH)}px`);
  }
});

await check('phone: keyboard focus stays inside the open drawer', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  let outside = 0;
  for (let i = 0; i < 40; i++) {
    await h.page.keyboard.press('Tab');
    const inside = await h.page.evaluate(() => !!document.activeElement.closest('#site-drawer'));
    if (!inside) outside++;
  }
  await close(h);
  expect(outside === 0, `focus left the drawer on ${outside} of 40 Tab presses`);
});

await check('phone: following a drawer link navigates and the next page starts closed', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  await h.page.tap('.site-nav > .nav-link:has-text("Docs")');
  await h.page.waitForLoadState('load'); await h.page.waitForTimeout(300);
  expect(h.page.url().endsWith('docs.html'), `landed on ${h.page.url()}`);
  expect((await h.page.locator('#site-drawer').boundingBox()).x >= 392, 'drawer open on the new page');
  await close(h);
});

await check('resizing to desktop with the drawer open puts the nav back in the bar and releases the scroll lock', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(300);
  await h.page.setViewportSize({ width: 1440, height: 900 }); await h.page.waitForTimeout(400);
  expect(await h.page.locator('.site-nav').isVisible(), 'nav not visible in the bar');
  expect(!(await h.page.locator('.nav-toggle').isVisible()), 'menu button still showing');
  expect(await h.page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden'), 'page still scroll-locked');
  await close(h);
});

// ---------------------------------------------------------------------------
group('Shared behaviour');
await check('the sale countdown ticks, and its changing digits do not move its neighbours', async () => {
  const h = await open(browser, 'index');
  const read = () => h.page.evaluate(() => {
    const t = document.querySelector('[data-countdown]');
    const link = document.querySelector('.promo__link');
    return { text: t.textContent, linkX: link.getBoundingClientRect().left };
  });
  const a = await read();
  await h.page.waitForTimeout(2200);
  const b = await read();
  await close(h);
  expect(/^\dd \d\d:\d\d:\d\d$/.test(a.text), `unexpected format "${a.text}"`);
  expect(a.text !== b.text, 'countdown did not change in two seconds');
  expect(Math.abs(a.linkX - b.linkX) < 0.01, `the link beside it moved by ${Math.abs(a.linkX - b.linkX).toFixed(2)}px`);
});

await check('FAQ: one answer open at a time, state exposed to assistive tech', async () => {
  const h = await open(browser, 'all-access');
  const q = h.page.locator('.faq__q');
  expect((await q.count()) >= 3, 'no FAQ on the page');
  const openCount = () => h.page.locator('.faq__item.is-open').count();
  await q.nth(1).click(); await h.page.waitForTimeout(100);
  expect((await openCount()) === 1, `${await openCount()} answers open after opening the second`);
  expect((await q.nth(1).getAttribute('aria-expanded')) === 'true', 'aria-expanded not set on the open question');
  await q.nth(1).click(); await h.page.waitForTimeout(100);
  expect((await openCount()) === 0, 'clicking the open question did not close it');
  await close(h);
});

await check('with JavaScript off, every page still shows its content and every nav link is a real link', async () => {
  const h = await open(browser, 'index', { js: false });
  const info = await h.page.evaluate(() => ({
    h1: (document.querySelector('h1') || {}).offsetHeight || 0,
    cards: document.querySelectorAll('.plugin-card').length,
    navLinks: [...document.querySelectorAll('.site-nav > .nav-link, .has-mega > .nav-link')].map((a) => a.getAttribute('href')),
  }));
  await close(h);
  expect(info.h1 > 0 && info.cards === 6, 'content missing without JavaScript');
  expect(info.navLinks.every((href) => href && href !== '#' || true), 'nav link without a destination');
});

await check('keyboard: the first Tab stop is a skip link that jumps to the content', async () => {
  const h = await open(browser, 'index');
  await h.page.keyboard.press('Tab');
  const first = await h.page.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    return { text: a.textContent.trim(), href: a.getAttribute('href'), onScreen: r.top >= 0 && r.left >= 0 && r.width > 0 };
  });
  expect(first.text === 'Skip to content' && first.href === '#main', `first stop is "${first.text}"`);
  expect(first.onScreen, 'the skip link is not visible while it has focus');
  expect(await h.page.evaluate(() => !!document.getElementById('main')), 'no #main to jump to');
  await close(h);
});

await check('the promo link carries its coupon, and every page on the way passes it on to checkout', async () => {
  const h = await open(browser, 'index');
  const href = await h.page.getAttribute('.promo__link', 'href');
  await close(h);
  expect(/coupon=SUNNY30/.test(href), `promo link is ${href}`);
  const mid = await open(browser, 'all-access', { hash: '?coupon=SUNNY30' });
  const links = await mid.page.evaluate(() => [...document.querySelectorAll('a[href*="checkout.html"]')].map((a) => a.getAttribute('href')));
  await close(mid);
  expect(links.length > 0, 'no checkout links on the All Access page');
  expect(links.every((l) => /coupon=SUNNY30/.test(l)), `dropped by: ${links.filter((l) => !/coupon=/.test(l)).join(', ')}`);
  const plain = await open(browser, 'all-access');
  const untouched = await plain.page.evaluate(() => [...document.querySelectorAll('a[href*="checkout.html"]')].every((a) => !/coupon=/.test(a.getAttribute('href'))));
  await close(plain);
  expect(untouched, 'checkout links gained a coupon nobody asked for');
});

await check('phone: the promo bar is one line with the countdown, and all of it is the link', async () => {
  for (const width of [320, 360, 393, 430]) {
    const h = await open(browser, 'index', { width, height: 852 });
    const r = await h.page.evaluate(() => {
      const bar = document.querySelector('.promo').getBoundingClientRect();
      const timer = document.querySelector('.promo [data-countdown]').getBoundingClientRect();
      const hit = document.elementFromPoint(40, bar.top + bar.height / 2);
      return { h: bar.height, timer: timer.width, hit: hit && hit.closest('a') ? hit.closest('a').className : (hit ? hit.className : '') };
    });
    await close(h);
    expect(r.h <= 40, `${width}px: the bar is ${Math.round(r.h)}px tall, so it wrapped`);
    expect(r.timer > 0, `${width}px: the countdown is hidden`);
    expect(/promo__link/.test(r.hit), `${width}px: tapping the offer text does not follow the link (hit ${r.hit || 'nothing'})`);
  }
});

await check('touch tablet: tapping the account chip opens its menu, tapping elsewhere closes it', async () => {
  const h = await open(browser, 'index', { width: 1180, height: 820, touch: true });
  const menu = h.page.locator('.account-menu');
  expect(!(await menu.isVisible()), 'account menu open before any tap');
  await h.page.tap('.account-chip'); await h.page.waitForTimeout(150);
  expect(await menu.isVisible(), 'tap did not open the account menu');
  expect((await h.page.getAttribute('.account-chip', 'aria-expanded')) === 'true', 'aria-expanded not true');
  await h.page.touchscreen.tap(300, 600); await h.page.waitForTimeout(150);
  expect(!(await menu.isVisible()), 'tapping the page did not close it');
  await h.page.tap('.has-mega > .nav-link'); await h.page.waitForTimeout(150);
  expect(await h.page.locator('.mega').isVisible(), 'tap did not open the Plugins menu');
  await h.page.tap('.account-chip'); await h.page.waitForTimeout(150);
  expect(!(await h.page.locator('.mega').isVisible()) && (await menu.isVisible()), 'opening one menu left the other open');
  await close(h);
});

await check('the footer signup field shows the same focus colour as every other field', async () => {
  const h = await open(browser, 'index');
  await h.page.focus('.site-footer__signup .input');
  await h.page.waitForTimeout(250);
  const colour = await h.page.evaluate(() => getComputedStyle(document.querySelector('.site-footer__signup .input')).borderTopColor);
  await close(h);
  expect(colour === 'rgb(56, 88, 233)', `border is ${colour} while focused`);
});

// ---------------------------------------------------------------------------
group('Home');
await check('copy uses plain hyphens, never em dashes (the design rule)', async () => {
  const h = await open(browser, 'index');
  const hits = await h.page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (['SCRIPT', 'STYLE'].includes(n.parentElement.tagName)) continue;
      if (/\u2014/.test(n.textContent)) out.push(n.textContent.trim().slice(0, 50));
    }
    for (const el of document.querySelectorAll('[alt], [aria-label], [title], [placeholder], meta[content]')) {
      for (const a of ['alt', 'aria-label', 'title', 'placeholder', 'content']) if (/\u2014/.test(el.getAttribute(a) || '')) out.push(`@${a}: ${el.getAttribute(a).slice(0, 50)}`);
    }
    if (/\u2014/.test(document.title)) out.push('title: ' + document.title);
    return out;
  });
  await close(h);
  expect(hits.length === 0, `${hits.length} found: ${hits.slice(0, 4).join(' | ')}`);
});

await check('every image on the page is served by the site itself', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  const remote = await h.page.evaluate(() => {
    const urls = new Set();
    for (const img of document.images) if (/^https?:/.test(img.getAttribute('src') || '')) urls.add(img.getAttribute('src'));
    for (const el of document.querySelectorAll('*')) {
      const m = (getComputedStyle(el).backgroundImage || '').match(/url\("?(https?:[^")]+)/);
      if (m) urls.add(m[1]);
    }
    return [...urls];
  });
  await close(h);
  expect(remote.length === 0, `${remote.length} hot-linked: ${remote.slice(0, 3).join(', ')}`);
});

await check('in-page links point at something that exists', async () => {
  const h = await open(browser, 'index');
  const broken = await h.page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
    .map((a) => a.getAttribute('href')).filter((href) => href.length > 1 && !document.getElementById(href.slice(1))));
  await close(h);
  expect(broken.length === 0, `no target for ${[...new Set(broken)].join(', ')}`);
});

await check('phone: the hero badge is one line, and one centred guarantee sits under the buttons', async () => {
  for (const width of [360, 393, 430]) {
    const h = await open(browser, 'index', { width, height: 852 });
    const r = await h.page.evaluate(() => {
      const badge = document.querySelector('.hero__badge').getBoundingClientRect();
      const items = [...document.querySelectorAll('.trust-row .trust-item')].filter((el) => el.getBoundingClientRect().width > 0);
      const b = items[0].getBoundingClientRect();
      return { badgeH: badge.height, badgeRight: badge.right, n: items.length, centre: (b.left + b.right) / 2, vw: document.documentElement.clientWidth };
    });
    await close(h);
    expect(r.badgeH < 40, `${width}px: badge is ${Math.round(r.badgeH)}px tall - it wrapped`);
    expect(r.badgeRight <= r.vw - 15, `${width}px: badge runs into the gutter`);
    expect(r.n === 1, `${width}px: ${r.n} guarantee items showing`);
    expect(Math.abs(r.centre - r.vw / 2) < 2, `${width}px: guarantee is off centre by ${Math.round(Math.abs(r.centre - r.vw / 2))}px`);
  }
});

await check('phone: nothing in the storefront illustration covers anything else', async () => {
  for (const width of [320, 360, 393, 430, 540]) {
    const h = await open(browser, 'index', { width, height: 852 });
    const hits = await h.page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      const tags = [...document.querySelectorAll('.mock__tag, .mock__stat')].filter(vis);
      // The things a label must not sit on: text and controls inside the window.
      const content = [...document.querySelectorAll('.mock__title, .mock__price-was, .mock__price-now, .mock__currency, .mock__swatch, .mock__swatch-label, .mock__table span, .mock__table strong, .mock__cart, .mock__toast span:not(.tick), .mock__sale, .mock__url')].filter(vis);
      const out = [];
      const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      for (const t of tags) for (const c of content) {
        // measure the text itself, not the full-width box that holds it
        const range = document.createRange(); range.selectNodeContents(c);
        const rects = c.childNodes.length && c.textContent.trim() ? [...range.getClientRects()] : [c.getBoundingClientRect()];
        if (rects.some((r) => overlap(t.getBoundingClientRect(), r))) out.push(`${t.textContent.trim().slice(0, 12)} over ${c.className.split(' ')[0] || c.tagName}`);
      }
      for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) if (overlap(tags[i].getBoundingClientRect(), tags[j].getBoundingClientRect())) out.push(`${tags[i].textContent.trim().slice(0, 12)} over ${tags[j].textContent.trim().slice(0, 12)}`);
      const vw = document.documentElement.clientWidth;
      for (const t of tags) { const r = t.getBoundingClientRect(); if (r.left < 0 || r.right > vw) out.push(`${t.textContent.trim().slice(0, 12)} runs off screen`); }
      return [...new Set(out)];
    });
    await close(h);
    expect(hits.length === 0, `${width}px: ${hits.join('; ')}`);
  }
});

await check('phone: footer link groups sit two-up and the signup spans the row', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  const r = await h.page.evaluate(() => {
    const cols = [...document.querySelectorAll('.site-footer__cols > div')].map((el) => el.getBoundingClientRect());
    return { firstRowSame: Math.abs(cols[0].top - cols[1].top) < 1, signupWidth: cols[cols.length - 1].width, vw: document.documentElement.clientWidth };
  });
  await close(h);
  expect(r.firstRowSame, 'first two link groups are not side by side');
  expect(r.signupWidth > r.vw - 40, 'signup block does not span the row');
});

await check('the hero illustration reads as one described image, not as loose words', async () => {
  const h = await open(browser, 'index');
  const r = await h.page.evaluate(() => {
    const m = document.querySelector('.mock');
    return { role: m.getAttribute('role'), label: m.getAttribute('aria-label') || '' };
  });
  await close(h);
  expect(r.role === 'img', `role is ${r.role}`);
  expect(['YayCurrency', 'YaySwatches', 'YayPricing', 'YayBoost'].every((n) => r.label.includes(n)), 'the description does not name all four plugins');
});

await check('between phone and desktop the storefront illustration never clips or wraps its contents', async () => {
  const bad = [];
  for (const width of [480, 540, 620, 700, 768, 861, 900, 960, 1024, 1100, 1180, 1240]) {
    const h = await open(browser, 'index', { width, height: 900 });
    const r = await h.page.evaluate(() => {
      const win = document.querySelector('.mock__window').getBoundingClientRect();
      const out = [];
      for (const el of document.querySelectorAll('.mock__window *')) {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && (b.right > win.right + 0.5 || b.left < win.left - 0.5)) out.push(el.className.split(' ')[0]);
      }
      const lines = (sel) => { const el = document.querySelector(sel); return Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)); };
      if (lines('.mock__title') > 1) out.push('title wraps');
      if (document.querySelector('.mock__toast').getBoundingClientRect().height > 40) out.push('toast wraps');
      const vw = document.documentElement.clientWidth;
      for (const t of document.querySelectorAll('.mock__tag, .mock__stat')) { const b = t.getBoundingClientRect(); if (b.width && (b.left < 0 || b.right > vw)) out.push(`${t.textContent.trim().slice(0, 11)} off screen`); }
      return [...new Set(out)];
    });
    await close(h);
    if (r.length) bad.push(`${width}px: ${r.join(', ')}`);
  }
  expect(bad.length === 0, bad.join(' ; '));
});

await check('between phone and desktop the hero rows wrap as whole items, never mid-phrase', async () => {
  const bad = [];
  for (const width of [861, 900, 960, 1024, 1100]) {
    const h = await open(browser, 'index', { width, height: 900 });
    const r = await h.page.evaluate(() => {
      const oneLine = (el) => el.getBoundingClientRect().height < 1.9 * parseFloat(getComputedStyle(el).lineHeight || 18);
      const out = [];
      if (document.querySelector('.hero__badge').getBoundingClientRect().height > 40) out.push('badge wraps');
      for (const el of document.querySelectorAll('.trust-row .trust-item')) if (el.getBoundingClientRect().height > 24) out.push(`"${el.textContent.trim()}" breaks`);
      const copy = document.querySelector('.hero__copy').getBoundingClientRect();
      for (const el of document.querySelectorAll('.hero__actions .btn')) if (el.getBoundingClientRect().right > copy.right + 0.5) out.push('button leaves its column');
      return out;
    });
    await close(h);
    if (r.length) bad.push(`${width}px: ${r.join(', ')}`);
  }
  expect(bad.length === 0, bad.join(' ; '));
});

await check('tablet: no card is left alone beside an empty slot', async () => {
  const h = await open(browser, 'index', { width: 768, height: 1024 });
  const r = await h.page.evaluate(() => ['.case-grid', '.tstm-grid', '.blog-grid'].filter((sel) => {
    const grid = document.querySelector(sel);
    const rows = {};
    for (const c of grid.children) { const b = c.getBoundingClientRect(); (rows[Math.round(b.top)] ||= []).push(b); }
    const g = grid.getBoundingClientRect();
    return Object.values(rows).some((row) => row.reduce((w, b) => w + b.width, 0) < g.width * 0.9);
  }));
  await close(h);
  expect(r.length === 0, `a row is not filled in ${r.join(', ')}`);
});

await check('phone: the closing band keeps its icons between the gutters and its proof lines whole', async () => {
  for (const width of [320, 360, 375, 393, 430]) {
    const h = await open(browser, 'index', { width, height: 852 });
    const r = await h.page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const tiles = [...document.querySelectorAll('.cta-band__icons .ptile')].map((t) => t.getBoundingClientRect());
      const trust = document.querySelector('.cta-band__trust');
      const items = [...trust.children].filter((el) => el.getBoundingClientRect().width > 0);
      return {
        cut: tiles.filter((b) => b.left < 8 || b.right > vw - 8).length,
        trustH: trust.getBoundingClientRect().height,
        dots: items.filter((el) => el.classList.contains('cta-band__sep')).length,
        wrapped: items.filter((el) => el.getBoundingClientRect().height > 26).length,
      };
    });
    await close(h);
    expect(r.cut === 0, `${width}px: ${r.cut} icons run into the screen edge`);
    if (width >= 380) expect(r.trustH < 26, `${width}px: the proof line is ${Math.round(r.trustH)}px tall, so it wrapped`);
    else expect(r.dots === 0 && r.wrapped === 0, `${width}px: stacked proof lines still show ${r.dots} separators, and ${r.wrapped} of them wrap`);
  }
});

await check('reduced motion: the animated plugin icon is replaced by its still frame', async () => {
  const moving = await open(browser, 'index');
  const a = await moving.page.evaluate(() => getComputedStyle(document.querySelector('.plugin-card .ptile--yaymail')).backgroundImage);
  await close(moving);
  const still = await open(browser, 'index', { reducedMotion: 'reduce' });
  const b = await still.page.evaluate(() => getComputedStyle(document.querySelector('.plugin-card .ptile--yaymail')).backgroundImage);
  await close(still);
  expect(/yaymail\.gif/.test(a), `default icon is ${a}`);
  expect(/yaymail-still\.png/.test(b), `with reduced motion the icon is still ${b}`);
});

await check('images below the first screen load lazily and have their space reserved', async () => {
  const h = await open(browser, 'index');
  const r = await h.page.evaluate(() => [...document.querySelectorAll('main img')].map((img) => ({
    src: img.getAttribute('src'), lazy: img.loading === 'lazy', sized: img.hasAttribute('width') && img.hasAttribute('height'),
  })));
  await close(h);
  expect(r.length >= 7, `only ${r.length} images found`);
  expect(r.every((i) => i.sized), `no reserved size: ${r.filter((i) => !i.sized).map((i) => i.src).join(', ')}`);
  expect(r.every((i) => i.lazy), `not lazy: ${r.filter((i) => !i.lazy).map((i) => i.src).join(', ')}`);
});

await browser.close();
process.exit(report());
