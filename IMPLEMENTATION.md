# YayCommerce — implementation notes

The YayCommerce design prototypes are built out as a plain static site.

```
src/            source
  pages/        one file per page: front matter + <main> content
  partials/     shared chrome (head, promo bar, header, footer)
  assets/       css, js, images — copied to the output as-is
build.mjs       stamps the chrome around each page
docs/           the built site — plain HTML/CSS/JS, served by GitHub Pages
```

Build with `node build.mjs` (Node 18+, no dependencies, no install step).

---

## What was decided

The prototypes carry a Tweaks panel with several themes, three design styles and
a light/dark footer. Version 3.2 — the configuration the design session finished
on — is baked in, and the alternatives are gone:

| Setting | Value |
|---|---|
| Accent | `yellow-blue` — brand yellow `#ffc421` for actions, WordPress blue `#3858e9` for links, focus and selection |
| Design style | `elevated` — white cards, 10px radii, soft drop shadows |
| Footer | light |
| Header | logged in, promo bar on, plugin-grouped mega menu |
| Catalogue | 6 featured plugins → a 3-across grid |

Dropping the variants is what turns the prototype's attribute-selector overrides
(`[style*="border: 1px solid rgb(221, 221, 221)"]`…) into ordinary classes. The
elevated/yellow values were resolved by hand and written straight into the
tokens in `src/assets/css/base.css`, so nothing is computed at runtime.

## Pages

| Page | File | Notes |
|---|---|---|
| Home | `index.html` | Hero storefront mock, catalogue, All Access band, case studies, bento, testimonials, blog |
| Shop | `shop.html` | Client-side search, category tabs and sort over the 10 cards in the HTML |
| Product | `yaypricing.html` | Gallery, buy box, sticky purchase bar, tabs, paginated reviews, review modal |
| All Access | `all-access.html` | Bundle contents, annual vs lifetime, comparison table, FAQ |
| Checkout | `checkout.html` | Three numbered cards, order bump, coupons, PayPal / card |
| Thank you | `thank-you.html` | Order, licence key, three setup steps |
| My account | `account.html` | Dashboard · Purchases (+ order detail) · Downloads · Licenses · Profile |
| Docs | `docs.html` | Search across plugins with hidden keywords behind the popular chips |
| Support | `support.html` | Email / live chat / Messenger |
| Contact | `contact.html` | Ideas and partnerships only — product help routes to Support |

Every page is reachable from every other, and the funnel clicks through end to
end: Home → Shop → Product → Checkout → Thank you.

## Behaviour

`site.js` loads everywhere (mega menu, account menu, sale countdown, FAQ
accordion); each page adds at most one more file. Interactive state is rendered
server-side first and adjusted by script, so the catalogue, reviews and docs are
complete with JavaScript off.

Details carried over from the design conversation, since they are decisions
rather than styling:

- **One subscription per order.** EDD Recurring can't take two subscriptions in
  one checkout, so the cart holds a single line and the All Access bump *swaps*
  it rather than adding to it.
- **Coupons stay behind a link.** An open, empty coupon field sends people off
  to hunt for codes. `?coupon=SUNNY30` auto-applies, so a campaign link keeps
  the promise it made.
- **The payment tab's border never changes width** — the heavier ring is an
  inset shadow, so switching methods doesn't nudge the layout — and the selected
  tab carries a tick, not just a colour.
- **No refund reminder on the thank-you page.** The guarantee's job is before
  the purchase; afterwards it only makes the exit prominent.
- **The email address on Contact is assembled in script**, not sitting in the
  markup for harvesters.
- **The auto-renewal line next to the pay button stays.** It is a disclosure
  requirement, which is why it is quiet rather than absent.

## Deliberate differences from the prototypes

1. **Static cards don't react to hover.** The prototype's catch-all selectors
   gave a hover shadow to any bordered box, including ones that aren't
   clickable; the design conversation repeatedly asked for the opposite. Only
   links lift here.
2. **The header shadow is on every page.** The prototype had it everywhere
   except Home, which was an oversight in a shared component.
3. **Semantics and labels.** Tier and tab controls are real `<button>`s, forms
   have labels, menus carry `aria-*` and can be reached by keyboard. The
   prototypes used click handlers on divs.
4. **Light DOM cleanup.** `<dl>` for spec and totals lists, `<table>` for the
   purchases table, headings in order.
5. **Two corner radii are held consistent** where the prototypes contradict
   themselves. The account chip is a 2px hover target on Home, the product page,
   All Access and My account, but 4px on Shop, Docs, Support and Contact; this
   build uses 2px everywhere the chip opens a menu, and 4px on the checkout and
   thank-you headers where it is a plain link. The Profile panel on My account
   is a design-system card at 4px while every other panel on that page is a
   hand-styled 10px card; all panels are 10px here.

## Known limits

- **The responsive layer is new design work.** The prototypes were only drawn
  at 1280px and up, so everything narrower was decided here rather than
  ported. It lives in `src/assets/css/responsive.css`, loaded after the page
  sheets, which keeps the desktop rendering identical to what was checked
  against the artifact and puts the whole adaptation in one readable file.
  Four steps, each named for what actually breaks at that width: **1180px**
  (the 1200px column stops clearing its gutters, the header search goes),
  **1024px** (the horizontal nav runs out of room and becomes a drawer),
  **860px** (side-by-side layouts stack), **620px** (phone: one column,
  smaller type). Verified for horizontal overflow at eighteen widths from
  1440px down to 320px.
- **Images are still remote.** Plugin icons come from `ps.w.org`, photography
  and screenshots from `yaycommerce.com`, card marks from jsDelivr. This
  session's network policy blocks those hosts, so they couldn't be pulled local.
  To self-host, download them into `src/assets/img/` and rewrite the `url(...)`
  and `src` values — they are the only absolute URLs in the source. The one
  local photograph, the support-team shot on Home, was extracted from the
  design's image-slot state to `src/assets/img/why-team.webp`.
- **Sample data.** Prices, reviews, order numbers and licence keys are the
  design's placeholder content, carried over as-is.
