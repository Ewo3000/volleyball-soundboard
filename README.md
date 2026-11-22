# SV 1845 Esslingen – Volleyball DJ Soundboard 🏐🎶

Eine moderne, offline-fähige Web-App (PWA) als digitales DJ-Pult für Volleyball-Heimspieltage des **SV 1845 Esslingen e.V.** Optimiert für die Touch-Bedienung auf (Android-) Tablets im Querformat mit Bluetooth-Lautsprechern sowie mit automatischer Smartphone-Ansicht im Hochformat.

![SV 1845 Esslingen Logo](assets/logo.jpg)

---

## 🌟 Hauptfunktionen

- **Speziell für Spieltage konzipiert:** Schneller Zugriff auf Einlaufmusik, Timeouts, Satzpausen, Asse, Block-Hits, One-Shot Stadion-Effekte und Stimmungssongs während des Spiels.
- **Tablets & Desktop (Querformat):** 7 übersichtliche Spalten (mit übergreifendem Gruppenkopf für **Sonstiges**) samt dynamischer Skalierung (Zoom 70 % – 120 %) und extra großer Schnellzugriffsleiste mit bis zu dreizeiliger Beschriftung ohne Textüberstand.
- **Audio-Engine & Bluetooth-Praxis:**
  - 50 ms Mikro-Fade beim Songwechsel & **3,0 s weicher Fade-Out bei STOP** — **2× schnelles Tippen auf STOP = 80 ms Hard-Cut** mit sichtbarem Ablauf-Feedback.
  - **Auto-Pegel & 5-Preset-Equalizer:** Transparente RMS-Lautstärke-Angleichung, Ceiling-Limiter, 5 Klang-Presets (*Neutral, Stadion/Halle, Bass Boost, Punch & Klarheit, Warm/Lounge*) sowie individuelle Pro-Song-Lautstärke (20–200 %) im Scrubber-Menü.
  - **🔊 Bluetooth-Wachhalter (Anti-Sleep / Anti-Lag):** Optionales unhörbares Trägersignal hält Bluetooth-Lautsprecher wach, damit kein Punkt-Jingle verzögert anläuft.
  - Zufallswiedergabe mit Priorisierung ungespielter Songs (`playCount == 0`) & **Visuelle Frische-Anzeige** (häufig gespielte Songs ab 2× leicht abgedimmt).
  - **🔁 Warm-Up Auto-Play:** Spielt vor dem Match fortlaufend wenig gespielte Songs automatisch nacheinander ab.
- **One-Shot SFX-Pop-up (`📢 SFX`):**
  - 6 eingebaute offline synthetisierte Stadion-Effekte (*Airhorn, Block-Boom, Fanfare, Stadion-Clap, Tusch/Wirbel, Power-Charge*).
  - **Eigene Effekt-Dateien:** Werden aus dem Unterordner `effekte/` (oder mit Suffix `_SFX`) auf demselben unabhängigen Overlay-Bus abgespielt — laufende Musik wird nicht gestoppt!
