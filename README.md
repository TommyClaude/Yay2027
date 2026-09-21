# YayCommerce website

Marketing and account site for the YayCommerce WooCommerce plugin suite —
ten pages, built as plain static HTML, CSS and JavaScript.

**Live:** https://tommyclaude.github.io/Yay2027/

| | |
|---|---|
| [Home](https://tommyclaude.github.io/Yay2027/) | Hero, catalogue, All Access, case studies, testimonials, blog |
| [Shop](https://tommyclaude.github.io/Yay2027/shop.html) | All 10 plugins with search, category tabs and sort |
| [YayPricing](https://tommyclaude.github.io/Yay2027/yaypricing.html) | Product page: gallery, buy box, reviews, changelog, FAQ |
| [All Access](https://tommyclaude.github.io/Yay2027/all-access.html) | Bundle: contents, annual vs lifetime, comparison |
| [Checkout](https://tommyclaude.github.io/Yay2027/checkout.html) | Order bump, coupons, card / PayPal |
| [Thank you](https://tommyclaude.github.io/Yay2027/thank-you.html) | Order, licence key, setup steps |
| [My account](https://tommyclaude.github.io/Yay2027/account.html) | Dashboard, purchases, downloads, licences, profile |
| [Docs](https://tommyclaude.github.io/Yay2027/docs.html) · [Support](https://tommyclaude.github.io/Yay2027/support.html) · [Contact](https://tommyclaude.github.io/Yay2027/contact.html) | |

## Working on it

```bash
node build.mjs      # rebuild docs/ from src/ — Node 18+, no dependencies
```

Edit `src/`, never `docs/` — the latter is generated, and GitHub Pages serves it
straight from `main`, so pushing a rebuild publishes the site.

```
src/pages/        one file per page: front matter + the <main> content
src/partials/     shared chrome — head, promo bar, header, footer
src/assets/       css, js, images
build.mjs         stamps the chrome around each page
docs/             generated output (published)
```

To preview locally, serve the folder rather than opening the files directly:

```bash
npx http-server docs -p 8080
```

## Notes

`IMPLEMENTATION.md` covers what was built and why: the design decisions carried
over from the design session, where this departs from the prototypes, and the
known limits (desktop-only widths, remote image hosts, placeholder sample data).
