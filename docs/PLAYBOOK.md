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

**Rewarded is vertical only (2026-11-12):** one vertical video, and the end card is the same 2:3 image as the display interstitial (or the playable). The
landscape templates stay for older mocks; `new-video-mocks.py --landscape` still builds them.

| Format | Folder | Template | Device | What plays |
|---|---|---|---|---|
| Interactive CTV | `ctv/` | an existing interactive brand | TV + animated remote | an L-band playable in a TV ad break, driven by the remote |
| CTV video | `ctv/` | `ctv/_template-video/` | TV | programme → the ad with "Your game will continue in N seconds" → programme |
| Hybrid playable | `hybrid/` | `hybrid/_template/` | portrait phone | 320×480 in-app interstitial: video on top, game below |
| Playable | `playable/` | `playable/_template/` | portrait phone | 320×480 in-app interstitial: game only, end card with CTA |
| Display interstitial | `display-interstitial/` | `display-interstitial/_template/` | portrait phone | the playable's phone and 2:3 slot with a static image (640×960) instead of the game; a tap opens the click URL |
| Rewarded video | `rewarded/` | `rewarded/_template-portrait/` (landscape: `_template/`) | portrait phone | a portrait game pre-roll → the brand's vertical video (9:16) with the reward countdown → back to the game |
| Rewarded video + end card | `rewarded-endcard/` | `rewarded-endcard/_template-portrait/` (landscape: `_template/`) | portrait phone | as above, then the 2:3 display image as a clickable end card with a close button |
| Rewarded video + playable end card | `rewarded-playable/` | `rewarded-playable/_template/` | portrait phone | a portrait game pre-roll full screen → the brand's vertical video (9:16, full width) with the reward countdown → the brand's playable, live, as the end card in the 2:3 slot with black bars and a close button |
| Away from the game video | `afg-video/` (+ `afg-video-mobile/`) | `afg-video/_template/`, `afg-video-mobile/_template/` | MacBook (mobile web on a phone) | a publisher's article; the spot plays as the pre-roll in the site's own video player |
| In-game display | `ingame-display/` | `ingame-display/_template/` | portrait or landscape phone (the scene's shape) | a mobile game screenshot with the brand's image on its billboards (§13) |
| In-game video | `ingame-video/` | `ingame-video/_template/` | portrait or landscape phone | gameplay video (or a screenshot) with the brand's video playing on the billboard (§13) |
| Roblox billboard | `roblox-billboard/` | `roblox-billboard/_template/` | MacBook | a Roblox world with the brand's image on an in-experience billboard, Roblox's Ad icon on top (§13) |
| Roblox video | `roblox-video/` | `roblox-video/_template/` | MacBook | a Roblox video screen (static or animated world) playing the brand's video, with Roblox's mute, expand and Ad icons (§13) |
| Roblox rewarded video | `roblox-rewarded/` | `roblox-rewarded/_template/` | Landscape phone | a Roblox game, Roblox's rewarded ad sheet slides up, the brand's wide video with the reward countdown, then the Learn More end screen (§13) |
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
- Rewarded video + playable end card behaves like a playable on phones too (full screen, QR on desktop), with "Turn sound on" under the
  phone; the video shows whole: anything that is not 9:16 gets black bars (never cropped). Its end card is a copy of the playable's own files.
- Display interstitials behave exactly like playables (same phone, 2:3 slot, full screen on a phone, QR on desktop); the QR card reads
  "Scan to see it on your phone" (`.phone[data-qr]`).
- CTV and rewarded pages keep the page, with "Turn sound on" and "Full screen" (`shared/fullscreen.js`).
- Away from the game video: see §7.

**Cache busting:** shared files are referenced with `?v=N`; bump N whenever a shared file changes, because GitHub Pages caches for 10
minutes. To refresh a mock on phones after an update, share its link with a new `?v=` (e.g. `…/showcase/<name>/?v=3`). It is passed to
the mock page, on to the unit, and from the unit to its video files and snapshots (`bust()` in each mock.html; keep it in new formats).

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
  Away from the game video · Hybrid · Playable · Display interstitial.
- The picker sits in the mock page's own header; the brand takes the format-label slot; only the chosen mock is loaded. On desktop and
  laptop the header always shows one pill that opens a menu (no row of tabs), and so do phones (no tab bar).
  `#<id>` deep-links a mock.
- **Every mock keeps its own folder and URL, even on a showcase.** The `MOCKS` list stays one object per line with single-quoted
  strings and at least `label` and `url`. Labels are written for people ("Option 1", "Rewarded video"): a weekly summary bot reads new
  folders and these labels.

## 9. Video and display formats in one command

```
python tools/new-video-mocks.py --brand VOXI --headline "Unlimited social media." \
    --ctv-ad tv-spot.mp4 --ctv-headline "The fun never ends." \
    --rewarded-ad mobile-spot.mp4 --rewarded-preroll asphalt-legends \
    --endcard banner.jpg --endcard-preroll geometry-dash \n    --rp-ad spot.mp4 --rp-playable playable/<name> \n    --display interstitial-640x960.png --display-headline "Value menu." --click-url https://example.com/ \n    --roblox-ad wide-spot.mp4
```
Builds only the formats you give inputs for, plus a showcase for 2+. Pre-roll game clips are in `tools/video-library/preroll/` (landscape) and `tools/video-library/preroll-portrait/` (portrait).

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
`0.0.0.0` it is reachable from phones on the same network. Iterate locally and push when the mock is approved. Section 14 comes before every push (and for a playable or
hybrid, section 12 before that).

## 12. Playables and hybrids load from Cloudflare

GitHub keeps the review page, the link and a full copy of the game. Viewers load the game from Cloudflare R2, under
`mocks/<format>/<name>/`, the same path as the repo. Both must always hold the same game. Claude Code sessions get these steps
automatically from `.claude/rules/cloudflare-upload.md`.

**Since 2026-11-13 new playables and hybrids don't use this bucket:** they load their own `mock.html`, and the whole folder goes to
creative-mocks.iion.media (section 14, `docs/HOSTING.md`). This section is for the older ones whose `index.html` still points here.

**Updating one:** change the files, run the same upload command (it sends only what changed, `mock.html` last), then push. Cloudflare
can keep the old files for up to 10 minutes, and a new `?v=` on the link doesn't skip that for code files.

**Credentials:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, in `~/cloudflare-creative-mocks.env` or the environment. Never in this repo.

**Good to know:**
- Only write under `mocks/`. The rest of the bucket isn't ours to change.
- Cloudflare has no folder index, so always link the exact file (`.../mock.html`).
- Testing local changes once a page points at Cloudflare: open `mock.html` directly, because the review page shows the uploaded copy.
- Existing mocks that still load their own `mock.html` stay on GitHub until someone decides to switch them.
- Other formats stay on GitHub: their sound buttons call into the game, which needs the page and the game on the same domain.
- GitHub is a manual backup. If Cloudflare goes down, point `src` and `data-full` back to `mock.html` and push.

## 13. In-game and Roblox ads (from the screenshot generator)

Two categories, each with a static and a video format. The scenes come from the team's ad-banner-screenshot-generator
(`data/games*.json`, `public/screenshots`, `public/gameplay-videos`) and live in `tools/ingame-library/` (`scenes.json` + one
background per scene). Re-import with `python tools/build-ingame-library.py <clone of the generator>` when it gets new games.

| Category | Format | Scenes | Device |
|---|---|---|---|
| In-game | In-game display | 59 mobile game screenshots (32 games), 1 or 2 billboards each | portrait or landscape phone, from the scene's shape |
| In-game | In-game video | 2 gameplay videos (Stealth Master, SimCity), plus any screenshot as a fallback | portrait or landscape phone |
| Roblox | Roblox billboard | 2 billboard types (static) | MacBook |
| Roblox | Roblox video | a static scene and an animated scene (background video) | MacBook |

**One command.** Give it the creative; it ranks every scene of that format and builds on the one with the fewest black bars:
```
python tools/new-ingame-mock.py --format ingame-display --brand "Brand" --creative banner.png
python tools/new-ingame-mock.py --format roblox-video --brand "Brand" --creative spot.mp4
```
`--list` only prints the ranking; `--scene <id>` or `--game "Dragon City"` picks another scene; `--suffix` and `--headline` as elsewhere.
Roblox billboard is the exception: it always uses `roblox-billboard-2` (the player seated on a stool, three-quarter view) unless `--scene roblox-billboard-1` asks for the wide shot.

**How a scene is drawn** (`shared/ingame.js`, `shared/ingame.css`): background (image, or video) → the creative on every billboard,
letterboxed on black (never cropped or stretched) and warped onto the billboard's four corners with an exact perspective transform
(CSS `matrix3d`) → masks (things standing in front of a billboard, redrawn from the background) → overlay (Roblox's UI). The scene fills
the device when it is nearly the same shape, otherwise it sits inside it on black. A video creative keeps its sound behind the page's
"Turn sound on" button.

**Gameplay video loops (2026-11-12).** On a gameplay-video scene (SimCity and Stealth Master 10 s, Roblox animated 7.4 s) the video
creative is cut to the gameplay's loop (`--trim-start` picks which part), and the page uses the gameplay as the clock: both start on
the same frame and go back to the start together, so the game never jumps back while the ad plays on. An ad shorter than the loop
repeats inside it. A screenshot scene (or the static Roblox video scene) keeps the full-length ad.

**Picking the scene.** The share of a billboard left black is `1 − min(creative ratio / billboard ratio, billboard ratio / creative ratio)`,
averaged over the scene's billboards. Lowest wins; a scene that doesn't fit the device adds a little; for in-game video a real gameplay
video wins a near tie. Billboard shapes run from tall (0.49) to long strips (6.8), so most creatives find a slot under 10%.

**Roblox rewarded video (2026-11-13).** Rebuilt from a screen recording of the real unit in a Roblox game on an iPhone held sideways
(2622×1206). `roblox-rewarded/_template/`: the game from the recording is the pre-roll (`assets/preroll.mp4`, 3.5 s, with the
"Unlock Premium?" dialog and "Looking for Ads"); our own ad sheet slides up over its last 0.22 s (eased out, as in the recording), so the game
keeps moving behind it and no black frame shows; the brand's wide video plays in the unit's 16:9 slot (letterboxed, never cropped) with
Roblox's controls redrawn as SVG on the recording's own pixel grid ("?", ✕, speaker, "Reward in N seconds" from the video's length,
Learn More, progress bar; each within 1 px of the recording); then the Learn More end screen (last frame under 77% black, centred
button, ✕) for 2.6 s, and it loops. One command: `new-video-mocks.py --roblox-ad <wide video> --click-url <site>`. On localhost,
`mock.html?ref=ad` or `?ref=end` lays the recording's frame over ours (difference blend) for pixel checks.

## 14. Where mocks live: creative-mocks.iion.media

Every mock's home is `https://creative-mocks.iion.media/<format>/<name>/index.html`: Cloudflare R2, bucket `creative-mocks`, the same
folders as this repo (`playable/`, `hybrid/`, `ctv/`, `rewarded/`, `roblox-billboard/`, `showcase/` …). That is the link we send.
GitHub keeps a full copy as the fallback, and each github.io page carries one redirect line to the same page on the new domain.

The full walk-through for a playable, from game file to link, is [docs/HOSTING.md](HOSTING.md).

**Adding or updating a mock by hand (this repo):**
1. Build it in its folder and check it on localhost (section 11).
2. An older playable or hybrid that loads its game from campaign-creatives: the game upload in section 12 first.
3. `python tools/port-to-r2.py <format>/<name> --redirect` copies the folder's tracked files to the bucket and adds the redirect line
   to the github.io page. Commit first if the folder is new: the tool copies what git tracks (`--local` sends files from disk).
4. Commit and push (the redirect line included).
5. Open `https://creative-mocks.iion.media/<format>/<name>/index.html` and send that link. The bucket has no folder index, so links
   always end in `index.html`.

**Keys (once per machine):** a private file `~/cloudflare-creative-mocks.env` (outside the repo, never committed, never pasted in chat or
Slack), one per line: `R2_ENDPOINT=…`, `R2_BUCKET=creative-mocks`, `R2_ACCESS_KEY_ID=…`, `R2_SECRET_ACCESS_KEY=…`, plus the
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` lines section 12 uses. The values are in the team's password manager ("Creative
Mocks"); the blank file is `tools/cloudflare-creative-mocks.env.example`.

**Most mocks don't need this repo at all:** the Mock Builder (mock-builder-jet.vercel.app) makes the standard formats from files or a
game link and publishes them straight to creative-mocks.iion.media. Use this repo for bespoke builds.
