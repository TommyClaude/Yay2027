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

await check('the pointer can cross from "Plugins" straight to the far side of its panel, and Escape closes a menu that hover opened', async () => {
  const h = await open(browser, 'index');
  const mega = h.page.locator('.mega');
  await h.page.hover('.has-mega > .nav-link');
  await h.page.waitForTimeout(150);
  const from = await h.page.locator('.has-mega > .nav-link').boundingBox();
  const to = await h.page.locator('.mega__bundle-cta').boundingBox();
  // A straight line leaves the trigger's cell before it reaches the panel.
  await h.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await h.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await h.page.waitForTimeout(350);
  expect(await mega.isVisible(), 'the menu closed while the pointer was on its way to the far column');
  expect(await h.page.evaluate(() => !document.activeElement.closest('.has-mega')), 'focus is inside the menu, so this would not test a hover-only menu');
  await h.page.keyboard.press('Escape');
  await h.page.waitForTimeout(100);
  expect(!(await mega.isVisible()), 'Escape did not close a menu that hover opened');
  await close(h);
});

await check('the Plugins menu is reachable from the keyboard, and Escape closes it and returns focus to its link', async () => {
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
  expect(await h.page.evaluate(() => document.activeElement === document.querySelector('.has-mega > .nav-link')), 'Escape did not return focus to the Plugins link');
  await h.page.waitForTimeout(150);
  expect(!(await h.page.locator('.mega').isVisible()), 'the returned focus opened the menu again');
  await close(h);
});

await check('the account menu opens on hover and holds its six rows', async () => {
  const h = await open(browser, 'index');
  await h.page.hover('.account-chip');
  await h.page.waitForTimeout(150);
  expect(await h.page.locator('.account-menu').isVisible(), 'account menu did not open');
  const labels = await h.page.locator('.account-menu .menu-item').allInnerTexts();
  expect(['Dashboard', 'Purchases', 'Downloads', 'Licenses', 'Profile', 'Log out'].every((t) => labels.some((l) => l.trim() === t)), `got ${labels.join(', ')}`);
  await close(h);
});

await check('the account button works from the keyboard (Enter, Space, Escape) and from a click that no pointer made', async () => {
  const h = await open(browser, 'index');
  const expanded = () => h.page.getAttribute('.account-chip', 'aria-expanded');
  const onChip = () => h.page.evaluate(() => document.activeElement.classList.contains('account-chip'));
  await h.page.focus('.account-chip'); await h.page.waitForTimeout(100);
  expect((await expanded()) === 'true', 'focus did not open the account menu');
  await h.page.keyboard.press('Enter'); await h.page.waitForTimeout(100);
  expect((await expanded()) === 'false', 'Enter did not close it');
  await h.page.keyboard.press('Space'); await h.page.waitForTimeout(100);
  expect((await expanded()) === 'true', 'Space did not open it');
  expect((await h.page.evaluate(() => window.scrollY)) === 0, 'Space scrolled the page');
  await h.page.keyboard.press('Escape'); await h.page.waitForTimeout(100);
  expect((await expanded()) === 'false' && (await onChip()), 'Escape did not close it and leave focus on the button');
  // How a screen reader or a switch activates a button: a click with no hover, focus or key before it.
  await h.page.evaluate(() => document.querySelector('.account-chip').click()); await h.page.waitForTimeout(100);
  expect((await expanded()) === 'true', 'a click from assistive tech did not open it');
  await close(h);
});

