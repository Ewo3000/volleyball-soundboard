# Design-Spezifikation: Volleyball DJ-Pult für den SV 1845 Esslingen

* **Datum:** 10. Oktober 2026
* **Status:** Freigegeben durch Benutzer
* **Zielgruppe:** Hallensprecher, DJs und Betreuer der Volleyball-Spiele des SV 1845 Esslingen e.V.
* **Zielgeräte:** Primär Android-Tablets im Querformat (Bluetooth-Lautsprecher-Ausgabe), sekundär Smartphones im Hochformat.

---

## 1. Übersicht & Zielsetzung

Entwicklung einer modernen, reaktionsschnellen und 100 % offline-fähigen Web-App (PWA) als Soundboard/DJ-Pult für Volleyballspiele des **SV 1845 Esslingen**.

Die App ersetzt bisherige starre Soundboards durch ein modernes, touch-optimiertes Interface mit:
- Direkter Ordner-Import-Möglichkeit und dauerhafter lokaler Speicherung aller Audiodateien in der Browserdatenbank (**IndexedDB**).
- Automatischer Erkennung und Sortierung der Songs nach Dateinamens-Endungen (`_HIT`, `_BLOCK`, `_FUN`, etc.).
- Latenzfreier Web-Audio-Engine mit sanftem Überblenden und Stop-Fadeout.
- Speziellem Smartphone-Portrait-Modus (reduziertes Quick-Action-Pad für einhändige Bedienung).
- Screen Wake Lock, damit das Tablet während des Spiels nicht in den Standby schaltet.
- Einfacher Bereitstellung über **GitHub Pages**.

---

## 2. Vereins-Branding & Farbwelt (SV 1845 Esslingen)

Das Design basiert auf dem offiziellen Vereinslogo (schwarzer Esslinger Reichsadler, Volleyball mit roten Flammen, SV 1845 Esslingen Schriftzug):

* **Hintergrund:** Edles Deep-Slate / Dark-Navy (`#0B0F17`, `#121824`) für blendfreie Hallennutzung und hohen Kontrast.
* **Primärfarbe (Vereinsblau):** `#1B75BC` (Esslinger Königsblau) für Header-Akzente, aktive Zustände und Walk-On.
* **Akzentfarbe (Flammenrot):** `#E53935` (vom brennenden Volleyball) für Stop-Button, Gegner-Kategorie und wichtige Warnhinweise.
* **Spalten-Farbschema (Kategorien):**
  - **Ass / Angriff:** Blau (`#1E88E5` / `#1565C0`)
  - **Block:** Magenta / Pink (`#D81B60` / `#C2185B`)
  - **Gegner:** Rot (`#E53935` / `#C62828`)
  - **Sonstiges 1, 2, 3:** Einheitliches Smaragdgrün (`#2E7D32` / `#1B5E20`)
  - **Spaß & Extras:** Violett / Lila (`#8E24AA` / `#6A1B9A`)
* **Schnellzugriff-Farben:**
  - **Timeout:** Sonnengelb / Amber (`#F59E0B`)
  - **Walk-On:** Vereinsblau (`#1B75BC`)
  - **Pausensongs:** Slate / Dunkelblau (`#334155`)
  - **6/7:** Auffälliges Orange (`#EA580C`)
  - **Zufall (Eigene/Gegner):** Indigo / Petrol (`#4338CA` / `#3730A3`)
  - **Stop:** Signalrot (`#DC2626`) mit Stopp-Icon

---

## 3. Benutzeroberfläche & Responsive Layouts

### 3.1 Tablet-Modus (Querformat $\ge 768\text{ px}$)

