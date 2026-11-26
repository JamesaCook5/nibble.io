# nibble.io (working name)

A daily computer-science quiz in plain HTML, CSS and JavaScript, with no build step and no framework. Better answers upgrade the computer on the desk.

## Run it
The quiz checker and admin editor need the Node server. From this folder, run `npm start`, then open http://localhost:8000. Keep the server running while you play or edit the daily set.

- `?practice=1` plays a random set that isn't saved.
- `?stage=0`…`?stage=7` previews a rig without earning it (for testing).
- In the console, `nibble.upgrade(n)` jumps the rig to stage n.

## Files
- `index.html`: the page, the canvas, the screen overlays and the pixel-computer logo.
- `favicon.svg`: the same logo as the browser tab icon.
- `render.js`: draws the cozy desk scene as pixel art. Layout is a 480x270 grid; each grid unit is 2 canvas pixels on most screens, so details are finer than the big shapes. It has the 8 rigs, the 3D keyboard with springy presses and readable legends, the mouse, a sunset window with curtains, fairy lights, a shelf, a mug and potted plant with faces, and era-matched gaming gear (joystick and floppies, a retro pad and cartridge, then headphones and a modern controller).
- `styles.css`: the monitor screens, the rounded cozy panels and the motion. Fonts are Nunito (UI) and IBM Plex Mono (screens).
- `app.js`: the daily pick, the timers, answer matching, scoring, upgrades, key presses and sound.
- `questions.js`: 21 placeholder prompts with hand-guessed rarity tiers.

## How it plays
- Each day, 7 prompts are picked from the date (seeded shuffle), so everyone gets the same set. Progress is saved in localStorage.
- Each round gives 3 s to read, then 25 s to answer. Wrong answers can be retried until time runs out. Close typos get a "did you mean" suggestion.
- Answers are normalised before matching: case, accents, punctuation, spaces, a leading "the/a", a trailing "'s", and per-prompt suffixes such as "sort" or "attack".
- Tiers: Bit 10, Nibble 30, Byte 60, Kilobyte 85, Megabyte 100. A miss ("No signal") scores 0.
- Rig stage = floor(score / 75), capped at 7 (UPGRADE_EVERY in app.js). Scores are shown as plain points with no maximum, so the game never shows a ceiling.

## Guesses to confirm
- Name "nibble.io" (for now).
- The scene fills the whole window. You type on the monitor; a bottom answer bar only appears on phone-sized screens.
- The daily reset is at UK midnight, and the counter starts at #0 on 26 Nov 2026.
- All rarity tiers are placeholders.
- Key click sounds are on by default (there's a toggle).
- The rigs: 1981 beige box (green screen), 1987 amber, 1995 colour CRT, 2003 flat panel, 2010 widescreen, 2016 dual, 2021 triple, today 4 monitors.


## Run with answer API

The 404 prompt texts are served to the browser; answer data stays in the Node process. Start the site and checker together with `node server.js`, then open http://localhost:8000. The API accepts `POST /api/check` with `{\"id\":\"prompt-id\",\"answer\":\"player answer\"}`. Deploy the Node server and the `answer-pilot/` and `overclock/answer-full/` data files together to make the API available online.

## Admin daily prompts

Type `adminrights` on the home screen, enter the admin password, then choose exactly seven prompts for the next London calendar day. Expand any prompt to inspect its accepted answers by rarity. A prompt marked Complete is unavailable for future Daily sets; prompts from earlier scheduled sets are also marked Used. These selections and completion markers are stored on the server and shared by site visitors.

The local password is read from the ignored `.env` file as `NIBBLE_ADMIN_PASSWORD` (the local file is configured for `adminpassword`). For a hosted deployment, set `NIBBLE_ADMIN_PASSWORD` in the host's environment.

Daily schedules and completion markers use Neon Postgres when `DATABASE_URL` is set. `npm start` applies the tracked SQL migrations using `DATABASE_URL_UNPOOLED` (or `DATABASE_URL` if no unpooled URL is configured), then the server imports an existing `data/daily_prompts.json` file if the database has no saved schedule yet. Without `DATABASE_URL`, local development continues to save to that JSON file. Keep both environment values private; do not commit `.env` or a real Neon connection string.

For Render, use the repository root as the Root Directory, `npm install && npm run build` as the Build Command, and `npm start` as the Start Command. Add `NIBBLE_ADMIN_PASSWORD`, the pooled connection string as `DATABASE_URL`, and the direct connection string as `DATABASE_URL_UNPOOLED` under Environment Variables. The admin feature requires the Node server, not a static file host.