// ---------------------------------------------------------------------------
group('Drawer (the nav below 1025px)');
await check('phone: the bar keeps logo, cart and menu button; the nav is parked off-screen', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  expect(await h.page.locator('.site-header__logo img').isVisible(), 'logo missing from the bar');
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

await check('phone: opens from the button as a dialog that takes focus, makes the page behind it inert, and holds nav, account links and the CTA', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  await h.page.tap('.nav-toggle');
  await h.page.waitForTimeout(400);
  const box = await h.page.locator('#site-drawer').boundingBox();
  expect(box.x + box.width <= 394 && box.x >= 0, 'drawer did not slide fully into view');
  expect((await h.page.getAttribute('.nav-toggle', 'aria-expanded')) === 'true', 'aria-expanded not true');
  const state = await h.page.evaluate(() => {
    const panel = document.getElementById('site-drawer');
    const chip = panel.querySelector('.account-chip');
    return { role: panel.getAttribute('role'), modal: panel.getAttribute('aria-modal'), focusInside: panel.contains(document.activeElement), chipRole: chip.getAttribute('role'), chipTab: chip.getAttribute('tabindex'), behind: document.querySelector('main').inert === true && document.querySelector('.site-footer').inert === true };
  });
  expect(state.role === 'dialog' && state.modal === 'true', `the open drawer has role ${state.role}, aria-modal ${state.modal}`);
  expect(state.focusInside, 'focus did not move into the drawer');
  expect(state.chipRole === null && state.chipTab === null, 'the account name still poses as a button inside the drawer');
  expect(state.behind, 'the page behind the open drawer is not inert');
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
  const onToggle = () => h.page.evaluate(() => document.activeElement.classList.contains('nav-toggle'));
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  await h.page.tap('.drawer-close'); await h.page.waitForTimeout(400);
  expect(await offscreen(), '✕ did not close it');
  expect(await onToggle(), 'after ✕, focus did not return to the menu button');
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  await h.page.touchscreen.tap(14, 500); await h.page.waitForTimeout(400);
  expect(await offscreen(), 'tapping the scrim did not close it');
  expect(await onToggle(), 'after the scrim, focus did not return to the menu button');
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  await h.page.keyboard.press('Escape'); await h.page.waitForTimeout(400);
  expect(await offscreen(), 'Escape did not close it');
  expect(await onToggle(), 'after Escape, focus did not return to the menu button');
  expect((await h.page.getAttribute('.nav-toggle', 'aria-expanded')) === 'false', 'aria-expanded not reset');
  expect(await h.page.evaluate(() => document.querySelector('main').inert === false), 'the page stayed inert after the drawer closed');
  await close(h);
});

await check('phone: with the plugin list closed, every drawer row is on screen or reachable by scrolling, none behind the button', async () => {
  for (const [width, height] of [[393, 659], [375, 629], [360, 640], [393, 852]]) {
    const h = await open(browser, 'index', { width, height });
    await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
    const r = await h.page.evaluate(() => {
      const panel = document.getElementById('site-drawer');
      const btn = panel.querySelector('.site-header__actions > .btn');
      const b = btn.getBoundingClientRect();
      const rows = [...panel.querySelectorAll('.site-nav > .nav-link, .has-mega > .nav-link, .account-menu .menu-item')];
      // a row is "behind the button" if the button is painted over the row's own box
      const covered = rows.filter((el) => { const q = el.getBoundingClientRect(); return q.bottom > b.top + 1 && q.top < b.bottom - 1; }).map((el) => el.textContent.trim());
      return { covered, pinned: getComputedStyle(btn).position === 'sticky' };
    });
    await close(h);
    expect(!r.pinned, `${width}x${height}: the button is pinned although the list is short`);
    expect(r.covered.length === 0, `${width}x${height}: hidden behind the button: ${r.covered.join(', ')}`);
  }
});

await check('phone: the drawer\'s main button and close button stay on screen while a long plugin list scrolls behind them', async () => {
  for (const [width, height] of [[393, 659], [320, 568]]) {
    const h = await open(browser, 'index', { width, height });
    await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
    await h.page.tap('.has-mega > .nav-link'); await h.page.waitForTimeout(250);
    await h.page.evaluate(() => { document.getElementById('site-drawer').scrollTop = 300; });
    await h.page.waitForTimeout(100);
    const r = await h.page.evaluate(() => {
      const panel = document.getElementById('site-drawer');
      const btn = panel.querySelector('.site-header__actions > .btn').getBoundingClientRect();
      const close = panel.querySelector('.drawer-close').getBoundingClientRect();
      const hit = document.elementFromPoint(close.left + close.width / 2, close.top + close.height / 2);
      return { scrolls: panel.scrollHeight > panel.clientHeight + 40, top: btn.top, bottom: btn.bottom, vh: window.innerHeight, closeH: close.height, closeTop: close.top, closeHit: !!(hit && hit.closest('.drawer-close')) };
    });
    await close(h);
    expect(r.scrolls, `${width}x${height}: the list is not long enough to test`);
    expect(r.top > 0 && r.bottom <= r.vh, `${width}x${height}: the button is at ${Math.round(r.top)}-${Math.round(r.bottom)} of ${r.vh}`);
    expect(r.closeH >= 39, `${width}x${height}: the close button is squeezed to ${Math.round(r.closeH)}px`);
    expect(r.closeTop >= 0 && r.closeHit, `${width}x${height}: after scrolling, the close button is at y=${Math.round(r.closeTop)} and ${r.closeHit ? 'reachable' : 'not reachable'}`);
  }
});