1. **Header-Leiste:**
   - **Kopfbereich-Umschalter („Kopf ein / aus“):**
     - *Eingeklappt:* Nur die kompakte Steuerungsleiste ist sichtbar (maximale Höhe für Song-Buttons).
     - *Ausgeklappt:* Logo des SV 1845 Esslingen, Titel *„DJ-Pult SV 1845 Esslingen“*, Ordner-Import-Button (`📁 Songs laden`), Bibliothek-Status (*„112 Songs geladen“*).
   - **Zoom-Regler:** `- / 100% / +` zur Skalierung der Benutzeroberfläche (70% bis 120%), um auf jedem Tablet-Display perfekt randlos zu sitzen.
   - **Echtzeit-Suchfeld:** Sucht live über alle Spalten; Treffer leuchten auf, andere Buttons werden abgedunkelt; Trefferzähler (`x Treffer`).
   - **Master-Lautstärkeregler:** Schieberegler mit optischer Prozentanzeige.
   - **Reset-Button:** Setzt alle Zähler gespielter Lieder auf 0 zurück (mit kurzer Bestätigung).
   - **Vollbild-Button:** Schaltet per Fullscreen API in den rahmenlosen Vollbildmodus.

2. **Hauptbereich (7-Spalten Grid):**
   - 7 nebeneinanderliegende Spalten: *Ass/Angriff, Block, Gegner, Sonstiges 1, Sonstiges 2, Sonstiges 3, Spaß & Extras*.
   - Jede Spalte hat einen Header mit Titel und Track-Anzahl.
   - Song-Buttons:
     - Großer, gut lesbarer Songtitel (bereinigt von Endungen und Unterstrichen).
     - Zähler-Badge (`0`, `1`, `2` etc.), um Wiederholungen zu vermeiden.
     - Visueller Indikator (Glow/Pulsieren), wenn der Song aktuell abgespielt wird.

3. **Footer (Schnellzugriffsleiste):**
   - Feste Position am unteren Bildschirmrand.
   - `Timeout` (Gelb) & `Walk-On` (Blau) links.
   - `Pausensongs` (4 feste Slots) in der Mitte-Links.
   - `6/7` (Orange) in der Mitte prominent platziert.
   - `Eigene Punkte (Zufall)` & `Gegnerpunkte (Zufall)` in der Mitte-Rechts.
   - `STOP` (Groß, Signalrot mit Stopp-Icon) rechts.

---

### 3.2 Smartphone-Modus (Hochformat $< 768\text{ px}$)

* **Reduzierte Ansicht:** Die 7 Spalten werden im Hauptbildschirm ausgeblendet.
* **Fokus auf Quick-Actions:** Große, daumenfreundliche Buttons:
  - `Eigene Punkte (Zufall)` & `Gegnerpunkte (Zufall)`
  - `Timeout`, `Walk-On`, `6/7`
  - `Pausensongs` Dropdown / Quick-Buttons
  - Riesiger `STOP`-Button
  - Master-Lautstärke & Schnellsuche
* **Button „Alle Songs & Kategorien“:**
  - Öffnet eine Vollbild-Modalansicht / Drawer.
  - Kategorien sind als übersichtliche Akkordeon-Gruppen oder Tabs dargestellt.
  - Schnelle Suche und direktes Antippen jedes einzelnen Titels.

---

## 4. Dateiverwaltung & Suffix-Erkennung

