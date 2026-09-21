#!/usr/bin/env node
/* ===========================================================================
   YayCommerce static site build

   Stamps the shared chrome (head, promo bar, header, footer) around each page
   body in src/pages and writes plain static HTML to docs/. No framework, no
   runtime — the output is ordinary files you can drop on any host.

   docs/ is the folder GitHub Pages is configured to serve, so a push to main
   publishes the site.

   A page declares its metadata in a leading comment:

     <!--@ { "title": "...", "css": ["home"], "nav": "plugins" } @-->

   Keys:
     title    <title> and og:title
     desc     meta description
     css      extra stylesheets from assets/css (base/components/layout come
              before it, responsive.css after it)
     js       extra scripts from assets/js (site.js is always included)
     nav      which top-level nav item to mark active
     header   true/omitted for the full site header, "none", or the name of
              a header partial (e.g. "checkout" → partials/header-checkout.html)
     footer   true (default), false, or the name of a footer partial
              (e.g. "checkout" loads partials/footer-checkout.html)
     search   show the header search field (home + product only)
     bodyClass extra class on <body>

   Usage: node build.mjs
   ======================================================================== */

import { readFile, writeFile, readdir, mkdir, cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(root, "src");
const OUT = path.join(root, "docs");

const NAV_KEYS = ["plugins", "all-access", "docs", "blog", "support"];

/* ------------------------------------------------------------------------ */

async function partial(name) {
  return readFile(path.join(SRC, "partials", `${name}.html`), "utf8");
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  );
}

function parseFrontMatter(source) {
  const match = source.match(/^<!--@([\s\S]*?)@-->\s*/);
  if (!match) return [{}, source];

  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Invalid front matter JSON: ${error.message}`);
  }
  return [meta, source.slice(match[0].length)];
}

/* ------------------------------------------------------------------------ */

async function build() {
  const shell = await partial("page");
  const headerFull = await partial("header");
  const headers = {
    checkout: await partial("header-checkout"),
    minimal: await partial("header-minimal"),
  };
  const footers = {
    default: await partial("footer"),
    checkout: await partial("footer-checkout"),
  };
  const search = await partial("header-search");

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await cp(path.join(SRC, "assets"), path.join(OUT, "assets"), { recursive: true });

  const files = (await readdir(path.join(SRC, "pages"))).filter((f) => f.endsWith(".html"));

  for (const file of files) {
    const source = await readFile(path.join(SRC, "pages", file), "utf8");
    const [meta, content] = parseFrontMatter(source);

    const navVars = Object.fromEntries(
      NAV_KEYS.map((key) => [
        "nav" + key.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase()),
        meta.nav === key ? " is-active" : "",
      ])
    );

    let header = "";
    if (headers[meta.header]) header = headers[meta.header];
    else if (meta.header !== "none") header = fill(headerFull, { ...navVars, search: meta.search ? search : "" });

    // responsive.css is last so its media queries can override any page sheet
    // at equal specificity.
    const styles = ["base", "components", "layout", ...(meta.css || []), "responsive"]
      .map((name) => `<link rel="stylesheet" href="assets/css/${name}.css">`)
      .join("\n");

    const scripts = ["site", ...(meta.js || [])]
      .map((name) => `<script src="assets/js/${name}.js"></script>`)
      .join("\n");

    const html = fill(shell, {
      title: meta.title || "YayCommerce",
      desc: meta.desc || "",
      bodyClass: meta.bodyClass || "",
      styles,
      scripts,
      header,
      content: content.trim(),
      footer: meta.footer === false ? "" : footers[meta.footer || "default"],
    });

    await writeFile(path.join(OUT, file), html);
    console.log(`built  docs/${file}`);
  }

  // Tells GitHub Pages to serve the files as-is instead of running Jekyll.
  await writeFile(path.join(OUT, ".nojekyll"), "");

  if (!existsSync(path.join(OUT, "index.html"))) {
    throw new Error("No index.html was produced — check src/pages.");
  }
}

build().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
