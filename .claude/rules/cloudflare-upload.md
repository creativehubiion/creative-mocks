# Playables and hybrids load from Cloudflare

GitHub keeps the review page, the link and a full copy of the game. Viewers load the game from Cloudflare R2. Both must always hold the same game. Details: `docs/PLAYBOOK.md` section 12.

Pushing still needs the user's word. Once the user says push, and the push includes a game below, do these steps yourself without being asked:

1. **New playable or hybrid:** set the iframe `src` and `data-full` in its `index.html` to `https://campaign-creatives.iion.media/mocks/<format>/<name>/mock.html`, and remove `data-ripple`.
2. **Upload first:** `python tools/upload-mock.py <format>/<name>`. This applies to any new playable or hybrid, and to any existing one whose `index.html` already loads from that domain.
3. **Check it:** open the printed game URL and confirm it loads with no console errors.
4. **Then push to GitHub:** the whole folder, game files included.
5. **Say what happened:** when you updated an existing game, tell the user Cloudflare can show the old files for up to 10 minutes.

Stop and tell the user, without pushing, if the upload fails or the credentials aren't found. Pushing anyway would leave GitHub and Cloudflare with different games.

- An existing playable or hybrid whose `index.html` still loads its own `mock.html` stays GitHub only until the user asks to switch it.
- Other formats (CTV, rewarded, display, away from the game) stay on GitHub. Their sound buttons need the page and the game on the same domain.
- Only ever write under `mocks/` in the bucket, and never change or delete anything else there. Never print the token or put it in the repo.
