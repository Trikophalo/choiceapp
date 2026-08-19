# Als iOS- und Android-App veröffentlichen

*(English summary below)*

Die App ist bewusst so gebaut, dass sie ohne Umbau in native Apps verpackt werden
kann. Der empfohlene Weg ist **Capacitor**: Es nimmt exakt diesen Web-Build und
verpackt ihn in ein echtes iOS- und Android-Projekt mit Zugriff auf native APIs
(Standort, Haptik, Teilen, Push später). Eine Neuentwicklung in React Native o. Ä.
ist nicht nötig.

## Warum die Codebasis schon bereit ist

- **Hash-Routing** (`#/s/…`) funktioniert unverändert in einer WebView — kein Server nötig.
- **Bilder sind auf 3× Pixeldichte ausgelegt** (1200–1800 px Quellen) — wichtig für Retina-Displays im App Store Review.
- **Basis-Pfad ist konfigurierbar**: für die App mit `VITE_BASE=/` bauen (statt `/choiceapp/`).
- **Gesten** (Framer Motion Pointer Events) laufen in WebViews nativ-flüssig.
- **Solo-Modus braucht kein Netzwerk-Backend**; der Gruppenmodus nutzt Firebase, das in Capacitor-Apps genauso funktioniert wie im Browser.

## Schritte (wenn es so weit ist)

Voraussetzungen: macOS mit Xcode für iOS; Android Studio für Android.

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init SwipeDecide de.DEINNAME.swipedecide --web-dir dist

# Web-Build für App-Betrieb (Basis-Pfad /):
VITE_BASE=/ npm run build

npx cap add ios
npx cap add android
npx cap sync

npx cap open ios       # öffnet Xcode
npx cap open android   # öffnet Android Studio
```

Danach in Xcode/Android Studio wie gewohnt auf ein Gerät bauen.

### Was zusätzlich ansteht

| Thema | Was zu tun ist |
|---|---|
| **Icons & Splash** | Einmalig `npm i -D @capacitor/assets`, ein 1024×1024-Icon ablegen, `npx capacitor-assets generate` |
| **Standort** | Die Browser-Geolocation-API funktioniert in der WebView; für saubere native Permission-Dialoge später `@capacitor/geolocation` einbauen und in `src/lib/geo.ts` (eine Datei) umstellen. iOS verlangt einen Begründungstext in `Info.plist` (`NSLocationWhenInUseUsageDescription`) |
| **Gruppen-Links** | Ein geteilter Link soll die App öffnen: iOS *Universal Links* / Android *App Links* auf die Pages-Domain konfigurieren. Bis dahin öffnet der Link die Web-Version — die funktioniert identisch |
| **Firebase** | Muss für geräteübergreifende Gruppen ohnehin eingerichtet sein ([Anleitung](SETUP-FIREBASE.md)); in der App unverändert nutzbar |
| **Haptik** | `navigator.vibrate` ist in iOS-WebViews stumm; `@capacitor/haptics` liefert echtes haptisches Feedback (eine kleine Änderung in `src/lib/haptics.ts`) |

### Store-Konten & Kosten

| | Apple App Store | Google Play |
|---|---|---|
| Konto | Apple Developer Program, **99 €/Jahr** | Play Console, **25 $ einmalig** |
| Build-Rechner | macOS mit Xcode zwingend | beliebig |
| Review | streng (u. a. Datenschutz-Labels, Begründung für Standort) | schneller |
| Pflicht | Datenschutzerklärung (Standort! Firebase!), Support-URL | Datenschutzerklärung, Data-Safety-Formular |

**Empfohlene Reihenfolge:** erst die Web-Version stabil und mit Firebase live betreiben,
dann verpacken — die App-Hülle erbt jeden Web-Fix automatisch bei `npx cap sync`.

---

# English summary

The codebase is ready to be wrapped with **Capacitor** — same Vite build, real
native iOS/Android projects, no rewrite. Build with `VITE_BASE=/`, run
`npx cap init && npx cap add ios android && npx cap sync`, then open Xcode /
Android Studio. Images are already served at 3× retina sizes (1200–1800 px).
Remaining work when you get there: icons/splash via `@capacitor/assets`, native
geolocation permissions (`@capacitor/geolocation`, one file to touch), universal/app
links so shared group links open the app, and store accounts (Apple 99 €/yr,
Google 25 $ once) plus a privacy policy covering location and Firebase.
