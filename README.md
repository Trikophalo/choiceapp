# SwipeDecide

A Tinder-style decision app. Pick who is deciding (solo or group), pick a category — restaurants, cocktails, recipes, movies, activities — and swipe. **Solo:** the first card you like wins. **Group:** the first card *everyone* likes wins, and the round ends for all devices at once.

Static site, deployable to GitHub Pages. Full UI in German and English. Ready to be wrapped as native iOS/Android apps with Capacitor — see [`docs/MOBILE-APPS.md`](docs/MOBILE-APPS.md).

## Quick start

```bash
npm install
npm run dev
```

That's it — no API keys, no accounts, no backend. Every category works out of the box, and group mode runs on a built-in same-device adapter (open a second browser tab to play along). Adding the optional keys below upgrades individual pieces; see [Configuration](#configuration).

```bash
npm test          # unit tests (match logic, seeded shuffle, providers, i18n parity)
npm run build     # typecheck + production build to dist/
npm run preview   # serve the build at http://localhost:4173/choiceapp/
npm run e2e       # browser end-to-end test (needs the preview running)
```

## How it works

| | |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite, Tailwind CSS v4 with CSS-variable design tokens |
| **Swipe** | Framer Motion — 1:1 drag, rotation capped at 14°, commit at 35% width or a 500 px/s fling, spring-back below threshold |
| **Group sync** | Firebase Realtime Database + anonymous auth when configured; a BroadcastChannel adapter otherwise |
| **Routing** | Hash routes (`#/s/<id>`) so shared links work on GitHub Pages with no 404 workaround |
| **i18n** | react-i18next with JSON bundles; a test enforces key parity between DE and EN |
| **Hosting** | GitHub Actions → GitHub Pages |

### The group-mode rule

Only the **host** calls the content APIs, once, and writes a 25-card snapshot into the session. Everyone else reads that deck over a live subscription. This guarantees identical decks on every device, means guests never need location permission or API keys, and keeps API usage at 1× per session rather than 1× per person.

A card wins when every participant has right-swiped it. Participants freeze when the round starts, so the denominator can't drift. When two people complete different cards in the same instant, a **write-once transaction** on `winner` settles it — exactly one claim commits and all devices converge on the same result.

### Project layout

```
src/
  providers/     one file per content source, all normalising to a single Card shape
  sync/          SyncAdapter interface + Firebase and local implementations
  lib/match.ts   unanimous-winner logic (pure, unit tested)
  screens/       home, setup, solo swipe, result, group session
  i18n/locales/  en.json · de.json
firebase/        Realtime Database security rules
e2e/             browser smoke test of the full solo + group loop
docs/            architecture, API evaluation, risks
```

## Configuration

Every variable is optional. Copy `.env.example` to `.env` to set any of them locally; in CI they come from repository secrets (Settings → Secrets and variables → Actions).

| Variable | Without it | With it | Guide |
|---|---|---|---|
| `VITE_FIREBASE_*` | Group links only work in the browser that created them | **Shared links work across phones** | [Setup](docs/SETUP-FIREBASE.md) |
| `VITE_GOOGLE_PLACES_KEY` | Restaurants come from OpenStreetMap — free and keyless, but no photos | **Real Google photo of each restaurant** | [Setup](docs/SETUP-RESTAURANT-PHOTOS.md) |
| `VITE_TMDB_KEY` | Movies come from the keyless iTunes Search API, with posters | The larger, fully localised TMDB catalogue |  |

If someone opens a shared link on another phone and sees *"Group rounds are not set
up yet"*, that is this table's first row: the app is running without a sync backend.
Follow the [Firebase guide](docs/SETUP-FIREBASE.md) — it takes about three minutes
and needs no credit card.

Cocktails, recipes and activities need no configuration at all.

**Key handling.** Anything prefixed `VITE_` is compiled into the public bundle — building from CI secrets keeps keys out of git history, not out of the shipped JavaScript. So: prefer keyless sources (the default path uses no real secrets); restrict the Google key by HTTP referrer, restrict it to Places API (New), and set a hard quota cap before deploying; treat the free TMDB key as public and rotate it if abused. The Firebase web config is public by design — security comes from `firebase/database.rules.json`, which enforces self-writes only, an immutable deck after start, append-only likes, and a write-once winner.

## Deploying

1. Push to `main` — `.github/workflows/deploy.yml` builds and publishes to Pages.
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. The base path defaults to `/choiceapp/`. For a custom domain, build with `VITE_BASE=/`.

## Categories

| Category | Source | Notes |
|---|---|---|
| Restaurants | OpenStreetMap Overpass, optionally Google Places (New) | Radius up to 10 km, cards labelled with distance. Star ratings are deliberately never shown — the decision should come from the swipe. Google photos need a key |
| Cocktails | TheCocktailDB | German instructions where available; offline snapshot as fallback |
| Recipes | TheMealDB | English content; offline snapshot as fallback |
| Movies | iTunes Search (keyless), TMDB when a key is set | **Real posters with no key required.** iTunes needs no account and is localised per storefront; TMDB takes over when configured |
| Activities | Bundled bilingual dataset (51 entries) + Wikimedia Commons photos | The Bored API shut down in 2024, so the text is curated. Photos come from Commons via a curated per-entry search term — keyless |

Each provider is one file behind a common interface, so replacing a dead source is a contained change. Every network-backed category degrades to a usable state rather than an error screen.

**Images.** Every category shows real photography without any API key, and every source is requested at retina size (≥1200 px — cards render at up to 3× device pixels, so smaller sources read as blurry): recipes and cocktails at their full native resolution, movie posters at 1200×1800 from iTunes Search (TMDB at w780 when keyed), and activities from Wikimedia Commons at 1280 px. Restaurants resolve the best available match in order: a photo mappers attached to the venue itself (OSM `image`/`wikimedia_commons` tags) → a Commons photo taken within 80 m of its coordinates → a cuisine-typical photo, which is the only tier labelled as illustrative. Photo lookups are bounded by a time budget, so a slow source costs a gradient tile, never a delayed deck.

**Details before deciding.** Tapping a card (or the ⓘ button) opens the full detail sheet — a film's synopsis, a dish's ingredients and method, a restaurant's address. Opening and closing it never counts as a swipe.

Location comes from the browser Geolocation API, with keyless [Photon](https://photon.komoot.io) city search as the fallback when permission is denied.

## Attribution

Movie data from [TMDB](https://www.themoviedb.org) — this product uses the TMDB API but is not endorsed or certified by TMDB. Drinks from [TheCocktailDB](https://www.thecocktaildb.com), recipes from [TheMealDB](https://www.themealdb.com), places from [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

## Docs

- [`docs/MOBILE-APPS.md`](docs/MOBILE-APPS.md) — publishing as iOS/Android apps via Capacitor (DE + EN)
- [`docs/SETUP-FIREBASE.md`](docs/SETUP-FIREBASE.md) — make group links work across devices (DE + EN)
- [`docs/SETUP-RESTAURANT-PHOTOS.md`](docs/SETUP-RESTAURANT-PHOTOS.md) — enable Google restaurant photos (DE + EN)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full technical plan, API evaluation, data model and risk register
