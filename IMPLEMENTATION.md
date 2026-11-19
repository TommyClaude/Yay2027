# YayCommerce - implementation notes

The YayCommerce design prototypes are built out as a plain static site.

```
src/            source
  pages/        one file per page: front matter + <main> content
  partials/     shared chrome (head, promo bar, header, footer)
  assets/       css, js, images, copied to the output as-is
build.mjs       stamps the chrome around each page
docs/           the built site: plain HTML/CSS/JS, served by GitHub Pages
tests/          browser checks and a visual regression script
```

Build with `node build.mjs` (Node 18+, no dependencies, no install step).

---

## What was decided

The prototypes carry a Tweaks panel with several themes, three design styles and
a light/dark footer. Version 3.2, the configuration the design session finished
on, is baked in, and the alternatives are gone:

| Setting | Value |
|---|---|
| Accent | `yellow-blue`: brand yellow `#ffc421` for actions, WordPress blue `#3858e9` for links, focus and selection |
| Design style | `elevated`: white cards, 10px radii, soft drop shadows |
| Footer | light |
| Header | logged in, promo bar on, plugin-grouped mega menu |
| Catalogue | 6 featured plugins in a 3-across grid |

Dropping the variants is what turns the prototype's attribute-selector overrides
(`[style*="border: 1px solid rgb(221, 221, 221)"]`…) into ordinary classes. The
elevated/yellow values were resolved by hand and written straight into the
tokens in `src/assets/css/base.css`, so nothing is computed at runtime.

One rule of that style is easy to miss and matters everywhere: inside a lifted
card the prototype drops every fill one step (white to `#f6f7f7`, `#f6f7f7` to
`#f0f0f1`) and fades every divider to `#f6f7f7`. Home follows it throughout.

## Pages

| Page | File | Notes |
|---|---|---|
| Home | `index.html` | Hero storefront illustration, catalogue, All Access band, case studies, bento, testimonials, blog |
| Shop | `shop.html` | Client-side search, category tabs and sort over the 10 cards in the HTML |
| Product | `yaypricing.html` | Gallery, buy box, sticky purchase bar, tabs, paginated reviews, review modal |
| All Access | `all-access.html` | Bundle contents, annual vs lifetime, comparison table, FAQ |
| Checkout | `checkout.html` | Three numbered cards, order bump, coupons, PayPal / card |
| Thank you | `thank-you.html` | Order, licence key, three setup steps |
| My account | `account.html` | Dashboard · Purchases (+ order detail) · Downloads · Licenses · Profile |
| Docs | `docs.html` | Search across plugins with hidden keywords behind the popular chips |
| Support | `support.html` | Email / live chat / Messenger |
| Contact | `contact.html` | Ideas and partnerships only; product help routes to Support |

Every page is reachable from every other, and the funnel clicks through end to
end: Home → Shop → Product → Checkout → Thank you.

## Behaviour

`site.js` loads everywhere (header menus, mobile drawer, sale countdown, FAQ
accordion, campaign coupon); each page adds at most one more file. Interactive
state is rendered server-side first and adjusted by script, so the catalogue,
reviews and docs are complete with JavaScript off.

How the header behaves depends on the device, not just the width:

| | Plugins menu | Account menu |
|---|---|---|
| Mouse or trackpad | opens on hover and on keyboard focus; Escape closes it and returns focus | the same |
| Touch, wide screen (a tablet held sideways) | opens and closes on tap; a tap elsewhere closes it | the same |
| Drawer (1024px and below) | an accordion row inside the drawer | its links are simply part of the list |

The drawer is a dialog while it is open: focus moves into it, Tab stays inside
it, and Escape, the ✕ and the dimmed page all close it and hand focus back to
the menu button. Closed, it is hidden outright rather than only parked
off-screen, so its links are out of the tab order and its shadow does not lie
along the edge of the page.

Details carried over from the design conversation, since they are decisions
rather than styling:

- **One subscription per order.** EDD Recurring can't take two subscriptions in
  one checkout, so the cart holds a single line and the All Access bump *swaps*
  it rather than adding to it.
- **Coupons stay behind a link, and the campaign link applies its own.** An
  open, empty coupon field sends people off to hunt for codes. "Get the deal"
  in the promo bar links to `all-access.html?coupon=SUNNY30`; `site.js` passes
  a coupon in the address on to every checkout link on the page, and checkout
  applies it on arrival.
- **The payment tab's border never changes width.** The heavier ring is an
  inset shadow, so switching methods doesn't nudge the layout, and the selected
  tab carries a tick, not just a colour.
- **No refund reminder on the thank-you page.** The guarantee's job is before
  the purchase; afterwards it only makes the exit prominent.
- **The email address on Contact is assembled in script**, not sitting in the
  markup for harvesters.
- **The auto-renewal line next to the pay button stays.** It is a disclosure
  requirement, which is why it is quiet rather than absent.
- **Plain hyphens, never em dashes**, in everything a visitor or a reader of
  the source can see.

## Deliberate differences from the prototypes

1. **Static cards don't react to hover.** The prototype's catch-all selectors
   gave a hover shadow to any bordered box, including ones that aren't
   clickable; the design conversation repeatedly asked for the opposite. Only
   links lift here. For the same reason the "Read story →" and "Visit the
   blog →" text links hover like text links: in the Home prototype they carry
   the blog card's class by accident and pick up its heavy shadow.
2. **The header shadow is on every page.** The prototype had it everywhere
   except Home, which was an oversight in a shared component.
3. **Log out has the door-and-arrow icon in the header menu on every page.**
   The request was for the header menu to use the same icons as the My account
   sidebar; the Home prototype alone kept a back-chevron.
