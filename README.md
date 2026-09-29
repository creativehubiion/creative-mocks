# iion interactive CTV mocks

One folder per brand, each a self-contained page served by GitHub Pages:

    https://creativehubiion.github.io/interactive-ctv-mocks/<brand>/

The site root shows only the iion logo; brand pages are not linked from anywhere,
and every page carries `noindex`. Share each brand only its own URL.

## Folder layout

    shared/iion-logo.png        white-label logo used by every page
    <brand>/index.html          the page you send: iion header, TV device frame, sound toggle
    <brand>/mock.html           the playable itself; ?embed=1 renders just the screen
    <brand>/assets/...          spot video, logos, sprites used by mock.html

## Adding a new brand

1. Build the playable as a standalone page (same pattern as `burger-king/mock.html`:
   a `.tv > .screen` structure, the embed-mode snippet in `<head>`, and
   `window.DEMO = { setSound(on) }`).
2. Copy an existing brand folder, replace `mock.html` and `assets/`, and edit the
   title and one-line description in `index.html`.
3. Commit and push; Pages updates in a minute or two.

Source of the mocks and their build history: `creativehubiion/Interactive-CTV` → `showcase/`.
