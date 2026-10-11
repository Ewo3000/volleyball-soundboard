# SV 1845 Esslingen – Volleyball DJ Soundboard 🏐🎶

Eine moderne, offline-fähige Web-App (PWA) als digitales DJ-Pult für Volleyball-Heimspieltage des **SV 1845 Esslingen e.V.** Optimiert für die Touch-Bedienung auf (Android-) Tablets im Querformat mit Bluetooth-Lautsprechern sowie mit automatischer Smartphone-Ansicht im Hochformat.

![SV 1845 Esslingen Logo](assets/logo.jpg)

---

## 🌟 Hauptfunktionen

- **Speziell für Spieltage konzipiert:** Schneller Zugriff auf Einlaufmusik, Timeouts, Satzpausen, Asse, Block-Hits und Stimmungssongs während des Spiels.
- **Tablets & Desktop (Querformat):** 7 übersichtliche Spalten mit dynamischer Skalierung (Zoom 70 % – 120 %), minimiertem Abstand zwischen Mediathek und Footer für maximale Platzausnutzung sowie um 50 % vergrößerter Schnellzugriffsleiste mit automatischer Breitenanpassung, bis zu dreizeiliger Beschriftung und garantiertem Schutz vor Textüberstand.
- **Spektakuläre Vollbild-Animationen & Satzpausen-Overlay:**
  - 🔥 **Flammenanimation:** Schießt bei Tipp auf den "Ass"-Button über die gesamte Appoberfläche empor.
  - 🛡️ **Schild-/Blockanimation:** Entfaltet bei Tipp auf den "Block"-Button eine wuchtige Abwehrbarriere und Schockwelle über den gesamten Bildschirm.
  - ⏳ **Animiertes Sanduhr-Overlay (Satzpause):** Legt sich während der Satzpausen elegant über die Mediathek mit sanft drehender Sanduhr und Anzeige des Pausentracks, während die Aktionsleiste und STOPP-Taste unten uneingeschränkt frei und bedienbar bleiben.
  - Vollbild-Effekte für Ass und Block sind vollständig klicktransparent (`pointer-events: none`), sodass die Audiobedienung zu keinem Zeitpunkt blockiert wird.
- **Pulsierende Button-Animation:** Ausgelöste Schnellzugriffsknöpfe und Song-Buttons pulsieren während der Wiedergabe mit einem intensiven Glow-Effekt (`pulse-playing-glow`), der sofort signalisiert, welcher Track aktiv ist.
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
| `_PAUSE1` | **Pausensong 1** | Schnellzugriffsleiste (**Pause 1**, verdoppelte Button-Breite) |
| `_PAUSE2` | **Pausensong 2** | Schnellzugriffsleiste (**Pause 2**, verdoppelte Button-Breite) |
| `_PAUSE3` | **Pausensong 3** | Schnellzugriffsleiste (**Pause 3**, verdoppelte Button-Breite) |
| `_PAUSE4` | **Pausensong 4** | Schnellzugriffsleiste (**Pause 4**, verdoppelte Button-Breite) |
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
- **Aktiv-Status & Pulsieren:** Sowohl der laufende Song in der Mediathek als auch der auslösende Button in der Aktionsleiste pulsieren mit einer intensiven Neon-Glow-Animation (`pulse-playing-glow`).
- **Satzpause mit Sanduhr:** Beim Abspielen von Pausensongs blendet sich ein animiertes Sanduhr-Overlay ("⏳ Satzpause") samt Songtitel über der Mediathek ein.
- **Play-Zähler:** Jeder Song besitzt rechts eine Badge mit der Anzahl der bisherigen Abspiele.
- **■ STOP:** Beendet die aktuelle Wiedergabe mit einem sanften **2,0-Sekunden-Fadeout**, blendet das Pausen-Overlay sanft aus und setzt den Pulsier-Status aller Buttons zurück.

### 3. Schnellzugriffsleiste (Footer)
Die Schnellzugriffsleiste und deren Aktions-Buttons sind um **50 % vergrößert** (Mindesthöhe 108 px, Leistenhöhe mind. 130 px) und der Abstand zur Mediathek ist minimiert für maximale Treffsicherheit in hitzigen Spielsituationen. Sie passt sich dynamisch an die Gerätebreite an, und Texte werden mit bis zu dreizeiligem Umbruch, Silbentrennung sowie `overflow: hidden` und `text-overflow: ellipsis` strikt vor Überstand geschützt:
- **🏐 Ass (Eigenes Team):** Spielt per Zufall einen Song mit dem Suffix `_ACE` ab (priorisiert noch ungespielte Asse) und zündet eine feurige **Vollbild-Flammenanimation** über die gesamte App.
- **🛡️ Block (Eigenes Team):** Spielt per Zufall einen Song mit dem Suffix `_BLOCK` ab (priorisiert noch ungespielte Blocks) und entfacht eine wuchtige **Vollbild-Schild- und Schockwellen-Animation**.
- **⚡ Eigene Punkte (Zufall):** Wählt per Zufall einen Titel aus *Ass / Angriff* oder *Sonstiges* aus.
- **🛡 Gegnerpunkte (Zufall):** Wählt per Zufall einen Titel aus der Kategorie *Gegner* (`_OPP`).
- **Timeout:** Spielt sofort einen Auszeit-Sound (`_TIMEOUT`).
- **Walk-On:** Spielt die Einlaufmusik (`_WALKON`).
- **Pause 1 – 4:** Vordefinierte Satzpausensongs (`_PAUSE1` bis `_PAUSE4`) mit **verdoppelter Mindestbreite** für treffsichere Bedienung; aktiviert während des Spielens das animierte Sanduhr-Overlay über der Mediathek.
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

Die Anwendung verfügt über eine umfassende Test-Suite (91 automatisierte Tests):
```bash
npm test
```
Getestet werden:
- Vollständige Suffix-Erkennung (`_ACE`, `_HIT`, `_BLOCK`, `_OPP`, `_PAUSE1..4`, `_TIMEOUT`, `_WALKON`, etc.)
- Gleichmäßige Round-Robin-Verteilung der Songs ohne Suffix auf Sonstiges 1, 2 und 3
- Duplikaterkennung und -vermeidung beim Importieren
- Web Audio Pipeline, Lautstärkeskalierung und 2,0-Sekunden-Fade-Out bei STOP
- 50 % vergrößerte Aktionsleiste (Höhe ≥ 130 px, Buttons ≥ 108 px), minimierter Mediathek-Abstand und dreizeiliger Textumbruch ohne Überstand
- Pause 1 bis Pause 4 Buttons mit verdoppelter Mindestbreite
- Animiertes Sanduhr-Overlay über der Mediathek während Satzpausen (Show/Hide Lifecycle)
- Pulsierende Animation (`pulse-playing-glow`) und State-Management für getriggerte Buttons
- Vollbild-Animationen für Ass (Flammen) und Block (Schild) inkl. Klicktransparenz
- Screen Wake Lock Erwerb und Reaktivierung
- PWA Service Worker Cache-Strategie (100 % offline) und dynamische Update-Erkennung via `version.json`
- Relative Pfade für fehlerfreies Hosting auf GitHub Pages
