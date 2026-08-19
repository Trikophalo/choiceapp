# Gruppenmodus über mehrere Geräte einrichten

*(English below)*

Ohne Backend lebt eine Runde nur in dem Browser, der sie erstellt hat — deshalb sieht ein Gast auf einem anderen Handy „Gruppenrunden sind noch nicht eingerichtet". Mit einem kostenlosen Firebase-Projekt funktioniert der Link überall. Dauert etwa drei Minuten, kostet nichts und braucht **keine** Kreditkarte.

## 1. Firebase-Projekt anlegen

1. [console.firebase.google.com](https://console.firebase.google.com) öffnen, mit Google-Konto anmelden.
2. **Projekt hinzufügen** → Name z. B. `swipedecide` → Google Analytics kannst du **deaktivieren**.

## 2. Realtime Database erstellen

1. Linke Leiste → **Build → Realtime Database** → **Datenbank erstellen**.
2. Region: **europe-west1** (Belgien) wählen — kurze Wege für Nutzer in Europa.
3. Startmodus: **Gesperrter Modus** wählen. Die richtigen Regeln kommen in Schritt 4.

## 3. Anonyme Anmeldung aktivieren

**Build → Authentication → Los geht's → Anmeldemethode → Anonym → aktivieren.**

Damit bekommt jedes Gerät eine ID, ohne dass sich jemand registrieren muss.

## 4. Sicherheitsregeln einsetzen

**Realtime Database → Regeln** öffnen, den kompletten Inhalt von
[`firebase/database.rules.json`](../firebase/database.rules.json) aus diesem Repo
hineinkopieren und **Veröffentlichen** klicken.

Diese Regeln sind wichtig: Sie sorgen dafür, dass jede Person nur ihre eigenen
Swipes schreiben kann, ein Gewinner nur genau einmal gesetzt werden kann und nur
der Host nach einer Runde ohne Einigung einen neuen Stapel austeilen darf.

> **Hinweis bei Updates:** Wenn sich `firebase/database.rules.json` im Repo
> ändert (z. B. für neue Features wie das automatische Neuausteilen), müssen die
> Regeln in der Firebase-Konsole erneut eingefügt und veröffentlicht werden.

## 5. Web-App registrieren und Werte kopieren

1. Projektübersicht → Zahnrad → **Projekteinstellungen**.
2. Unter *Meine Apps* auf das **Web-Symbol `</>`** klicken, Name vergeben, registrieren.
3. Du bekommst ein `firebaseConfig`-Objekt. Daraus brauchst du fünf Werte.

## 6. Werte als GitHub-Secrets hinterlegen

Im Repo: **Settings → Secrets and variables → Actions → New repository secret**.
Fünf Secrets anlegen (Namen exakt so):

| Secret | Wert aus `firebaseConfig` |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

> `databaseURL` steht nicht immer im Snippet. Du findest sie oben in der
> Realtime-Database-Ansicht, Form: `https://<projekt>-default-rtdb.europe-west1.firebasedatabase.app`

## 7. Neu deployen

**Actions → Deploy to GitHub Pages → Run workflow**.

Danach verschwindet die Warnung in der Lobby, und geteilte Links funktionieren auf
jedem Gerät.

> Die Firebase-Web-Konfiguration ist absichtlich öffentlich — sie identifiziert nur
> das Projekt. Der Schutz kommt aus den Regeln in Schritt 4, nicht aus Geheimhaltung.

### Lokal testen

`.env` im Projektordner anlegen (ist per `.gitignore` ausgeschlossen):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

---

# English

Without a backend a round lives only in the browser that created it, which is why
a guest on another phone sees "Group rounds are not set up yet". A free Firebase
project makes shared links work everywhere. It takes about three minutes, costs
nothing and needs **no** credit card.

1. **Create a project** at [console.firebase.google.com](https://console.firebase.google.com) (Analytics can be off).
2. **Build → Realtime Database → Create database**, region **europe-west1**, start in **locked mode**.
3. **Build → Authentication → Sign-in method → Anonymous → enable.**
4. **Realtime Database → Rules**: paste [`firebase/database.rules.json`](../firebase/database.rules.json) and publish. These rules enforce self-writes only, an immutable deck after start, and a write-once winner.
5. **Project settings → Your apps → Web `</>`** → register → copy the `firebaseConfig` values.
6. Add them as repository secrets under **Settings → Secrets and variables → Actions**, using the exact names in the table above.
7. Re-run **Actions → Deploy to GitHub Pages → Run workflow**.

The Firebase web config is public by design — it identifies the project. Security
comes from the rules in step 4, not from keeping the config secret.
