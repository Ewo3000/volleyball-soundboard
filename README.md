# SV 1845 Esslingen – Volleyball DJ Soundboard 🏐🎶

Eine moderne, offline-fähige Web-App (PWA) als digitales DJ-Pult für Volleyball-Heimspieltage des **SV 1845 Esslingen e.V.** Optimiert für die Touch-Bedienung auf (Android-) Tablets im Querformat mit Bluetooth-Lautsprechern sowie mit automatischer Smartphone-Ansicht im Hochformat.

![SV 1845 Esslingen Logo](assets/logo.jpg)

---

## 🌟 Hauptfunktionen

- **Speziell für Spieltage konzipiert:** Schneller Zugriff auf Einlaufmusik, Timeouts, Satzpausen, Asse, Block-Hits und Stimmungssongs während des Spiels.
- **Tablets & Desktop (Querformat):** 7 übersichtliche Spalten mit dynamischer Skalierung (Zoom 70 % – 120 %) und responsiver Schnellzugriffsleiste mit automatischer Breitenanpassung, zweizeiliger Beschriftung und garantiertem Schutz vor Bildschirmüberlauf.
- **Smartphone-Modus (Hochformat):** Automatische Reduktion auf die Schnellzugriffstasten mit großem Daumen-Pad und einem Vollbild-Drawer ("Alle Songs & Kategorien").
- **100 % Offline-fähig (PWA):** Ein Service Worker speichert die gesamte Anwendung im Browsercache. Funktioniert in jeder Sporthalle auch ohne Internetverbindung.
- **Lokale IndexedDB-Persistenz:** Musikdateien (MP3, WAV, OGG, M4A, FLAC) und Zählerstände werden lokal im Speicher des Tablets/Browsers gespeichert und bleiben nach dem Neuladen erhalten.
- **Duplikat-Schutz:** Verhindert zuverlässig das mehrfache Importieren identischer Audiodateien.
- **Web Audio API Engine:** 
  - 50 ms Mikro-Fade beim Umschalten zwischen Songs (verhindert Knacken und Audio-Pops über Bluetooth).
  - 2,0 Sekunden weicher Fade-Out bei Berührung des STOP-Buttons.
  - Zufallswiedergabe mit Priorisierung ungespielter Songs (`playCount == 0`).
- **Screen Wake Lock:** Verhindert automatisches Abdunkeln oder Sperren des Tablet-Bildschirms während des Spielbetriebs.
- **Echtzeit-Suche:** Sofortiges Ausblenden nicht passender Songs mit 1-Klick-Löschbutton (✕).
- **Integrierter Synthesizer:** Enthält 18 synthetisierte Demo-Sounds, um das DJ-Pult sofort ohne eigene MP3s testen zu können.

---

## 🎨 Farbschema & Vereins-Branding

Die App nutzt das offizielle Farbschema des SV 1845 Esslingen:
- **Hintergrund:** Dunkles Schieferblau (`#0B0F17` / `#121824`)
- **Vereinsblau:** `#1B75BC` (Ass / Angriff, Walk-On, Hauptakzente)
- **Flammrot:** `#E53935` (Gegnerpunkte, Stopp-Aktion)
- **Smaragdgrün:** `#10B981` (Kategorie **Sonstiges** über 3 Spalten)
- **Signal-Magenta:** `#D81B60` (Block)
- **Amber / Gold:** `#F59E0B` (Timeout)
- **Violett:** `#8E24AA` (Spaß & Extras)

---

## 🏷️ Dateibenennung & Suffix-Regeln

Die App sortiert Songs vollautomatisch anhand ihrer Dateiendungen (Suffixe im Dateinamen vor der Dateiendung wie `.mp3`, `.wav`) in die entsprechenden Kategorien und Schnellzugriffsknöpfe ein.

Unterstriche im Dateinamen werden in der Oberfläche automatisch zu sauberen Leerzeichen formatiert, und das Suffix wird im Button-Titel ausgeblendet (z. B. wird `Super_Spike_HIT.mp3` als **Super Spike** angezeigt).

