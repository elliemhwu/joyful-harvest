# Joyful Harvest 歡呼收割

> 流淚撒種的，必歡呼收割。— 詩篇 126:5

An offline-first English study PWA: one paragraph a day — memorize the cards (撒種),
read the paragraph with tap-to-explain help (閱讀), then self-check (檢查).
Spaced-repetition review (澆水複習) and whole-unit exam review (考前收割) on the side.

## Run

```bash
npm install
npm run dev        # development
npm run build      # production build in dist/
npm run preview    # serve dist/ (service worker + offline)
```

## Tutor mode

Runs on your computer only. The API key stays in the local server and never reaches a phone.

1. Create a `.env` file in this folder with your key from console.anthropic.com:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. `npm run tutor` (opens `/#tutor`). No key yet? `npm run tutor:mock` returns the sample unit, so you can try the flow.
3. **New unit from scans** → add PDFs/photos, marking each as textbook, unit vocabulary list or handbook
   → set the unit id and the student's level → **Organize with Claude** (Claude Opus 5.5, usually 1–4 minutes).
4. Review the draft: highlights preview, sentences and translations, cards, questions, words and grammar.
   Anything that would look wrong on the phone appears under "things to check". The draft is kept in the browser until you publish or discard it.
5. **Publish** writes the files below and bumps the version. **Download file** gives you a file to AirDrop or send by LINE.
6. **Rewards** lets you edit treats and theme unlocks and their goals, then publish.

Publishing updates the files in `public/`. To send them to phones, commit and push:
GitHub Actions rebuilds the site within a few minutes (or send the downloaded file instead).

## Hosting (GitHub Pages)

The student app is live at **https://elliemhwu.github.io/joyful-harvest/**.
Every push to `main` rebuilds it (`.github/workflows/pages.yml`).

To install it on a phone, open that link once while online, then:
- **iPhone (Safari):** Share → Add to Home Screen. Open it from the home screen from then on.
- **Android (Chrome):** menu → Install app (or Add to Home screen).

After that it works offline. It checks for new units each time it opens with internet.

> The repository is public, so anything committed in `public/packs` is public too. Keep units
> made from copyrighted textbook scans out of it (share them as downloaded files instead), or
> make the repository private (GitHub Pages on a private repo needs a paid plan).

## Content files

Everything the tutor controls is static JSON in `public/`:

| File | What it is |
|---|---|
| `public/packs/index.json` | List of units and the rewards config, each with a `version` |
| `public/packs/<unit>.json` | A unit: words, phrases, grammar, paragraphs, questions |
| `public/config/rewards.json` | Your rewards and their goals |

The phone downloads anything whose `version` is higher than what it has, each time
the app opens online. **Bump the version** after editing a file. Students can also
import a unit or rewards file directly (Settings → 匯入檔案), e.g. sent by AirDrop or LINE.

### Unit format

See `src/lib/types.ts` and `public/packs/unit-1.json`. Key ideas:

- `items` (word/phrase) and `grammar` are defined once per unit. `official: true` =
  highlighted by the textbook → always shown and included in exam review.
- `level` (1–6) is compared with the student's level slider; harder words get highlighted.
- Each sentence's `marks` link text to an item (`ref`). Marks may nest
  (`"felt nervous"` → grammar, `"nervous"` → word). Use `nth` for repeated text.
- `cards` per paragraph = the card order for that day's 撒種 step.

### Rewards

```json
{ "id": "r-cake", "title": "A piece of handmade cake", "icon": "cake", "kind": "tutor",
  "goal": { "type": "streak", "days": 7 }, "note": "Show this at your next lesson" }
```

- `kind`: `tutor` (a real-life coupon; you tap 老師確認兌換 on her phone when redeemed)
  or `theme` (unlocks `themeId`: `ocean`, `peach`, `lofi`).
- `goal.type`: `streak` (days), `paragraphs` (count), `unitComplete` (unitId),
  `wordsMastered` (count — cards remembered for a week or more).
- Icons: `cake`, `cup`, `gift`, `star`, `palette`, `leaf`, `sprout`, `book`.

Streaks forgive one missed day per week, and rewards are for effort, never scores.

## Structure

```
src/lib/      types, db (IndexedDB via Dexie), srs (FSRS), streak, progress/rewards, sync, themes, speech
src/screens/  Home, Session (learn → read → check), CardDeck, ReadView, Check, Review, Exam, Rewards, Settings
```

Every stored record is per-student, ready to sync to a real backend (e.g. Supabase) when accounts arrive.
