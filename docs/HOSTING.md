# Hosting a playable preview on Cloudflare

How to put a playable (or hybrid) preview online at our address, from a game you already have. One page, start to finish.
The other formats work the same way; their pages just come from a different `_template/`.

## The structure

```
this repo (GitHub)                              Cloudflare R2, bucket "creative-mocks"
playable/<name>/                                creative-mocks.iion.media/playable/<name>/
  index.html   the review page we send    ──►     index.html   ← the link you send
  mock.html    the game itself                    mock.html
  assets/…     everything the game loads          assets/…
```

- **One folder per mock**, inside its format folder: `playable/`, `hybrid/`, `ctv/`, `display-interstitial/`, `rewarded/`, `showcase/` …
  The bucket holds the same folders at the same paths.
- **`index.html` is our review page**: the iion header, the drawn phone, the QR card. It always comes from `playable/_template/`
  (or `hybrid/_template/`). It shows `mock.html` inside the phone.
- **`mock.html` is the game**: the delivered playable's HTML file, renamed, with its files beside it.
- **The link we send** is always `https://creative-mocks.iion.media/<format>/<name>/index.html`. It must end in `index.html`,
  because the bucket has no folder index.
- **GitHub is the backup copy.** Every github.io page carries one redirect line that sends visitors to the same page on
  creative-mocks.iion.media. The tool below adds it.

**Folder names:** brand, campaign and market in lower case with dashes, then 4 random characters so links can't be guessed:
`playable/mcdonalds-families-ireland-e4q6`. Reuse the same 4 characters for every mock of one campaign.

## Once per machine: the keys

The upload uses the **Creative Mocks** entry in Passbolt. Copy `tools/cloudflare-creative-mocks.env.example` to your home folder as
`cloudflare-creative-mocks.env` (on Windows `C:\Users\<you>\cloudflare-creative-mocks.env`) and fill it in from that entry.
That file never goes in this repo, in chat or in Slack.

You also need Python 3.9+ with `boto3` (`pip install boto3`) and git.

## Hosting a new playable

1. **Get the latest repo:** `git pull`.
2. **Make the folder from the template:** copy `playable/_template/` to `playable/<name>/` (`hybrid/_template/` for a hybrid).
3. **Put the game in:** replace the template's `mock.html` with the game's HTML file (renamed to `mock.html`) and copy only the
   files it loads beside it, keeping their relative paths. Keep it under 5 MB (playbook section 10).
4. **Set the page's names** in `index.html`: `<title>`, the eyebrow `Playable · <Brand and market/campaign>` (e.g.
   `Playable · McDonald's Ireland Families`) and the `<h1>`. Leave everything else in the template as it is.
5. **Check it locally:** `python tools/rangeserver.py . 8767`, then open `http://127.0.0.1:8767/playable/<name>/index.html`.
   The game should fill the phone and play. Also check `mock.html` on its own.
6. **Commit:** `git add playable/<name>` then `git commit -m "<Brand>: <what it is> at playable/<name>"`.
   (Commit before the upload: the tool copies the files git tracks, so notes you keep locally never go online.)
7. **Upload to Cloudflare:** `python tools/port-to-r2.py playable/<name> --redirect`.
   It copies the folder to the bucket and adds the redirect line to the github.io page. `--dry-run` first lists what it would send.
8. **Commit the redirect line and push:** `git commit -am "<name>: on creative-mocks.iion.media"` then `git push`.
9. **Open the link** `https://creative-mocks.iion.media/playable/<name>/index.html`, play it through, and send that link.

## Updating one

Change the files, commit, run the same `port-to-r2.py playable/<name> --redirect`, push. Cloudflare can show the old version for up to
10 minutes; add `?v=2` (any new value) to the link you send to skip that for the page and its media.

## Rules

- **Only touch your own folder.** Never rename, move or delete other mocks, here or in the bucket.
- **Never commit keys**, `.env` files or local notes. The repo is public.
- **The review page is always ours.** A delivered playable gives us only the game; the page around it comes from `_template/`.
- **Older playables** whose `index.html` loads the game from `campaign-creatives.iion.media` (Sony, Crompton, Black Pepper and a few
  more) also need `tools/upload-mock.py` when you update them: playbook section 12. New playables don't use that bucket.

## When something goes wrong

| You see | Why | Do |
|---|---|---|
| `STOP: bucket keys not found` | No keys file, or a line is missing | Fill `~/cloudflare-creative-mocks.env` from Passbolt (all four `R2_` lines) |
| `0 files` from the tool | The folder isn't committed yet | Commit (step 6), then run it again |
| 404 on the link | Not uploaded, or the link doesn't end in `index.html` | Run step 7, and check the link |
| The old version shows | Cloudflare's 10-minute cache | Wait, or add `?v=2` to the link |
| A phone inside the phone | `mock.html` is a review page, not the game | Put the game's own HTML file in as `mock.html` |
