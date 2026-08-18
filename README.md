# SwipeDecide

A Tinder-style decision app: swipe right/left on restaurants, cocktails, recipes, movies, and activities — solo or as a group via a shareable link. The first card everyone swipes right on wins.

**Status:** planning phase. The full product & technical plan lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## At a glance

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, Framer Motion for swipe physics
- **Group sync:** Firebase Realtime Database (free Spark plan) + anonymous auth — no accounts, no server to run
- **Hosting:** static build on GitHub Pages, deployed via GitHub Actions
- **Data:** free/public APIs per category (TheCocktailDB, TheMealDB, TMDB, OpenStreetMap Overpass, bundled activity dataset), normalized behind a common `DeckProvider` interface
- **Languages:** German 🇩🇪 / English 🇬🇧 via JSON translation files (react-i18next)

## Modes

- **Solo:** swipe through a deck; the first right-swipe wins and the round ends.
- **Group:** one person creates a session and shares a link. Everyone swipes the same deck at their own pace. The first card *all* participants have right-swiped is the unanimous winner and the session ends for everyone with a reveal screen.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the tech-stack rationale, API evaluations, data model, sync design, MVP scope, build plan, and risk register.
