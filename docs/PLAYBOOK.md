# Creative mocks playbook

How the mocks in this repo are built, so every new one looks and behaves like the rest. The tools are in `tools/`, the shared
page shell is in `shared/`, and each format has a `_template/` to start from.

## 1. What this repo is

- Brand-facing preview pages for iion's ad formats, served by GitHub Pages:
  `https://creativehubiion.github.io/creative-mocks/<format>/<name>/`.
- One folder per format, one per mock inside it. Names are `<brand-slug>-<4-char suffix>` (e.g. `voxi-f3rq`). The suffix keeps
  URLs unguessable and groups one brand's mocks across formats.
- The site root shows only the iion logo. Mock pages aren't linked from anywhere and carry `noindex`. Send each brand only its own link.
- These are sales mocks: plain HTML/CSS/JS plus video, with no ad server and no SDK.

## 2. Formats

| Format | Folder | Template | Device | What plays |
|---|---|---|---|---|
| Interactive CTV | `ctv/` | an existing interactive brand | TV + animated remote | an L-band playable in a TV ad break, driven by the remote |
| CTV video | `ctv/` | `ctv/_template-video/` | TV | programme → the ad with "Your game will continue in N seconds" → programme |
| Hybrid playable | `hybrid/` | `hybrid/_template/` | portrait phone | 320×480 in-app interstitial: video on top, game below |
| Playable | `playable/` | `playable/_template/` | portrait phone | 320×480 in-app interstitial: game only, end card with CTA |
| Rewarded video | `rewarded/` | `rewarded/_template/` | landscape phone | game pre-roll → the ad with the reward countdown |
| Rewarded video + end card | `rewarded-endcard/` | `rewarded-endcard/_template/` | landscape phone | as above, then a clickable end card |
| Away from the game video | `afg-video/` (+ `afg-video-mobile/`) | `afg-video/_template/`, `afg-video-mobile/_template/` | MacBook (mobile web on a phone) | a publisher's article; the spot plays as the pre-roll in the site's own video player |
| Several mocks, one link | `showcase/` | `showcase/_template/` | the mocks' own pages | one page with a tab (or menu) per mock |

Never call a hybrid a "playable" or the other way round: a hybrid is video + game, a playable is game only.

## 3. The review page (theme)

Every page is the same shell (`shared/page.css` + `shared/theme.js`):

- A slim header: the iion logo, then the **format label**; the mock name in the centre (the brand in orange, then the title); a night-mode
  toggle on the right. `theme.js` builds it from the page's `.hero`: the eyebrow `<Format> · <Brand>` and the `<h1>` title. The
  description `<p>` is not shown.
- The page is exactly one screen tall at any size, from 1920×1080 to a phone, with no scrolling. The device fills the space at its
  exact ratio (container units). Check new pages with `tools/resp-test.html?p=/<format>/<name>/`, which tests 8 sizes.
- Minimal: no footer, no disclaimers, no control UI beyond a **sound button** (and **Full screen** on phones where the format has it)
  and the night toggle. Night mode is remembered per viewer.
- Use the brand's real assets: logo, spot, product shots. Never fake the hero product.

## 4. Devices

| Device | File | Notes |
|---|---|---|
| TV | `shared/page.css` + `shared/tv-frame.png` | photographic frame; screen opening at left 5.856% / top 4.762% / width 88.939% / height 80.529%. The 16:9 picture is cover-cropped ~0.6% top and bottom, so keep content off the very top and bottom edge. |
| Remote | `shared/remote.js` | lights ◀ ▶ OK on `postMessage({iionKey:'left'|'right'|'ok'})` from the mock. Hidden below 900 px wide (phones): there is no room beside the TV. |
| Portrait phone | `shared/phone.css` | iPhone-class, drawn in CSS: Dynamic Island (with a faint rim and lens so it reads on black), status bar (9:41, signal, Wi-Fi, battery), home bar, side buttons. |
| Landscape phone | `shared/phone-land.css` | the same phone turned sideways, filling the stage width like the TV. |
| MacBook | `shared/laptop.css` | current MacBook Pro, flat front view: slim bezels, rounded display, camera, the lid sitting on a thin flat base whose front edge hides the lid's bottom edge. Silver in light mode, Space Black in night mode. |

## 5. How a mock behaves

- `index.html` is the page you send; `mock.html` is the ad unit inside the device's iframe. `mock.html?embed=1` renders only the screen.
- Contract between them: `window.DEMO = { start, slotMs, setAuto, setSound }`. TV mocks post `{iionKey}` for the remote; phone units post
  `{iionTap:{x,y}}` for the tap ripple (`shared/touch.js`).
- Video elements are created muted (property and attribute), `playsinline`, `autoplay`, so they play on their own in an iframe.
- Sizes inside the unit are in container units (`cqw`/`cqh`), so it scales to any device size.
- Interactive units play themselves (an autopilot or bot), and a viewer's input takes over.

**On phones:**
- Playables and hybrids (`shared/mobile.js`) skip the mock page and open the unit full screen, as it serves in-app. `?desktop` keeps
  the mock page. On desktop, a "Scan to play on your phone" QR sits beside the phone (playable formats only).