- **Timer & Spielstand:**
  - **30-Sekunden-Countdown** direkt auf dem Timeout-Button und **3:00-Minuten-Satzpausen-Timer** mit `+30s`, Reset und `Auto-Fade 0:05`.
  - **🏐 Optionaler Mini-Spielstand im Header:** Minimalistische Anzeige (**SV : GAST**) ohne eigene Kontrollbuttons — direkt an die Soundboard-Buttons gekoppelt (*Ass*, *Block*, *Eigene Punkte*, *Sonstiges* → **+1 SV**; *Gegnerpunkte*/*Gegner* → **+1 GAST**). Bei schnellem Umwählen innerhalb von 5 Sekunden wird der vorherige Punkt automatisch korrigiert; sofortiges `■ STOP` (oder Hard-Cut) nimmt den letzten Punkt zurück. Auf `0:0` zurücksetzbar in den Einstellungen oder über `Reset`.
- **Song-Kontextmenü (Long-Press / Rechtsklick):** Langes Tippen (Touch) oder Rechtsklick auf jeden Song-Button öffnet ein Menü zum **⭐ Favoriten oben anpinnen**, Kategorie wechseln, Lautstärke vorab anpassen oder einzelnen Song entfernen.
- **Spektakuläre Vollbild-Animationen, Live-Fortschritt & Visualizer:**
  - 🔥 **Ass (Flammen)**, 🛡️ **Block (Schild & Schockwelle)** und ⚡ **6/7 Hype** (vollständig klicktransparent).
  - Live-Fortschrittsbalken direkt am spielenden Song-Button, **Compact Now-Playing-Pill** bei eingeklapptem Kopf und ressourcenschonender 20-FPS-Equalizer/VU-Meter.
- **3 Design-Themes (inkl. Tageslicht-Modus):** *Klassisch (Dunkel)*, *Material 3 Expressive* und *Helle Halle (High Contrast)* für hell ausgeleuchtete Sporthallen.
- **Tastatur- & NumPad-Shortcuts + Media Session:** Bedienbar per Tastatur oder Bluetooth-NumPad (Spickzettel direkt in den Einstellungen) sowie über Hardware-Pause/Stop-Tasten.
- **Backup & 100 % Offline-PWA:** JSON-Export/-Import für alle Einstellungen & Song-Zuordnungen, IndexedDB-Persistenz, Duplikat-Schutz, Screen Wake Lock und Service Worker.

---

## 🎨 Themes & Vereins-Branding

Die App bietet drei Themes (umschaltbar unter **⚙️ Einstellungen**):
- **Klassisch:** Dunkles Schieferblau (`#0B0F17` / `#121824`) mit SV-1845-Vereinsblau (`#1B75BC`), Flammrot (`#E53935`), Signal-Magenta (`#D81B60`), Smaragdgrün (`#10B981`), Amber (`#F59E0B`) und Violett (`#8E24AA`).
- **Material 3 Expressive:** Abgerundete Squircle-/Pill-Formen und elastische Feder-Animationen.
- **Helle Halle (Kontrast):** Tageslicht-optimierte helle Oberfläche (`#F1F5F9` / `#FFFFFF`) mit hohen Kontrasten für stark beleuchtete Sporthallen.

---

## 🏷️ Ordnerstruktur, Dateibenennung & Suffix-Regeln

Die App sortiert Songs vollautomatisch anhand von **Unterordnern** oder **Suffixen** im Dateinamen vor der Dateiendung (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`). Unterstriche werden sauber zu Leerzeichen formatiert und das Suffix ausgeblendet.

| Ordner / Suffix | Zugeordnete Kategorie / Funktion | Darstellung auf dem Soundboard |
| :--- | :--- | :--- |
| Unterordner `effekte/` (oder `effects/` / `sfx/`) | **Eigene One-Shot Effekte** | Pop-up **📢 SFX** (kein Umbenennen nötig!) |
| `_SFX`, `_EFFEKT`, `_EFFECT` | **Eigene One-Shot Effekte** | Pop-up **📢 SFX** |
| `_HIT`, `_ANGRIFF`, `_ASS` | **Ass / Angriff** | Spalte 1 (Blau) |
| `_ACE` | **Ass / Angriff** & **Ass (Eigenes Team)** | Spalte 1 (Blau) & Schnellzugriff *🏐 Ass* |
| `_BLOCK` | **Block** & **Block (Eigenes Team)** | Spalte 2 (Magenta) & Schnellzugriff *🛡️ Block* |
| `_OPP`, `_GEGNER`, `_OPPONENT` | **Gegner** | Spalte 3 (Rot) |
| **Kein Suffix** (oder `_SONSTIGES`) | **Sonstiges** | **Gleichmäßig auf Spalten 4–6 verteilt** (Smaragdgrün) |
| `_FUN`, `_SPASS` | **Spaß & Extras** | Spalte 7 (Lila) |
| `_TIMEOUT` | **Timeout** | Schnellzugriffsleiste (*⏱ Timeout*, 30s Timer) |
| `_WALKON`, `_EINLAUF` | **Walk-On** | Schnellzugriffsleiste (*🚶 Walk-On*) |
| `_PAUSE1` – `_PAUSE4` | **Pausensong 1–4** | Schnellzugriffsleiste (*Pause 1–4*, 3:00 Timer) |
| `_PAUSE`, `_PAUSENSONG` | **Allgemeine Pausensongs** | Füllen unbesetzte Pausenslots 1–4 auf |
| `_SIXSEVEN`, `_67` | **6 / 7 Hype** | Schnellzugriffsleiste (*6 / 7*) |

> **Tipp:** Über **Langes Drücken (Touch)** oder **Rechtsklick** auf jeden Song lassen sich Kategorie, Favoriten-Pin (`⭐`), Song-Lautstärke und das Löschen jederzeit auch nachträglich direkt in der App anpassen!

---

## ⌨️ Tastatur- & Bluetooth-NumPad-Shortcuts

(Aktiv/deaktivierbar in **⚙️ Einstellungen**; in Suchfeldern und Dialogen automatisch pausiert)

| Taste | Aktion |
| :--- | :--- |
| `Leertaste` | **■ STOP** (3 s Fade-Out) · **2× schnell = 80 ms Hard-Cut** |
| `A` / `B` | **Ass** (`_ACE`) / **Block** (`_BLOCK`) |
| `E` / `G` | **Eigene Punkte (Zufall)** / **Gegnerpunkte (Zufall)** |
| `T` / `W` | **Timeout** (30s Timer) / **Walk-On** |
| `6` / `7` | **6 / 7 Matchday Hype** |
| `1` – `4` | **Pausensongs 1 bis 4** |
| `S` / `U` | **SFX-Pop-up** öffnen/schließen / **Warm-Up Auto-Play** umschalten |
| `↑` / `↓` | **Master-Lautstärke** ±5 % |
| `/` | **Songsuche** fokussieren |

---

## 📖 Bedienung im Überblick

1. **Songs & Effekte laden:** Im Kopfbereich auf **📁 Songs laden / Ordner auswählen** klicken (Unterordner `effekte/` wird automatisch erkannt) oder Dateien per Drag & Drop ablegen. Über **✨ Demo-Sounds** lässt sich sofort ein 18-teiliges Test-Set laden.
2. **Abspielen & Spulen:** Ein Tipp startet den Song sofort; auf dem spielenden Button läuft unten der Fortschrittsbalken mit. Ein Klick auf **Aktuell läuft** (oder die kompakte Pill bei eingeklapptem Kopf) öffnet das Spul- & Lautstärke-Pop-up.
3. **Einstellungen & Backup (`⚙️`):** Enthält Design-Themes, Bluetooth-Wachhalter, Mini-Spielstand, Shortcut-Toggle, JSON-Backup-Export/Import, eingebaute Spickzettel (`⌨️` & `📖`), App-Update-Check (`🔄`) sowie die geschützte Gefahrenzone (`Reset` / `🗑 Leeren`).

---

## 🧪 Tests & Qualitätssicherung

```bash
npm test
```

Getestet werden u. a.:
- Suffix- & Unterordner-Erkennung (`effekte/`, `_SFX`, `_ACE`, `_HIT`, `_BLOCK`, `_OPP`, `_PAUSE1..4`, etc.) & `pinned`-Sortierung
- IndexedDB & Memory Storage Engine (inkl. `updateTrackMeta`, `deleteTrack`, `updateTrackGain`)
- Web Audio Pipeline: RMS-Lautstärke-Angleichung, 5-Preset-EQ, Hard-Cut STOP, Bluetooth-Wachhalter, AnalyserNode-Telemetrie & One-Shot SFX-Overlay-Bus
- Spieltags-Controller: Timeout/Pause-Countdowns, Warm-Up Auto-Play, Song-Kontextmenü, Tastatur-Shortcuts, JSON-Backup und button-gekoppelter Minimal-Spielstand inkl. Vertipper-Korrektur & Crunch-Time
- 3 Themes (`classic`, `m3-expressive`, `light-hall`), native `<dialog>`-Overlays & Offline-Service-Worker
