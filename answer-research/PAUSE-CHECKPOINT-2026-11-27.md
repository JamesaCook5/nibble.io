# Megabytle answer-bank pause checkpoint

Date: 2026-11-27  
Repository: `/home/james/Documents/personal/comp sci work/nibble.io-github`  
Branch: `main`  
Base commit before this work: `e68faf6` (`Speed up typo answer matching`)

## User's active goal

Expand and prune the answer sets across the 127 prompts using multiple review rounds, agents, public datasets, and structured APIs. Keep defensible borderline answers only with scope notes. Skip prompts whose answer sets have 3,000 or more entries. Report final per-prompt totals and tier counts. The user also requested that today's seven daily prompts never appear in Random.

## Saved code/data state

- Random now selects seven distinct prompts from the 120 prompts outside today's daily set. Legacy saved random sessions containing a daily prompt are invalidated and replaced. The selector remains a time-seeded Fisher–Yates pseudorandom shuffle. This is implemented in `app.js`; no runtime/browser test has been run.
- `server.js` preserves exact emoji and emoticon symbols for answer matching and skips fuzzy typo matching for symbol entries.
- Both answer banks retain all 127 prompt sets. Current total is 53,659 answer rows, up from 49,669 at `e68faf6` (+3,990).
- The current expansion added 118 source-checked answer rows across 36 prompts and attached/strengthened direct sources on existing entries. A research manifest holds 277 source records; 118 correspond to additions, 159 enrich existing entries.
- User-directed computer-memory expansion adds 18 secondary-storage concepts. Together with two individually checked memory types, the memory prompt grew from 108 to 128.
- The emoji bank grew from 517 to 4,008 via the official Unicode Emoji 18 dataset (+3,491), with Unicode names and glyph aliases and rarity estimates based on introduction version.
- The Pokémon bank grew from 1,025 to 1,388 via PokeAPI (+363 named forms/species variants). This source's API/code license does not itself clear the Pokémon trademark rights; prior content already includes the franchise. The audit pass intentionally did not add further Pokémon names on that basis.
- Current global tier counts: Bit 796, Nibble 8,694, Byte 35,870, Kilobyte 7,975, Megabyte 252.
- `answer-research/verified-expansion-2026-11-27.json` retains candidate sources, direct evidence, source/license notes, and boundary interpretations. `answer-research/README.md` records the source-selection method.
- Import helpers: `scripts/import_unicode_emoji.py` and `scripts/import_pokemon_forms.py`.

## Research passes completed

- Initial agent passes covered prompt spans 1–42, 43–84, and 85–127. Unverified category-level leads and obvious category errors were excluded.
- Follow-up structured-source passes added 15 candidates in span 1–42, 42 in span 43–84, and 76 in span 85–127. After duplicate matching against both answer-bank files, these passes contributed 72 net new rows (13 + 42 + 17) and strengthened source evidence on existing rows.
- Source-backed additions include international semiconductor/software companies, email/cloud services, Google Fonts families, Caldwell-catalog galaxies, math competitions/units, video-game titles, Minecraft entities/items/biomes, accessibility labels, and technical computer components.
- Candidate boundary notes include storage devices counted under broad “computer memory”; feature phones under mobile-phone models; game titles with hybrid genres; mathematical surfaces listed among solids; named Minecraft variant entities; and Wikidata genre classifications.

## Audit work still pending

The requested pruning/audit phase is not complete. Three agents were paused before editing anything or saving audit manifests:

- Span 1–42: identified `Diaspora` / `diaspora*` as a likely duplicate. Other inspected pairs were distinct. Needs item-level verification and remaining review.
- Span 43–84: suspected theorem/conjecture prompt category errors (`Langlands program`, `Church–Turing thesis`, some named problems) and `ASCII` / `EBCDIC` in the numeral-system prompt. These were not yet source-verified.
- Span 85–127: flagged possible issues around Herobrine, Minecraft block/entity distinctions, accessibility services vs features, spy networks vs agencies, smart-home/wearable products, and duplicates. These were not yet source-verified.
- No audit artifacts exist yet at `/tmp/megabytle_audit_001.json`, `/tmp/megabytle_audit_002.json`, or `/tmp/megabytle_audit_003.json`.
- The daily-exclusion change is in the working tree, not yet deployed. A user-approved push was attempted at this checkpoint only after commit.

## Resume instructions

1. Start at this file and check `git status` and the latest commit.
2. Resume the three audit spans, verifying only suspected odd entries before removal; preserve borderline entries with clear `scope_note` values.
3. Generate the final CSV/JSON report with each question, current total, Bit/Nibble/Byte/Kilobyte/Megabyte counts, and net additions from `e68faf6`.
4. Do not push further changes unless the user asks.