- CTV and rewarded pages keep the page, with "Turn sound on" and "Full screen" (`shared/fullscreen.js`).
- Away from the game video: see §7.

**Cache busting:** shared files are referenced with `?v=N`; bump N whenever a shared file changes, because GitHub Pages caches for 10
minutes. To refresh a mock on phones after an update, share its link with a new `?v=` (e.g. `…/showcase/<name>/?v=3`). It is passed to
the mock page and on to the unit.

## 6. Interactive CTV

- L-band layout: the spot squeezes to the top right (≈74%), the game column runs full height on the left, and a banner band runs along
  the bottom. Design the L like a banner, seamless with the brand: no pasted cards, no seams, no rounded corners on the squeezed video.
- The classic slot is 30 s: the spot plays full frame for 0–3 s, then squeezes, the game runs, and the video returns full frame for
  the last 3 s. Builds can follow their spot's own length.
- Builds from the AI creative generation pipeline: the build's `index.html` becomes `mock.html` (with `_core/`, `assets/`), and the
  page loads it with `?embed=1&attract` (it plays itself). If the core doesn't yet post `iionKey` or offer `DEMO.setSound`, add both.
  Name the folder `<slug>-interactive-<sfx>` when the brand also has a CTV video ad.

## 7. Away from the game video

The brand's spot, served the way video really is on publisher sites: as the **pre-roll in the site's own in-article video player**.
It is never a static banner in a leaderboard.

- **Find the video slot.** On Future plc sites (What to Watch, PC Gamer, TechRadar, Tom's Guide) it is the JW Player "Latest Videos"
  player in article bodies (16:9; a Google Ad Manager pre-roll). Section pages such as `/movies` have banner slots only.
- **Never iframe the live site** (it forbids framing, and it would bring live ads and consent banners). The tool snapshots it:
  ```
  python tools/new-afg-video-mock.py --device both --brand "<Brand>" --headline "<Title>." \
      --url <article or section page> --ad <spot.mp4> --suffix <brand's suffix>
  ```
  It opens the page in headless Chrome (desktop 1440×900, mobile 390×844, 2x), blocks ad and consent hosts, hides every other ad slot,
  follows a section page's articles until one has a player, paints the player's own poster in, and saves the snapshot plus the player's
  box. The spot is shown full frame with black bars where it doesn't fit, with an IMA-style "Ad · 0:42" label and yellow progress bar.
- **One mock, two devices.** `afg-video/<name>/` is the link to send and the only showcase tab. On a computer it shows the MacBook. On a
  phone it sends the viewer to the mobile web version (`afg-video-mobile/<name>/`): full screen when opened directly, the phone mock
  inside a showcase. Never list the mobile version as a second mock.
- **Mobile web looks like iPhone Safari.** The status bar takes the colour of what is under it: the site's top colour at the top of the
  page, a header the site pins to the top while scrolling (the tool detects these and keeps them pinned), or the page itself scrolling
  under it with dark clock and icons on a light page. Safari's address bar sits at the bottom. There is no black strip of our own: only
  the Dynamic Island.

## 8. Showcase (one link for a brand)

```
python tools/new-showcase.py --brand "<Brand>" --suffix <sfx>
```
- Collects every mock with that suffix, whatever made it, in this order: Interactive CTV · CTV video · Rewarded · Rewarded + end card ·
  Away from the game video · Hybrid · Playable.
- Tabs sit in the mock page's own header; the brand takes the format-label slot; only the chosen mock is loaded. With 4+ mocks (or
  when tabs don't fit) the header shows one pill that opens a menu. `#<id>` deep-links a tab.
- **Every mock keeps its own folder and URL, even on a showcase.** The `MOCKS` list stays one object per line with single-quoted
  strings and at least `label` and `url`. Labels are written for people ("Option 1", "Rewarded video"): a weekly summary bot reads new
  folders and these labels.

## 9. Video formats in one command

```
python tools/new-video-mocks.py --brand VOXI --headline "Unlimited social media." \
    --ctv-ad tv-spot.mp4 --ctv-headline "The fun never ends." \
    --rewarded-ad mobile-spot.mp4 --rewarded-preroll asphalt-legends \
    --endcard banner.jpg --endcard-preroll geometry-dash --click-url https://example.com/
```
Builds only the formats you give inputs for, plus a showcase for 2+. Pre-roll game clips are in `tools/video-library/preroll/`.

## 10. Assets and weight

- **Spots:** 1280 wide, H.264 CRF 21, `+faststart` (the index at the start of the file, so playback starts before the download ends;
  without it the first load is slow), AAC 96k. Keep a delivered spot as-is when it is already H.264 ≤1280 and smaller than a re-encode.
- **Playables:** keep what the unit actually loads under 5 MB. Convert painted PNG art to WebP at the same pixel size (quality 86,
  alpha 95); don't load assets that aren't drawn; nothing bigger than ~2× its on-screen size in a 640-wide unit.

## 11. Working locally

```
python tools/rangeserver.py "<repo folder>" 8767 0.0.0.0
```
A static server with byte ranges (plain `http.server` breaks video seeking). Open `http://127.0.0.1:8767/<format>/<name>/`; with
`0.0.0.0` it is reachable from phones on the same network. Iterate locally and push when the mock is approved.