| Dateiendung / Suffix | Zugeordnete Kategorie / Funktion | Darstellung auf dem Soundboard |
| :--- | :--- | :--- |
| `_HIT`, `_ANGRIFF`, `_ASS` | **Ass / Angriff** | Spalte 1 (Blau) |
| `_ACE` | **Ass / Angriff** & **Ass (Eigenes Team)** | Spalte 1 (Blau) & Schnellzugriff-Button *🏐 Ass (Eigenes Team)* |
| `_BLOCK` | **Block** & **Block (Eigenes Team)** | Spalte 2 (Magenta) & Schnellzugriff-Button *🛡️ Block (Eigenes Team)* |
| `_OPP`, `_GEGNER`, `_OPPONENT` | **Gegner** | Spalte 3 (Rot) |
| **Kein Suffix** (oder `_SONSTIGES`) | **Sonstiges** | **Gleichmäßig auf Spalten 4, 5 und 6 verteilt** (Smaragdgrün) |
| `_FUN`, `_SPASS` | **Spaß & Extras** | Spalte 7 (Lila) |
| `_TIMEOUT` | **Timeout** | Schnellzugriffsleiste (*Timeout*) |
| `_WALKON`, `_EINLAUF` | **Walk-On** | Schnellzugriffsleiste (*Walk-On*) |
| `_PAUSE1` | **Pausensong 1** | Schnellzugriffsleiste (Slot 1) |
| `_PAUSE2` | **Pausensong 2** | Schnellzugriffsleiste (Slot 2) |
| `_PAUSE3` | **Pausensong 3** | Schnellzugriffsleiste (Slot 3) |
| `_PAUSE4` | **Pausensong 4** | Schnellzugriffsleiste (Slot 4) |
| `_PAUSE`, `_PAUSENSONG` | **Allgemeine Pausensongs** | Füllen unbesetzte Pausenslots 1–4 automatisch auf |
| `_SIXSEVEN`, `_67` | **6 / 7 Hype** | Schnellzugriffsleiste (*6 / 7*) |

> **Hinweis zur Kategorie "Sonstiges":**  
> Songs ohne spezielles Suffix (z. B. `Perfekte_Welle.mp3`, `Samba_De_Janeiro.mp3`, `Seven_Nation_Army.mp3`) werden automatisch als **Sonstiges** erkannt und gleichmäßig über die drei mittleren Spalten verteilt. In der mobilen Ansicht (Drawer) werden sie als eine gemeinsame Kategorie dargestellt.

---

## 📖 Bedienungsanleitung

### 1. Songs laden
1. Klicke im Kopfbereich auf **📁 Songs laden / Ordner auswählen** (oder ziehe Musikdateien per Drag & Drop auf den Bildschirm).
2. Wähle deinen Musikordner mit den benannten Songs aus.
3. Die Songs werden analysiert, kategorisiert und dauerhaft in der lokalen Datenbank deines Browsers gespeichert.
4. **Duplikat-Schutz:** Bereits vorhandene Lieder werden automatisch übersprungen.
5. *(Optional zum Ausprobieren)*: Klicke auf **🎵 Demo-Sounds laden**, um vorgefertigte Soundboard-Töne zu generieren.

### 2. Audio abspielen & Stop
- **Spalten-Buttons:** Durch Antippen eines Songs startet die Wiedergabe sofort.
- **Aktiv-Status:** Der aktuell laufende Song pulsiert mit einer blauen Neon-Glow-Animation.
- **Play-Zähler:** Jeder Song besitzt rechts eine Badge mit der Anzahl der bisherigen Abspiele.
- **■ STOP:** Beendet die aktuelle Wiedergabe mit einem sanften **2,0-Sekunden-Fadeout**.

### 3. Schnellzugriffsleiste (Footer)
Die Schnellzugriffstasten passen sich dynamisch an die Gerätebreite an (ohne Überlauf). Längere Texte mit Klammern (z. B. "(Eigenes Team)", "(Zufall)") werden übersichtlich zweizeilig formatiert:
- **🏐 Ass (Eigenes Team):** Spielt per Zufall einen Song mit dem Suffix `_ACE` ab (priorisiert noch ungespielte Asse).
- **🛡️ Block (Eigenes Team):** Spielt per Zufall einen Song mit dem Suffix `_BLOCK` ab (priorisiert noch ungespielte Blocks).
- **⚡ Eigene Punkte (Zufall):** Wählt per Zufall einen Titel aus *Ass / Angriff* oder *Sonstiges* aus.
- **🛡 Gegnerpunkte (Zufall):** Wählt per Zufall einen Titel aus der Kategorie *Gegner* (`_OPP`).
- **Timeout:** Spielt sofort einen Auszeit-Sound (`_TIMEOUT`).
- **Walk-On:** Spielt die Einlaufmusik (`_WALKON`).
- **Pausensongs 1 – 4:** Vordefinierte Satzpausensongs (`_PAUSE1` bis `_PAUSE4`).
- **6 / 7:** Spielt den 6/7-Hype-Sound (`_SIXSEVEN`).
- **■ STOP:** Beendet die aktuelle Wiedergabe mit einem sanften **2,0-Sekunden-Fadeout**.