### 4.1 Dateiformate
Unterstützt gängige Browser-Audioformate: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.aac`, `.flac`.

### 4.2 Suffix-Regeln (case-insensitive)
Die Dateinamen werden am Ende des Basenamens (vor der Erweiterung) analysiert:

| Namensmuster | Ziel-Kategorie / Button | Beispiel-Dateiname |
|---|---|---|
| `*_HIT.*`, `*_ANGRIFF.*`, `*_ASS.*` | Spalte: Ass / Angriff | `Super_Spike_HIT.mp3` |
| `*_BLOCK.*` | Spalte: Block | `Axel_F_BLOCK.mp3` |
| `*_GEGNER.*`, `*_OPPONENT.*` | Spalte: Gegner | `Stereo_Hearts_GEGNER.mp3` |
| `*_SONSTIGES1.*`, `*_MISC1.*` | Spalte: Sonstiges 1 | `Played_A_Live_SONSTIGES1.mp3` |
| `*_SONSTIGES2.*`, `*_MISC2.*` | Spalte: Sonstiges 2 | `Im_Good_SONSTIGES2.mp3` |
| `*_SONSTIGES3.*`, `*_MISC3.*` | Spalte: Sonstiges 3 | `Better_Off_Alone_SONSTIGES3.mp3` |
| `*_FUN.*`, `*_SPASS.*` | Spalte: Spaß & Extras | `Ned_schlecht_FUN.mp3` |
| `*_TIMEOUT.*` | Schnellzugriff: Timeout | `Time_Out_1_TIMEOUT.mp3` |
| `*_WALKON.*`, `*_EINLAUF.*` | Schnellzugriff: Walk-On | `Intro_Theme_WALKON.mp3` |
| `*_PAUSE.*`, `*_PAUSENSONG.*` | Schnellzugriff: Pausensongs | `Blue_PAUSE.mp3` |
| `*_SIXSEVEN.*`, `*_67.*` | Schnellzugriff: 6/7 | `Seven_Nation_Army_SIXSEVEN.mp3` |

*Hinweis:* Dateien ohne passendes Suffix werden automatisch in *Sonstiges 1* eingeordnet, sodass kein Song verloren geht.

### 4.3 Bereinigung der Button-Beschriftung
- Entfernen der Dateierweiterung (`.mp3`, `.wav` etc.).
- Entfernen des Suffixes (`_HIT`, `_BLOCK` etc.).
- Ersetzen von Unterstrichen `_` und doppelten Leerzeichen durch einfache Leerzeichen.
- Beispiel: `Drop_That_Low_HIT.mp3` $\rightarrow$ `Drop That Low`.

### 4.4 Offline-Speicherung (IndexedDB)
- **Datenbank:** `SV1845_DJ_DB` (Version 1).
- **Object Store `tracks`:** Speichert Track-Metadaten (`id`, `name`, `cleanTitle`, `category`, `suffix`, `playCount`, `lastPlayed`) und die Audiodaten als `Blob`.
- **Object Store `settings`:** Speichert Lautstärke, Zoomstufe, Header-Zustand.
- **Persistenz:** Einmaliges Einlesen genügt; Songs stehen bei jedem Spiel auch ohne Internetverbindung zur Verfügung.

---

## 5. Audio-Engine & Wiedergabelogik

### 5.1 Web Audio API Pipeline
```
[AudioBuffer / HTMLAudioElement]
         │
         ▼
    [GainNode] (Lautstärke + Fade-Automation)
         │
         ▼
[AudioContext.destination] ──► (Bluetooth-Lautsprecher / Audioausgang)
```

### 5.2 Fade- und Transition-Verhalten
- **Titelwechsel:**
  - Ein Klick auf einen neuen Song löst einen extrem schnellen 50ms-Fadeout des vorherigen Titels aus (`linearRampToValueAtTime`), um Audio-Klicks/Pops im Lautsprecher zu unterbinden.
  - Der neue Titel startet sofort mit einem 20ms-Micro-Fadein auf die Ziel-Lautstärke.
- **Stop-Button:**
  - Sanfter 300ms-Fadeout (`exponentialRampToValueAtTime`), gefolgt vom Anhalten der Wiedergabe.
- **Master-Volume:**
  - Direkte Steuerung des zentralen Master-`GainNode`.

### 5.3 Intelligente Zufallswiedergabe (Random Engine)
- **Eigene Punkte (Zufall):** Wählt zufällig aus allen Tracks der Kategorie *Ass/Angriff* (oder *Sonstiges*). Bevorzugt Titel mit `playCount == 0`, um musikalische Wiederholungen zu minimieren.
- **Gegnerpunkte (Zufall):** Wählt zufällig aus der Kategorie *Gegner* (Durchatmen / Beruhigen).
- **Zähler:** Bei jedem Start erhöht sich der `playCount` des Titels um $+1$, der Button aktualisiert seine Badge in Echtzeit.

---

## 6. Geräte-Integration & PWA-Funktionen

1. **Screen Wake Lock API:**
   - Hält den Bildschirm während der Spielzeit dauerhaft aktiv (`navigator.wakeLock.request('screen')`).
   - Bei Tab-Wechsel oder Minimierung wird der Wake Lock beim Zurückkehren automatisch reaktiviert.
2. **Progressive Web App (PWA):**
   - `manifest.webmanifest`: App-Name *„SV 1845 DJ-Pult“*, Theme-Farbe `#0B0F17`, Icons (SV 1845 Esslingen Logo), `display: "standalone"`, `orientation: "any"`.
   - `sw.js` (Service Worker): Cacht alle statischen App-Dateien (HTML, CSS, JS, Icons) für 100 % Offline-Verfügbarkeit.
