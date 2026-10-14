# Site

A static site for beekeeper in plain HTML, CSS, and JavaScript, published with GitHub Pages from this `docs/` folder. It's separate from the app and isn't part of the Electron build.

- `bees/` is a small game of catching bees. It's a page of its own, with its own styles, so its body rules and tokens don't touch anything else on the site.

The scripts are ES modules, which browsers won't load from `file://`, so serve the folder over HTTP to preview it:

```bash
python3 -m http.server 8000 -d docs
```

Then open http://localhost:8000/bees/.

Every page sets a Content-Security-Policy in a `<meta>` tag that allows only files from the site itself, so a stray third-party request fails loudly instead of slipping in.
