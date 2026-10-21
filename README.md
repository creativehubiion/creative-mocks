# iion creative mocks

Brand-facing preview pages for iion's ad formats, one folder per format and one per brand,
served by GitHub Pages:

    https://creativehubiion.github.io/creative-mocks/<format>/<brand>/

| Format | Folder | Device |
|---|---|---|
| Interactive CTV (L-band playables in a 30 s TV break), or a CTV video ad with the break countdown | `ctv/` | TV (+ animated remote when interactive) |
| Hybrid playable (video on top + game below, 320×480) | `hybrid/` | phone, in-app interstitial |
| Playable (game only, 320×480) | `playable/` | phone, in-app interstitial |
| Rewarded video (landscape, reward countdown) | `rewarded/` | phone, landscape |
| Rewarded video + end card | `rewarded-endcard/` | phone, landscape |
| Away from the game video (the spot as the pre-roll in a publisher article's own video player) | `afg-video/` (+ `afg-video-mobile/`) | MacBook; mobile web on phones |
| Several mocks for one brand on one link | `showcase/` | the mocks' own pages, switched from the header |

The site root shows only the iion logo; brand pages are not linked from anywhere, and every page
carries `noindex`. Share each brand only its own URL. Links from the old `interactive-ctv-mocks`
site redirect here.

## Folder layout

    shared/                     one review shell for every page: header + format label, night mode,
                                TV frame + remote, CSS phone + tap ripples, scan-to-play QR
    <format>/_template/         start a new brand from here
    tools/                      build scripts (video formats, away from the game, showcase), local server, responsive check
    docs/PLAYBOOK.md            how every format, device and page rule works
    <format>/<brand>/index.html the page you send
    <format>/<brand>/mock.html  the ad unit itself
    <format>/<brand>/assets/    video, logos, sprites used by mock.html

## Adding a new brand

See [docs/PLAYBOOK.md](docs/PLAYBOOK.md) for the full rules and the one-command tools.


1. Copy the format's `_template/` (or an existing brand) to `<format>/<brand>/`. CTV video ads start from `ctv/_template-video/`;
   several mocks for one brand get a `showcase/<brand>/` page from `showcase/_template/` that links to them.
2. Replace `mock.html` / `assets/`, and set the page's eyebrow (`<Format> · <Brand>`) and H1.
3. Commit and push; Pages updates in a minute or two.
