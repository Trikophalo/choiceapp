# Restaurant-Fotos aktivieren (Google Places)

*(English below)*

Standardmäßig kommen Restaurants von **OpenStreetMap**: kostenlos, ohne Schlüssel,
weltweit — aber OSM enthält so gut wie nie Fotos, deshalb zeigt die Karte dann eine
farbige Kachel mit dem Anfangsbuchstaben.

Für echte Fotos des jeweiligen Restaurants brauchst du einen Google-Places-Schlüssel.
**Wichtig:** Dafür ist ein Google-Cloud-Konto mit hinterlegter Zahlungsmethode nötig,
auch wenn ein kostenloses Kontingent existiert. Ohne Ausgabenlimit kann das Geld kosten —
Schritt 4 ist deshalb nicht optional.

## 1. Projekt und API aktivieren

1. [console.cloud.google.com](https://console.cloud.google.com) öffnen, Projekt anlegen.
2. **APIs & Dienste → Bibliothek** → **Places API (New)** suchen → **Aktivieren**.
3. Abrechnungskonto verknüpfen, falls gefordert.

## 2. Schlüssel erstellen

**APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → API-Schlüssel.**

## 3. Schlüssel einschränken (nicht überspringen)

Beim Schlüssel auf **Bearbeiten**:

- **Anwendungseinschränkungen** → *HTTP-Referrer* → hinzufügen:
  `https://trikophalo.github.io/*`
- **API-Einschränkungen** → *Schlüssel einschränken* → nur **Places API (New)**.

Ohne diese beiden Einschränkungen kann jeder den Schlüssel aus der Website auslesen
und auf deine Rechnung nutzen.

## 4. Ausgabenlimit setzen

**Abrechnung → Budgets und Benachrichtigungen** → Budget z. B. 1 € mit E-Mail-Alarm.
Zusätzlich unter **APIs & Dienste → Places API (New) → Kontingente** ein Tageslimit
(z. B. 100 Anfragen/Tag) setzen. Eine Runde verbraucht **eine** Anfrage.

## 5. Als GitHub-Secret hinterlegen

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Wert |
|---|---|
| `VITE_GOOGLE_PLACES_KEY` | dein API-Schlüssel |

Danach **Actions → Deploy to GitHub Pages → Run workflow**.

Ab dann zeigen Restaurant-Karten das Google-Foto des Lokals. Sternebewertungen werden
bewusst **nicht** angezeigt — die Entscheidung soll aus dem Swipe kommen, nicht aus
einer Punktzahl. Auf der Karte steht stattdessen die Entfernung.

Fällt Google aus oder ist das Kontingent aufgebraucht, schaltet die App automatisch
auf OpenStreetMap zurück, statt eine Fehlermeldung zu zeigen.

---

# English

Restaurants come from **OpenStreetMap** by default: free, keyless, worldwide — but OSM
almost never carries photos, so cards fall back to a coloured initial tile.

For real photos of each restaurant you need a Google Places key. Note this requires a
Google Cloud account **with a payment method**, even though a free tier exists — so
step 4 (spending caps) is not optional.

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com), enable **Places API (New)**.
2. **APIs & Services → Credentials → Create credentials → API key.**
3. Restrict it: *HTTP referrers* → `https://trikophalo.github.io/*`, and *API restrictions* → **Places API (New)** only. Without both, anyone can lift the key from the site and bill you.
4. Set a budget alert **and** a daily quota cap (one round = one request).
5. Add it as the repository secret `VITE_GOOGLE_PLACES_KEY`, then re-run the deploy workflow.

Star ratings are deliberately never shown — cards carry distance instead. If Google
fails or the quota runs out, the app falls back to OpenStreetMap rather than erroring.
