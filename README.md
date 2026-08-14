# Tarteel — Quran Tajweed Segment Reader

A single-page web app for early-stage Quran recitation practice. The student
loads **one page of the 604-page Madani mushaf** at a time; the whole page is
displayed dimmed, and only the **current phonetic segment** is sharp and
highlighted. Segment boundaries are anchored at **sukoon, madd letters,
tanween, noon sakinah, and shadda** (with the shadda letter shared between two
consecutive segments, since a doubled letter closes one syllable and opens the
next). The student steps through with Next/Back.

There is **no audio anywhere in this app** — by design.

## Run it

```sh
npm install
npm run dev      # local dev server
npm test         # segmentation engine unit tests (vitest)
npm run build    # production build
```

## How it works

- **Data** — fetches only the selected page from
  `api.quran.com/api/v4/quran/verses/uthmani?page_number={n}` (fallback:
  `api.alquran.cloud`), cached in memory and localStorage: exactly one network
  request per newly visited page.
- **Segmentation** (`src/lib/segmenter.js`) — a pure, unit-tested module. The
  ayah string is split into letter clusters (base letter + combining marks;
  tatweel and the dagger alif it carries attach to the preceding cluster), then
  scanned against an ordered list of anchor predicates, each toggleable in
  settings. Shadda applies first and creates the only permitted overlap.
- **Focus rendering** (`src/components/Reader.jsx`) — the page is laid out as
  one RTL paragraph, each ayah a single text node (individual letters are
  never wrapped, so Arabic shaping and ligatures stay intact). The paragraph
  is rendered twice, perfectly stacked: the bottom layer dimmed, the top layer
  clipped with a `clip-path: path(...)` built from `Range.getClientRects()`
  over the current segment, so only that segment shows sharp. Soft highlight
  rectangles slide between segments. Rects are recomputed on segment change,
  resize, and after fonts load.
- **Debug / teacher mode** — a hidden toggle in settings lists every segment
  of the page with its trigger anchor colored inline; shadda clusters visibly
  appear in two consecutive rows.

## Navigation

Next/Back buttons, ArrowLeft/ArrowRight keys (RTL: left = forward), or tap the
left/right halves of the page. Progress and the last page/position are
persisted in localStorage.

## Out of scope for v1

- Audio of any kind (recording, playback, players, assets)
- Full-surah or whole-Quran browsing — the unit of study is a single page
- Tajweed color-coding (the API's `text_uthmani_tajweed` resource can drive
  this later)
- User accounts
