# Every mock lives on creative-mocks.iion.media

The link we send is always `https://creative-mocks.iion.media/<format>/<name>/index.html`: Cloudflare R2, bucket `creative-mocks`, the
same folders as this repo. GitHub keeps a full copy as the fallback, and its github.io pages redirect there. The step-by-step guide for
people is `docs/HOSTING.md`; follow it exactly.

Pushing still needs the user's word. Once they say push, for every mock folder you added or changed:

1. **Commit the folder first.** `tools/port-to-r2.py` copies only what git tracks (local notes such as SOURCES.md never go online).
2. **Older playable or hybrid only:** if its `index.html` loads the game from `campaign-creatives.iion.media`, run
   `python tools/upload-mock.py <format>/<name>` first (next section). New playables and hybrids load their own `mock.html`: skip this.
3. **Copy it to its home:** `python tools/port-to-r2.py <format>/<name> --redirect`.
4. **Commit the redirect line it added, then push.**
5. **Check** `https://creative-mocks.iion.media/<format>/<name>/index.html` opens and plays with no console errors, and give the user
   that link, never the github.io one. After an update, say Cloudflare can show the old files for up to 10 minutes.

Stop without pushing, and tell the user, if the keys aren't found (`~/cloudflare-creative-mocks.env`, filled from the "Creative Mocks"
entry in Passbolt; template in `tools/cloudflare-creative-mocks.env.example`) or an upload fails. A mock pushed to GitHub without step 3
stays on github.io only, which is what this rule prevents.

- New mock folders: `<format>/<brand-campaign-market>-<4 random chars>`, page from that format's `_template/` (the review page is
  always ours; a delivered playable gives only the game, which becomes `mock.html`).
- Never rename, move or delete other mocks, here or in the bucket. Never print or commit keys. The repo is public.

# Older playables and hybrids that load their game from campaign-creatives

Some playables (Sony, Crompton, Black Pepper and a few more) have an `index.html` whose iframe `src` and `data-full` point at
`https://campaign-creatives.iion.media/mocks/<format>/<name>/mock.html`. When you update one of those:

1. **Upload the game first:** `python tools/upload-mock.py <format>/<name>` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`).
2. **Check** the printed game URL loads with no console errors.
3. Then continue with the steps above (port-to-r2, push).

- That bucket is shared with live campaigns: only ever write under `mocks/`, never change or delete anything else there.
- Don't switch new mocks to campaign-creatives; they load their own `mock.html` on creative-mocks.iion.media.
