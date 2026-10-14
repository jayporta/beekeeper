# Site

A static site for beekeeper in plain HTML, CSS, and JavaScript, published with GitHub Pages from this `docs/` folder. It's separate from the app and isn't part of the Electron build.

- `index.html` is the landing page. `tokens.css` holds the design tokens, copied from the app's `src/renderer/src/assets/tokens.css`. `styles.css` holds the base styles and buttons, `frame.css` the header, hero, and footer, and `sections.css` the screenshots, promises, and downloads. `download.js` picks which download the hero button names: it sets `data-platform` on the root element from `detectPlatform.js`, and without JavaScript the hero shows every download.
- `bees/` is a small game of catching bees, linked from the landing page's footer. It's a page of its own, with its own styles, so its body rules and tokens don't touch the landing page.
- `fonts/` holds the self-hosted Figtree files from `@fontsource/figtree` and its license (`OFL.txt`).
- `img/` holds the screenshots. Replace a file in place and keep its name and size: the `<img>` tags in `index.html` set `width` and `height` from the file, so the page doesn't shift while it loads.

Every page sets a Content-Security-Policy in a `<meta>` tag that allows only files from the site itself, so a stray third-party request fails loudly instead of slipping in. Don't load anything from another origin.

The scripts are ES modules, which browsers won't load from `file://`, so serve the folder over HTTP to preview it:

```bash
python3 -m http.server 8000 -d docs
```

Then open http://localhost:8000, or http://localhost:8000/bees/ for the game.