await check('phone: scrolled to its end, a long plugin list leaves its last row clear of the pinned button and the strip behind it', async () => {
  for (const [width, height] of [[393, 659], [320, 568], [768, 1024]]) {
    const h = await open(browser, 'index', { width, height });
    await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
    await h.page.tap('.has-mega > .nav-link'); await h.page.waitForTimeout(250);
    await h.page.evaluate(() => { const panel = document.getElementById('site-drawer'); panel.scrollTop = panel.scrollHeight; });
    await h.page.waitForTimeout(100);
    const r = await h.page.evaluate(() => {
      const panel = document.getElementById('site-drawer');
      const btn = panel.querySelector('.site-header__actions > .btn');
      const b = btn.getBoundingClientRect();
      // The strip behind the pinned button is drawn with flat shadows and a
      // rule above them; it starts at whichever of those reaches highest.
      let stripTop = b.top;
      for (const m of getComputedStyle(btn).boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g)) stripTop = Math.min(stripTop, b.top + Number(m[2]) - Number(m[4]));
      const rule = getComputedStyle(btn, '::before');
      if (rule.content !== 'none') stripTop = Math.min(stripTop, b.bottom - parseFloat(rule.bottom) - parseFloat(rule.height));
      const last = [...panel.querySelectorAll('.account-menu .menu-item')].pop();
      return { pinned: getComputedStyle(btn).position === 'sticky', stripTop, lastBottom: last.getBoundingClientRect().bottom, label: last.textContent.trim(), spill: panel.scrollWidth - panel.clientWidth };
    });
    await close(h);
    expect(r.pinned, `${width}x${height}: the button is not pinned with the plugin list open`);
    expect(r.lastBottom <= r.stripTop + 0.5, `${width}x${height}: "${r.label}" ends at ${Math.round(r.lastBottom)}, under the strip that starts at ${Math.round(r.stripTop)}`);
    expect(r.spill <= 0, `${width}x${height}: the drawer scrolls sideways by ${r.spill}px`);
  }
});

await check('phone: a drawer row reached with Tab is never under the pinned button or the close button', async () => {
  for (const [width, height] of [[393, 659], [320, 568]]) {
    const h = await open(browser, 'index', { width, height });
    await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
    await h.page.tap('.has-mega > .nav-link'); await h.page.waitForTimeout(250);
    await h.page.focus('.drawer-close');
    const hidden = [];
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let i = 0; i < 26; i++) {
        await h.page.keyboard.press(key);
        await h.page.waitForTimeout(40);
        const r = await h.page.evaluate(() => {
          const panel = document.getElementById('site-drawer');
          const el = document.activeElement;
          const btn = panel.querySelector('.site-header__actions > .btn');
          const x = panel.querySelector('.drawer-close');
          if (!panel.contains(el) || el === btn || el === x) return null;
          const q = el.getBoundingClientRect();
          const b = btn.getBoundingClientRect();
          let stripTop = b.top;
          for (const m of getComputedStyle(btn).boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g)) stripTop = Math.min(stripTop, b.top + Number(m[2]) - Number(m[4]));
          const c = x.getBoundingClientRect();
          const under = q.bottom > stripTop + 1 ? 'the pinned button' : q.top < c.bottom - 1 && q.right > c.left + 1 ? 'the close button' : q.top < -1 || q.bottom > innerHeight + 1 ? 'the edge of the screen' : '';
          return under ? `"${el.textContent.trim().slice(0, 24)}" under ${under}` : '';
        });
        if (r) hidden.push(r);
      }
    }
    await close(h);
    expect(hidden.length === 0, `${width}x${height}: ${[...new Set(hidden)].slice(0, 4).join('; ')}`);
  }
});