3. **Touch-Optimierung:**
   - `touch-action: manipulation` auf allen Buttons zur Verhinderung der 300ms Klickverzögerung auf Touchgeräten.
   - Textauswahl und Zoom-Gesten deaktiviert (`user-select: none`).

---

## 7. Projektstruktur & GitHub Pages Deployment

```
/
├── index.html                 # Hauptseite (Responsive Layout, Tablet & Mobile Ansichten)
├── manifest.webmanifest       # PWA Manifest für Installation auf dem Android-Tablet
├── sw.js                      # Service Worker für Offline-Caching
├── css/
│   └── app.css                # Modernes Dark-UI, Glassmorphism, Vereinsfarben, Responsiveness
├── js/
│   ├── app.js                 # App-Initialisierung, UI-Event-Handling, Responsive Toggle
│   ├── audio-engine.js        # Web Audio API, Fades, Volume, Playback-State
│   ├── db.js                  # IndexedDB Speicher für Audio-Blobs und Metadaten
│   ├── file-loader.js         # Ordner-Auswahl, Suffix-Parser, Blob-Konvertierung
│   └── wake-lock.js           # Screen Wake Lock Manager
└── assets/
    ├── logo.png               # SV 1845 Esslingen Vereinslogo
    └── icons/                 # PWA Icons in verschiedenen Größen (192x192, 512x512)
```

* **Bereitstellung auf GitHub Pages:**
  - Da die Web-App vollständig statisch ist, kann das Repository direkt unter *Settings $\rightarrow$ Pages* auf den `main`-Branch geschaltet werden.
  - Zugriff unter: `https://<github-user>.github.io/<repo-name>/`.
  - Auf dem Android-Tablet im Chrome-Browser aufrufen $\rightarrow$ *„Zum Startbildschirm hinzufügen“* tippen $\rightarrow$ Fertig.

---

## 8. Verifikations- & Testkriterien

1. **Dateierkennung & Suffixe:**
   - Werden Dateien mit `_HIT`, `_BLOCK`, `_GEGNER`, `_SONSTIGES1..3`, `_FUN`, `_TIMEOUT`, `_WALKON`, `_PAUSE`, `_SIXSEVEN` korrekt den jeweiligen Spalten/Buttons zugeordnet?
   - Werden Dateinamen optisch sauber formatiert dargestellt?
2. **Offline-Persistenz:**
   - Bleiben die geladenen Songs nach dem Schließen und erneuten Öffnen des Browsers ohne Neu-Laden erhalten?
3. **Audio-Wiedergabe & Bluetooth:**
   - Starten Songs ohne merkliche Latenz?
   - Stoppt ein neuer Klick den laufenden Song ohne Knacken (50ms Fade)?
   - Funktioniert die Stop-Taste mit weichem 300ms Fadeout?
4. **Responsive Ansichten:**
   - Tablet Querformat: Werden alle 7 Spalten und der Footer vollständig und übersichtlich dargestellt?
   - Smartphone Hochformat: Schaltet die App zuverlässig in die kompakte Ansicht mit Quick-Actions und „Alle Songs“-Drawer um?
5. **Wake Lock:**
   - Bleibt der Tablet-Bildschirm auch nach mehreren Minuten ohne Berührung eingeschaltet?
