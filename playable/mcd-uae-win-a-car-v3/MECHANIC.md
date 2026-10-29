# Greybox V3: flick mechanic

Work tree seeded from Greybox V2 (`mcd-uae-greybox-v3-flick.html` is an unchanged copy to build on). V1 and V2 stay frozen.

## Decided in the review call

- **Swipe to launch.** How fast you swipe sets the car's starting speed. After launch, friction alone slows the car until it rolls to a stop.
- **Power bar on the left.** It fills while you swipe so players get a feel for how much energy that swipe carries.
- **Three shots.** One each for the speaker, pay window and collect window. It plays like pool or carrom: the skill is controlling your power.
- **Fail and respawn.** If the car stops short or overshoots, it blinks and respawns at the last checkpoint.
- **Checkpoints.** A successful stop becomes the new checkpoint. Missing stop 2 sends you back to stop 1, not the start.
- **Stop 1 is easier.** It has the widest tolerance.
- **App-style menu.** The menu card looks more like the McDonald's App, with a bit of menu at each checkpoint.
- **3D.** The look moves to 3D. The target is to deliver it by this evening.

## Proposed tuning (to confirm)

- **Launch speed:** swipe speed over the last ~80 ms of the swipe, times a gain, capped at a maximum.
- **Friction:** constant deceleration, so stopping distance = v² / 2a and players can learn it.
- **Tolerance:** stop 1 ±30 px, stop 2 ±20 px, stop 3 ±14 px. Inside ±6 px counts as "perfect".
- **Assist:** after 3 misses on the same stop, widen its window and show a ghost marker for where the last flick would have stopped. This is my suggestion, not decided in the call; it protects completion rate.

## Decided after the call

- Swipe direction: up the lane, in the direction of travel.
- Tries: 3 per stop. After the third miss, the crew guides the car in so the ad completes, and that stop earns no star.
- Checkpoint menu and 3D: parked for now. The menu stays a single order sheet at the speaker, and the look stays V2's 2D top-down.
- Built: `mcd-uae-greybox-v3-flick.html`, using the tuning above. Simulated runs: exact swipes give 3 perfect stops; always-miss gives 9 shots, all guided in, 0 stars. The overlap, light and anatomy checks are clean.

## Playtest tuning (40 agents)

- **Agents:** 10 archetypes × 4 variants, in `playtest/agents.js`: casual thumb, rusher, timid dragger, overcorrector, distracted, mobile gamer, low dexterity, pool/carrom player, AI optimal, AI learner.
- **Search:** a fast simulator (`playtest/sim.js`, `tune.js`) ran 1.44M sessions across 1,440 tunings. The winner was then verified in the real game build (`playtest/realplay.js`), with real swipe events and 200 plays per build.
- **Changes:**
  - Distance = 380 × (swipe ÷ 1300)^0.7, capped at 720 px, so the power bar reads as distance.
  - Stop zones are ±48/38/31 px and painted on the lane. Perfect is ±8 px.
  - An AIM band shows on the power bar for the first shot only.
  - Misses within 2× the zone say "So close!".
- **Real-build results, before → after:**
  - First-try stop 1: 14% → 53%.
  - Guided in: 70% → 14%.
  - Zero stars: 45% → 1%.
  - Near-miss share: 13% → 55%.
  - Session: 39.8 s → 26.7 s.
  - Overlap issues: none.

## No guide-in, lenient zones, hand hint

- **Guide-in removed.** The 3-try cap is gone and retries are unlimited. Each miss grows the zone by 25%, capped at ±64 px so the camera can still frame it. A stop made within 3 tries earns its star; after that it still counts, with no star.
- **Zones widened.** They're now ±54/44/36 px, up from 48/38/31. Perfect is still ±8 px.
- **Hand hint.** Before the first swipe, a hand flicks up the lane while the power bar fills to the AIM band in sync, holds, then drains, on a 1.8 s loop. It's a right hand seen from the back with the thumb on the left, which is checked every frame.
- **Real build, 80 sessions:**
  - First-try stop 1: 55%.
  - Stops needing more than 3 tries: 5%. Worst case: 9 shots at one stop.
  - Zero stars: 1%. Gold: 22%.
  - Session: 28.1 s.
  - Overlap, anatomy and light checks: clean.
- **Vercel:** index.html sha 2c0a90f7…, matches local.

## Brand pass

- **Marks:** the agency's files are vectorised in `brand/` (`smile.path`, `wordmark.path`, plus the arches from the supplied SVG). Colours are exactly as supplied: arches #FDBB20, smile #FBBC0D.
- **Arches:** on the feed card, rooftop sign, menu board, order sheet, bag, and on the end card with ®.
- **Wordmark:** in black on the receipt.
- **Smile:** pops over every perfect stop and sits on the gold licence.
- **Font:** the stack is Speedee (licensed, picked up automatically once the agency hosts it), then Nunito, the closest free match.
- **Palette check:** red #DA291C, yellow #FFC72C and near-black #27251F were already the V2 palette.
- **Checks:** regression run clean on overlaps, anatomy and light.
- **Vercel:** index.html sha a122e9b4…, matches local.
