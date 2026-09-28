# Landing page

A static coming-soon page for Beekeeper in plain HTML, CSS, and JavaScript. It's separate from the app and isn't part of the Electron build.

The scripts are ES modules, which browsers won't load from `file://`, so serve the folder over HTTP to preview it:

```bash
python3 -m http.server 8000 -d landing_page
```

Then open http://localhost:8000.