await check('phone: Tab and Shift+Tab reach every control of the open drawer and never leave it', async () => {
  const h = await open(browser, 'index', { width: 393, height: 852 });
  await h.page.tap('.nav-toggle'); await h.page.waitForTimeout(400);
  for (const key of ['Tab', 'Shift+Tab']) {
    const seen = new Set();
    let outside = 0;
    for (let i = 0; i < 30; i++) {
      await h.page.keyboard.press(key);
      const r = await h.page.evaluate(() => {
        const el = document.activeElement;
        return { inside: !!el.closest('#site-drawer'), id: `${(el.textContent || '').trim().slice(0, 30)}|${el.getAttribute('aria-label') || ''}|${el.className}` };
      });
      if (r.inside) seen.add(r.id); else outside++;
    }
    expect(outside === 0, `${key}: focus left the drawer on ${outside} of 30 presses`);
    // close button, five pages, six account rows, the main button
    expect(seen.size === 13, `${key}: reached ${seen.size} of the drawer's 13 controls`);
  }
  await close(h);
});

await check('phone: a link in the drawer goes to its page, which opens with the drawer closed', async () => {
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

await check('with JavaScript off, Home shows its content, every nav link but Blog has a destination, and phones get the nav as plain links', async () => {
  const h = await open(browser, 'index', { js: false });
  const info = await h.page.evaluate(() => ({
    h1: (document.querySelector('h1') || {}).offsetHeight || 0,
    cards: document.querySelectorAll('.plugin-card').length,
    navLinks: [...document.querySelectorAll('.site-nav > .nav-link, .has-mega > .nav-link')].map((a) => a.getAttribute('href')),
  }));
  await h.page.focus('.account-chip');
  const accountOpens = await h.page.locator('.account-menu').isVisible();
  await close(h);
  expect(info.h1 > 0 && info.cards === 6, 'content missing without JavaScript');
  const dead = info.navLinks.filter((href) => !href || href === '#');
  expect(info.navLinks.length === 5 && dead.length <= 1, `${dead.length} of ${info.navLinks.length} nav links go nowhere`);   // Blog has no page yet
  expect(accountOpens, 'desktop: the account menu cannot be opened without JavaScript');
  for (const width of [393, 768]) {
    const p = await open(browser, 'index', { js: false, width, height: 852 });
    const r = await p.page.evaluate(() => {
      const shown = (el) => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return cs.visibility === 'visible' && cs.display !== 'none' && b.width > 0 && b.height > 0 && b.left >= 0 && b.right <= innerWidth + 0.5; };
      const links = [...document.querySelectorAll('.site-nav > .nav-link, .has-mega > .nav-link, .account-menu .menu-item')];
      return { shown: links.filter(shown).length, total: links.length, button: shown(document.querySelector('.nav-toggle')), spill: document.documentElement.scrollWidth - innerWidth };
    });
    await close(p);
    expect(r.shown === r.total && r.total === 11, `${width}px: ${r.shown} of ${r.total} nav and account links can be seen`);
    expect(!r.button, `${width}px: the menu button shows although nothing can open a menu`);
    expect(r.spill <= 0, `${width}px: the page scrolls sideways by ${r.spill}px`);
  }
});

await check('keyboard: the first Tab stop is a skip link; using it puts the next Tab inside the content and leaves the address alone', async () => {
  // My account reads the address to choose its view, so it is the page a careless skip link breaks.
  for (const [name, hash] of [['index', ''], ['account', '#licenses']]) {
    const h = await open(browser, name, { hash });
    await h.page.keyboard.press('Tab');
    const first = await h.page.evaluate(() => {
      const a = document.activeElement;
      const r = a.getBoundingClientRect();
      return { text: a.textContent.trim(), href: a.getAttribute('href'), onScreen: r.top >= 0 && r.left >= 0 && r.width > 0 };
    });
    expect(first.text === 'Skip to content' && first.href === '#main', `${name}: first stop is "${first.text}"`);
    expect(first.onScreen, `${name}: the skip link is not visible while it has focus`);
    await h.page.keyboard.press('Enter'); await h.page.waitForTimeout(150);
    await h.page.keyboard.press('Tab');
    const after = await h.page.evaluate(() => ({
      inContent: !!document.activeElement.closest('main'),
      hash: location.hash,
      view: (document.querySelector('[data-view-link].is-active') || { dataset: {} }).dataset.viewLink || '',
    }));
    await close(h);
    expect(after.inContent, `${name}: the Tab after the skip link landed outside the content`);
    expect(after.hash === hash, `${name}: the address went from "${hash}" to "${after.hash}"`);
    if (name === 'account') expect(after.view === 'licenses', `account: the skip link changed the view to "${after.view}"`);
  }
});

await check('the promo link carries its coupon; All Access passes it on, a detour through another plugin keeps it, a malformed code is dropped', async () => {
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
  // The same tab goes on to look at a plugin before buying.
  const tab = await open(browser, 'all-access', { hash: '?coupon=SUNNY30' });
  await tab.page.goto(tab.page.url().replace(/all-access\.html.*$/, 'yaypricing.html'));
  await tab.page.waitForTimeout(200);
  const later = await tab.page.evaluate(() => [...document.querySelectorAll('a[href*="checkout.html"]')].map((a) => a.getAttribute('href')));
  await close(tab);
  expect(later.length > 0 && later.every((l) => /coupon=SUNNY30/.test(l)), `after a detour to the product page: ${later.filter((l) => !/coupon=SUNNY30/.test(l)).length} of ${later.length} checkout links lost the code`);
  for (const code of ['%3Cscript%3Ealert(1)%3C%2Fscript%3E', 'A%20B', 'x'.repeat(40)]) {
    const bad = await open(browser, 'all-access', { hash: `?coupon=${code}` });
    const dropped = await bad.page.evaluate(() => [...document.querySelectorAll('a[href*="checkout.html"]')].every((a) => !/coupon=/.test(a.getAttribute('href'))));
    await close(bad);
    expect(dropped, `a malformed code (${code.slice(0, 16)}) was passed on to checkout`);
  }
});

await check('phone: at every width from 320 to 620px the promo bar is one line with the countdown, and all of it is the link', async () => {
  const h = await open(browser, 'index', { width: 320, height: 852 });
  const bad = [];
  for (let width = 320; width <= 620; width += width < 440 ? 1 : 10) {
    await h.page.setViewportSize({ width, height: 852 });
    const r = await h.page.evaluate(() => {
      const bar = document.querySelector('.promo').getBoundingClientRect();
      const timer = document.querySelector('.promo [data-countdown]').getBoundingClientRect();
      const hit = document.elementFromPoint(40, bar.top + bar.height / 2);
      return { h: bar.height, timer: timer.width, hit: hit && hit.closest('a') ? hit.closest('a').className : (hit ? hit.className : '') };
    });
    if (r.h > 40) bad.push(`${width}px: the bar is ${Math.round(r.h)}px tall, so it wrapped`);
    if (!(r.timer > 0)) bad.push(`${width}px: the countdown is hidden`);
    if (!/promo__link/.test(r.hit)) bad.push(`${width}px: tapping the offer text does not follow the link (hit ${r.hit || 'nothing'})`);
  }
  await close(h);
  expect(bad.length === 0, bad.slice(0, 5).join(' ; '));
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
await check('text links with an arrow still underline on hover, as every text link does', async () => {
  // A link that holds a child element is treated as a card and loses its
  // underline, so these have to stay plain text with their arrow.
  const h = await open(browser, 'index');
  const plain = [];
  for (const sel of ['.band-featured .section-head__link', '.case-card__foot a', '.section-head__link[aria-label="Visit the blog"]']) {
    const link = h.page.locator(sel).first();
    await link.scrollIntoViewIfNeeded();
    await link.hover();
    await h.page.waitForTimeout(150);
    const line = await link.evaluate((a) => getComputedStyle(a).textDecorationLine);
    if (line !== 'underline') plain.push(`${sel} is "${line}"`);
  }
  await close(h);
  expect(plain.length === 0, plain.join(' ; '));
});

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

await check('a hyphen that stands in for a dash never starts a line', async () => {
  const bad = [];
  for (const width of [320, 327, 360, 393, 430, 462, 540, 768, 880, 1040, 1120, 1185, 1280, 1440]) {
    const h = await open(browser, 'index', { width, height: 900 });
    const hits = await h.page.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent;
        for (let i = text.indexOf('- '); i !== -1; i = text.indexOf('- ', i + 1)) {
          if (i === 0 || !/\s/.test(text[i - 1])) continue;          // only a free-standing hyphen
          const hyphen = document.createRange(); hyphen.setStart(n, i); hyphen.setEnd(n, i + 1);
          const before = document.createRange(); before.setStart(n, Math.max(0, i - 2)); before.setEnd(n, i - 1);
          const a = hyphen.getBoundingClientRect(), b = before.getBoundingClientRect();
          if (a.width && b.width && a.top > b.top + 4) out.push(text.slice(Math.max(0, i - 14), i + 14).trim());
        }
      }
      return out;
    });
    await close(h);
    if (hits.length) bad.push(`${width}px: "${hits[0]}"`);
  }
  expect(bad.length === 0, bad.join(' ; '));
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
        // Measure the text itself, not the full-width box that holds it, except
        // where the box clips its text (the address pill): there the box is what shows.
        const range = document.createRange(); range.selectNodeContents(c);
        const clips = getComputedStyle(c).overflowX !== 'visible';
        const rects = !clips && c.childNodes.length && c.textContent.trim() ? [...range.getClientRects()] : [c.getBoundingClientRect()];
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

await check('footer: the language picker and the social icons share a row from 352px up, and nothing in the bottom block wraps inside itself', async () => {
  for (const width of [352, 360, 375, 393, 430, 600, 667, 768, 1024]) {
    const h = await open(browser, 'index', { width, height: 852 });
    const r = await h.page.evaluate(() => {
      const lang = document.querySelector('.f-lang').getBoundingClientRect();
      const social = document.querySelector('.site-footer__social').getBoundingClientRect();
      const spans = [...document.querySelectorAll('.site-footer__bottom > span')].map((el) => el.getBoundingClientRect().height);
      return { sameRow: Math.abs((lang.top + lang.height / 2) - (social.top + social.height / 2)) < 12, tallest: Math.max(...spans) };
    });
    await close(h);
    expect(r.sameRow, `${width}px: the language picker and the social icons are on different rows`);
    expect(r.tallest < 26, `${width}px: a line of the bottom block wraps (${Math.round(r.tallest)}px tall)`);
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
    return {
      role: m.getAttribute('role'),
      label: m.getAttribute('aria-label') || '',
      loose: [...m.children].filter((c) => c.getAttribute('aria-hidden') !== 'true').map((c) => c.className),
      focusable: m.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length,
    };
  });
  await close(h);
  expect(r.role === 'img', `role is ${r.role}`);
  expect(['YayCurrency', 'YaySwatches', 'YayPricing', 'YayBoost'].every((n) => r.label.includes(n)), 'the description does not name all four plugins');
  expect(r.loose.length === 0, `inside the image and not hidden from assistive tech: ${r.loose.join(', ')}`);
  expect(r.focusable === 0, `${r.focusable} focusable elements inside the drawing`);
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

// One page resized through every 5px between the phone step and the design
// width, with the same questions asked at each: this is where layouts that
// "just fit" at the usual test widths come apart.
const wrapSweep = () => {
  const out = [];
  const tall = (el, limit) => el && el.getBoundingClientRect().height > limit;
  // Lines of visible text. Words written only for screen readers are clipped
  // to a 1px box but still report full-size rectangles, so they are skipped.
  const lines = (el) => {
    const tops = new Set();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest('.visually-hidden')) continue;
      const r = document.createRange(); r.selectNodeContents(node);
      for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) tops.add(Math.round(q.top / 4));
    }
    return tops.size;
  };
  for (const el of document.querySelectorAll('.site-nav > .nav-link, .has-mega > .nav-link')) if (el.getBoundingClientRect().width && tall(el, 50)) out.push(`nav "${el.textContent.trim()}" wraps`);
  for (const card of document.querySelectorAll('.tstm-card')) {
    const badge = card.querySelector('.badge'), star = card.querySelector('.stars svg:last-child');
    if (tall(badge, 26)) out.push('testimonial badge wraps');
    if (tall(card.querySelector('.tstm-card__role'), 24)) out.push('testimonial place wraps');
    const b = badge.getBoundingClientRect(), s = star.getBoundingClientRect();
    if (Math.min(b.right, s.right) - Math.max(b.left, s.left) > 0 && Math.min(b.bottom, s.bottom) - Math.max(b.top, s.top) > 0) out.push('testimonial badge covers a star');
  }
  for (const foot of document.querySelectorAll('.case-card__foot')) for (const el of foot.children) if (lines(el) > 1) out.push(`case-study "${el.textContent.trim().slice(0, 16)}" wraps`);
  for (const el of document.querySelectorAll('.site-footer__bottom > span')) if (tall(el, 26)) out.push(`footer "${el.textContent.trim().slice(0, 14)}" wraps`);
  const btns = [...document.querySelectorAll('.hero__actions .btn')].map((el) => el.getBoundingClientRect());
  if (window.innerWidth > 620 && Math.abs(btns[0].top - btns[1].top) > 2) out.push('hero buttons on two rows');
  const items = [...document.querySelectorAll('.trust-row .trust-item')].filter((el) => el.getBoundingClientRect().width);
  if (window.innerWidth > 620 && new Set(items.map((el) => Math.round(el.getBoundingClientRect().top))).size > 1) out.push('hero guarantees on two rows');
  const trust = [...document.querySelector('.cta-band__trust').children].filter((el) => el.getBoundingClientRect().width);
  for (const el of trust) {
    if (!el.classList.contains('cta-band__sep')) continue;
    const q = el.getBoundingClientRect();
    const row = trust.filter((o) => Math.abs(o.getBoundingClientRect().top - q.top) < 6);
    if (row[0] === el || row[row.length - 1] === el) out.push('closing-band separator at a row edge');
  }
  const h1 = document.querySelector('.h-hero'); const range = document.createRange(); range.selectNodeContents(h1);
  const rects = [...range.getClientRects()]; const lastTop = Math.max(...rects.map((q) => q.top));
  const lastWidth = rects.filter((q) => Math.abs(q.top - lastTop) < 4).reduce((w, q) => w + q.width, 0);
  if (rects.some((q) => Math.abs(q.top - lastTop) > 4) && lastWidth < 0.3 * h1.getBoundingClientRect().width) out.push('headline ends on a short last line');
  return [...new Set(out)];
};

