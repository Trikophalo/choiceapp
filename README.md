# SwipeDecide

A Tinder-style decision app. Swipe right or left on restaurants, cocktails, recipes, movies and activities — alone or with friends over a shared link. **Solo:** the first card you like wins. **Group:** the first card *everyone* likes wins, and the round ends for all devices at once.

Static site, deployable to GitHub Pages. Full UI in German and English.

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

| Variable | Without it | With it |
|---|---|---|
| `VITE_TMDB_KEY` | Movies serve a bundled offline snapshot | Live, fully localised TMDB catalogue (German titles and synopses) |
| `VITE_GOOGLE_PLACES_KEY` | Restaurants come from OpenStreetMap: free, keyless, no ratings | Star-rating filter and real photos |
| `VITE_FIREBASE_*` | Group rounds sync between tabs on one device | Group rounds sync across phones |

Cocktails, recipes and activities need no configuration at all.

**Key handling.** Anything prefixed `VITE_` is compiled into the public bundle — building from CI secrets keeps keys out of git history, not out of the shipped JavaScript. So: prefer keyless sources (the default path uses no real secrets); restrict the Google key by HTTP referrer, restrict it to Places API (New), and set a hard quota cap before deploying; treat the free TMDB key as public and rotate it if abused. The Firebase web config is public by design — security comes from `firebase/database.rules.json`, which enforces self-writes only, an immutable deck after start, append-only likes, and a write-once winner.

## Deploying

1. Push to `main` — `.github/workflows/deploy.yml` builds and publishes to Pages.
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. The base path defaults to `/choiceapp/`. For a custom domain, build with `VITE_BASE=/`.

## Categories

| Category | Source | Notes |
|---|---|---|
| Restaurants | OpenStreetMap Overpass, optionally Google Places (New) | Radius up to 10 km; rating filter only in enhanced mode, and the UI says so rather than showing a dead control |
| Cocktails | TheCocktailDB | German instructions where available; offline snapshot as fallback |
| Recipes | TheMealDB | English content; offline snapshot as fallback |
| Movies | TMDB | Fully localised; offline snapshot when no key is set |
| Activities | Bundled bilingual dataset (51 entries) | The Bored API shut down in 2024, so this is curated rather than fetched — no rate limits, no CORS, no shutdown risk |

Each provider is one file behind a common interface, so replacing a dead source is a contained change. Every network-backed category degrades to a usable state rather than an error screen.

Location comes from the browser Geolocation API, with keyless [Photon](https://photon.komoot.io) city search as the fallback when permission is denied.

## Attribution

Movie data from [TMDB](https://www.themoviedb.org) — this product uses the TMDB API but is not endorsed or certified by TMDB. Drinks from [TheCocktailDB](https://www.thecocktaildb.com), recipes from [TheMealDB](https://www.themealdb.com), places from [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full technical plan, API evaluation, data model and risk register.