4. **The "Add to cart" inside the hero illustration is part of a drawing.** It
   does not take the pointer or darken on hover, and assistive technology gets
   the whole illustration as one described image.
5. **Semantics and labels.** Tier and tab controls are real `<button>`s, forms
   have labels, menus carry `aria-*` and can be reached by keyboard, and a skip
   link is the first Tab stop. The prototypes used click handlers on divs.
6. **Light DOM cleanup.** `<dl>` for spec and totals lists, `<table>` for the
   purchases table, headings in order.
7. **Two corner radii are held consistent** where the prototypes contradict
   themselves. The account chip is a 2px hover target on Home, the product page,
   All Access and My account, but 4px on Shop, Docs, Support and Contact; this
   build uses 2px everywhere the chip opens a menu, and 4px on the checkout and
   thank-you headers where it is a plain link. The Profile panel on My account
   is a design-system card at 4px while every other panel on that page is a
   hand-styled 10px card; all panels are 10px here.

## Below the design width

The prototypes were only drawn at 1280px and up, so everything narrower was
decided here rather than ported. It lives in `src/assets/css/responsive.css`,
loaded after the page sheets, which keeps the desktop rendering identical to
what was checked against the design and puts the whole adaptation in one
readable file.

Steps by screen width, each named for what actually breaks there: **1279px**
(just under the drawn width: Home's gutter eases in instead of jumping, and
rows that only just fitted get slack), **1180px** (the 1200px column stops
clearing its gutters), **1024px** (the horizontal nav runs out of room and
becomes a drawer), **860px** (side-by-side layouts stack), **620px** (phone:
one column, smaller type, thumb-sized controls) and **380px** (small phones,
where two tight single lines take a safer form). One guard holds at every
width: when the header bar is short of room its search field narrows (and
goes at 1200px); a nav label never breaks onto two lines.

Four pieces of Home answer to their own width instead of the screen's, with
container queries, because the screen does not say how much room they have:
the same column is 540px wide beside the copy on a laptop and 330px wide under
it on a phone.

- **The hero copy** drops "Trusted by" from the proof badge when its column
  can no longer hold the sentence on one line, and shows two guarantees
  instead of three when three would leave one alone on a second row.
- **The storefront illustration** has two drawings. Above 480px it is the one
  from the design. Below that it is the same composition made smaller: photo
  beside details, each plugin label hanging off the right edge next to the
  thing it does, the result card off the bottom left. A browser without
  container queries hides it where only the small drawing would fit.
- **A testimonial card** too narrow for its name row moves its "Verified
  customer" badge up opposite the stars, so the name and place never wrap.
- **A case-study card** too narrow for name and link side by side puts the
  link under the name.

On phones:

- the promo bar is a single line that keeps the offer and the countdown, and
  the whole bar is the link;
- plugin cards and blog posts become list rows (icon or thumbnail on the left),
  and a "View all 10 plugins" button follows the list;
- headings are balanced, so where they break does not depend on a few pixels
  of difference between one phone's font and another's;
- section paddings are half the desktop values throughout;
- in the drawer the close button stays pinned to the top, and with the plugin
  list open (several screens long) "Get All Access" is pinned to the foot
  while the list scrolls behind it;
- text links, footer rows and the header buttons have thumb-sized hit areas
  (on touch tablets too), and footer fields use 16px text so Safari does not
  zoom the page on focus.

On tablets a group of three cards that would leave one alone on its row gives
that card the full row, category cards go two-up until four fit with their
names on one line, and the footer puts its four link groups on one row with
the signup across the row beneath.

In running copy the hyphen that stands in for a dash is tied to the word
before it with a no-break space, so it can end a line but never start one,
where it would read as a list bullet.

**Home is the page this has been worked through in full.** The other nine are
responsive (no sideways scrolling, checked every 10px from 1300px down to
320px; drawer; stacking) but have not yet had the same pass; rules written for Home
are scoped to it so those pages were not changed by it.

## Images

Everything Home and the header show is served from `src/assets/img/`: the nine
plugin icons, the testimonial portraits, the blog thumbnails and the team
photograph. A plugin tile takes its icon from a class (`ptile--yaymail`), so
the address lives in one place. YayMail's icon is an animation; anyone whose
device asks for reduced motion gets its resting frame.

The other pages still load their icons, photography and card marks from
`ps.w.org`, `yaycommerce.com` and jsDelivr. They move over page by page.

## Checks

```bash
node tests/site.test.mjs            # behaviour and layout, in headless Chromium
node tests/visual.mjs snap before   # full-page captures of all ten pages
node tests/visual.mjs diff before after
```

Both need Playwright (`npm install` picks it up from `package.json`). They
drive the built `docs/` and never touch the network. `site.test.mjs` covers
every page for sideways scroll on either side of every breakpoint (and Home
every 10px), the header menus by mouse, keyboard and touch, the drawer, the
countdown, the coupon link, and the Home layout rules above, including a
sweep of Home every 5px from 621px to 1300px that looks for wrapped labels,
covered text and orphaned headings, run once more with scrollbars that take
up width as on Windows. `visual.mjs` is for changes to shared CSS: a page you did
not mean to touch should come back identical.

## Known limits

- **Sample data.** Prices, reviews, order numbers and licence keys are the
  design's placeholder content, carried over as-is. A few figures disagree
  between pages in the prototypes themselves and are reproduced as drawn until
  they are settled: the YayPricing rating, review count and starting price on
  Home, Shop and its own page, and the "Tested with" versions on Home and the
  product page.
- **Fonts.** The site uses the system UI font, so line breaks differ slightly
  between Apple, Windows and Android devices. Layout rules that depend on a
  line fitting leave room for that.