async function sweepHome(browserForSweep, from, to, step) {
  const h = await open(browserForSweep, 'index', { width: from, height: 900, touch: false });
  const found = {};
  for (let width = from; width <= to; width += step) {
    await h.page.setViewportSize({ width, height: 900 });
    for (const problem of await h.page.evaluate(wrapSweep)) (found[problem] ||= []).push(width);
  }
  await h.context.close();
  return Object.entries(found).map(([problem, widths]) => `${problem} at ${widths[0]}${widths.length > 1 ? `-${widths[widths.length - 1]}` : ''}px`);
}

await check('between phone and desktop, every 5px: no nav label, badge, name, footer line or button row wraps, and no heading is orphaned', async () => {
  const problems = await sweepHome(browser, 621, 1300, 5);
  expect(problems.length === 0, problems.join(' ; '));
});

await check('the same sweep with scrollbars that take up width, as on Windows', async () => {
  const windows = await launch({ classicScrollbars: true });
  const problems = await sweepHome(windows, 621, 1300, 5);
  await windows.close();
  expect(problems.length === 0, problems.join(' ; '));
});

await check('a 1280px window that loses width to a scrollbar still shows the hero drawing and the footer as designed', async () => {
  // Windows at 150% scaling, or a Mac with a mouse: the window counts as 1280px
  // for media queries while the page is laid out 15 to 17px narrower.
  const measure = (page) => page.evaluate(() => {
    const lead = document.querySelector('.mock__toast-lead');
    const blurb = document.querySelector('.site-footer__blurb');
    const range = document.createRange(); range.selectNodeContents(blurb);
    const stat = document.querySelector('.mock__stat').getBoundingClientRect();
    const tick = document.querySelector('.mock__toast .tick').getBoundingClientRect();
    return {
      layout: document.documentElement.clientWidth,
      lead: getComputedStyle(lead).display !== 'none',
      boost: getComputedStyle(document.querySelector('.mock__tag--boost')).bottom,
      tracks: getComputedStyle(document.querySelector('.mock__table-row')).gridTemplateColumns.split(' ').map((v) => Math.round(parseFloat(v))).join(' '),
      blurbLines: new Set([...range.getClientRects()].map((q) => Math.round(q.top))).size,
      cardToTick: tick.left - stat.right,
    };
  });
  const plain = await open(browser, 'index', { width: 1280 });
  const designed = await measure(plain.page);
  await close(plain);
  const windows = await launch({ classicScrollbars: true });
  for (const bar of [15, 17]) {
    const h = await open(windows, 'index', { width: 1280 });
    if (bar !== 15) { await h.page.addStyleTag({ content: `::-webkit-scrollbar { width: ${bar}px; }` }); await h.page.waitForTimeout(150); }
    const r = await measure(h.page);
    await close(h);
    expect(r.layout < 1280, `${bar}px scrollbar: the page is laid out ${r.layout}px wide, so the scrollbar is not taking width`);
    expect(r.lead, `${bar}px scrollbar: the toast lost its first half`);
    expect(r.boost === designed.boost, `${bar}px scrollbar: the last label sits ${r.boost} from the bottom, ${designed.boost} as designed`);
    const even = r.tracks.split(' ').map(Number);
    expect(Math.max(...even) - Math.min(...even) <= 1, `${bar}px scrollbar: the discount table's columns are ${r.tracks}, not equal as designed`);
    expect(r.cardToTick > 8, `${bar}px scrollbar: the result card is ${Math.round(r.cardToTick)}px from the toast's tick`);
    expect(r.blurbLines === designed.blurbLines, `${bar}px scrollbar: the footer blurb is on ${r.blurbLines} lines, ${designed.blurbLines} as designed`);
  }
  await windows.close();
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

await check('the closing band keeps its icons between the gutters and never ends a proof line on a separator', async () => {
  for (const width of [320, 344, 352, 359, 360, 375, 393, 430, 621, 640, 685, 760]) {
    const h = await open(browser, 'index', { width, height: 852 });
    const r = await h.page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const tiles = [...document.querySelectorAll('.cta-band__icons .ptile')].map((t) => t.getBoundingClientRect());
      const trust = document.querySelector('.cta-band__trust');
      const items = [...trust.children].filter((el) => el.getBoundingClientRect().width > 0);
      const endsRow = (el) => { const q = el.getBoundingClientRect(); return !items.some((o) => o !== el && Math.abs(o.getBoundingClientRect().top - q.top) < 6 && o.getBoundingClientRect().left > q.left); };
      return {
        cut: tiles.filter((b) => b.left < 8 || b.right > vw - 8).length,
        size: getComputedStyle(trust).fontSize,
        strandedDots: items.filter((el) => el.classList.contains('cta-band__sep') && endsRow(el)).length,
        wrapped: items.filter((el) => el.getBoundingClientRect().height > 26).length,
      };
    });
    await close(h);
    expect(r.cut === 0, `${width}px: ${r.cut} icons run into the screen edge`);
    expect(r.size === '13px', `${width}px: the proof line is set at ${r.size}, not the 13px it was drawn at`);
    expect(r.strandedDots === 0, `${width}px: a separator dot is left at the end of a row`);
    expect(r.wrapped === 0, `${width}px: ${r.wrapped} of the proof items wrap inside themselves`);
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