### 4. Steuerung & Werkzeuge in der Kopfleiste
- **Kopf ein / aus:** Blendet das große Logo-Banner ein oder aus, um maximalen Platz für die Song-Buttons auf dem Tablet zu schaffen.
- **Zoom (− 100% +):** Skaliert das Spielfeld in 5%-Schritten von 70 % bis 120 % für jede Bildschirmgröße.
- **🔍 Suchleiste & ✕ Button:** Filtert Songs in Echtzeit. Alle nicht zur Suche passenden Songs werden vollständig ausgeblendet. Ein Klick auf das **✕** leert das Suchfeld sofort mit einem Fingertipp.
- **🔊 Lautstärke-Regler:** Master-Lautstärke (0 % bis 100 %).
- **Reset:** Setzt alle Abspielzähler auf 0 zurück (z. B. vor Spielbeginn).
- **🗑 Leeren:** Entfernt alle geladenen Songs nach Bestätigung aus der Liste und dem lokalen Speicher.
- **🔄 (Update-Prüfung):** Sucht sofort nach neuen Versionen auf dem Server (über `version.json` und Service Worker). Rotiert während der Prüfung und lädt die App bei bestätigtem Update sofort neu.
- **Vollbild:** Schaltet den Vollbildmodus des Tablets ein oder aus.

---

## 📱 Smartphone-Nutzung (Hochformat)

Wird die Web-App auf einem Smartphone im Hochkantmodus geöffnet:
1. Schaltet die Ansicht automatisch in eine vereinfachte Version.
2. Der Bildschirm ist auf die extragroßen Schnellzugriffstasten (Ass, Eigene Punkte, Gegnerpunkte, Timeout, Walk-On, Pausensong, STOP) und den Lautstärkeregler reduziert.
3. Über den großen Button **📋 Alle Songs & Kategorien** öffnet sich ein übersichtlicher Vollbild-Drawer mit allen Songs, sortiert nach Kategorien und mit eigener Suchleiste.

---

## 🚀 Installation als Tablet-App (PWA)

Die App kann ohne App Store direkt auf jedem Android-Tablet (oder iPad) installiert werden:
1. Öffne die App im Chrome-Browser auf dem Tablet.
2. Tippe oben rechts auf das Dreipunkt-Menü `⋮`.
3. Wähle **"Zum Startbildschirm hinzufügen"** bzw. **"App installieren"**.
4. Die App erscheint als vollwertige Vollbild-App mit dem Vereinslogo auf dem Homescreen.

---

## 🌐 Veröffentlichung auf GitHub Pages

Die App benötigt keinen Server und besteht rein aus statischen Web-Dateien (HTML5, CSS3, ES-Module):

1. **Repository auf GitHub anlegen:** Erstelle ein neues Repository auf GitHub (z. B. `volleyball-dj`).
2. **Dateien hochladen:**
   ```bash
   git remote add origin https://github.com/<DEIN-GITHUB-BENUTZERNAME>/volleyball-dj.git
   git branch -M main
   git push -u origin main
   ```
3. **GitHub Pages aktivieren:**
   - Gehe im GitHub-Repository auf **Settings** -> **Pages**.
   - Wähle unter *Build and deployment* -> *Source* den Branch **main** und Ordner **/ (root)**.
   - Klicke auf **Save**.
4. Die Web-App ist nach wenigen Sekunden unter `https://<DEIN-GITHUB-BENUTZERNAME>.github.io/volleyball-dj/` weltweit erreichbar!

---

## 🧪 Tests & Qualitätssicherung

Die Anwendung verfügt über eine umfassende Test-Suite (77 automatisierte Tests):
```bash
npm test
```
Getestet werden:
- Vollständige Suffix-Erkennung (`_ACE`, `_HIT`, `_BLOCK`, `_OPP`, `_PAUSE1..4`, `_TIMEOUT`, `_WALKON`, etc.)
- Gleichmäßige Round-Robin-Verteilung der Songs ohne Suffix auf Sonstiges 1, 2 und 3
- Duplikaterkennung und -vermeidung beim Importieren
- Web Audio Pipeline, Lautstärkeskalierung und 2,0-Sekunden-Fade-Out bei STOP
- Screen Wake Lock Erwerb und Reaktivierung
- PWA Service Worker Cache-Strategie (100 % offline) und dynamische Update-Erkennung via `version.json`
- Relative Pfade für fehlerfreies Hosting auf GitHub Pages
