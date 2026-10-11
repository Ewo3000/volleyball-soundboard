# Spezifikation: Erweiterung Aktionsleiste, Pausebuttons, Sanduhr & Pulsierender Button

**Datum:** 2026-10-11  
**Status:** Genehmigt (Approved)  
**Zielanwendung:** SV 1845 Esslingen – Volleyball DJ Soundboard  

---

## 1. Übersicht & Zielsetzung

Die Benutzeroberfläche des Volleyball DJ Soundboards wird um zentrale Ergonomie- und Feedback-Elemente erweitert:
1. **Minimierter Abstand zwischen Mediathek und Aktionsleiste:** Überführung der Aktionsleiste in das natürliche Flexbox-Layout und Reduktion des Abstands auf ein Minimum.
2. **50 % vergrößerte Aktionsbuttons:** Vergrößerung der Button-Höhe auf `clamp(108px, 14vh, 140px)` für maximale Treffsicherheit bei Spieltag-Einsätzen.
3. **Dreizeiliger Textumbruch für Aktionsbuttons:** Falls Beschriftungen horizontal nicht in den Button passen, brechen sie dynamisch in bis zu drei Zeilen um.
4. **Pausebuttons ausgeschrieben & verdoppelt:** Beschriftung mit `Pause 1` bis `Pause 4` und Verdopplung der Buttonbreite.
5. **Sanduhr-Overlay über der Mediathek:** Bei Wiedergabe eines Pausensongs legt sich ein animiertes Sanduhr-Overlay über die 7 Spalten der Mediathek, bis der Song endet oder STOP gedrückt wird.
6. **Pulsierende Animation des aktiven Buttons:** Jeder angetippte Button (Aktionsleiste oder Mediathek) pulsiert synchron während des Abspielens mit der bestehenden Neon-Glow-Animation.

---

## 2. Detaillierte Anforderungen & Architektur

### 2.1 Layout & Größenanpassungen
- **Positionierung der Aktionsleiste (`#quick-actions-bar`):**
  - Vorher: `position: fixed; bottom: 0;` mit `padding-bottom: 136px` auf `#columns-grid`.
  - Neu: `position: relative; flex-shrink: 0;` im vertikalen Flex-Layout (`.app-container`).
  - `#columns-grid` erhält minimales `padding-bottom: 6px`.
  - Der Leerraum zwischen Mediathek und Aktionsleiste wird dadurch eliminiert.
- **Button- und Leistengröße (+50 %):**
  - `#quick-actions-bar`: `min-height: clamp(130px, 17vh, 160px);`
  - `.quick-btn`, `.pause-slot-btn`, `.btn-stop`: `height: clamp(108px, 14vh, 140px);`

### 2.2 Dreizeilige Buttontexte
- In `.quick-btn`, `.btn-main-text` und `.btn-subtext`:
  - `white-space: normal` mit `word-break: break-word` und flexibler Zentrierung.
  - Textzeilen können bei Bedarf bis zu 3 Zeilen umbrechen (z. B. `🏐 Ass` / `(Eigenes` / `Team)` oder `⚡ Eigene` / `Punkte` / `(Zufall)`).
  - Vertikaler Raum in den vergrößerten Buttons bietet genügend Platz, ohne dass Text übersteht (`overflow: hidden; text-overflow: ellipsis;`).

### 2.3 Pausebuttons
- **Beschriftung:**
  - `P1`, `P2`, `P3`, `P4` in `index.html` und `js/app.js` werden ersetzt durch:
    - `Pause 1`
    - `Pause 2`
    - `Pause 3`
    - `Pause 4`
- **Breite:**
  - `.pause-slot-btn` wird in der Mindestbreite verdoppelt:
    `min-width: clamp(56px, 6vw, 90px);` (vorher `clamp(26px, 2.8vw, 42px)`).
  - Die 4 Pausebuttons passen sich harmonisch an die Gruppe an.

### 2.4 Sanduhr-Overlay über der Mediathek (`#pause-overlay`)
- **DOM-Struktur:**
  - Platziert innerhalb von `#board-container`:
    ```html
    <div id="pause-overlay" class="pause-overlay" aria-hidden="true" style="display: none;">
      <div class="pause-overlay-content">
        <div class="pause-hourglass-icon">⏳</div>
        <div class="pause-overlay-title">Satzpause</div>
        <div class="pause-track-name" id="pause-overlay-track-name">Pausensong läuft...</div>
        <div class="pause-overlay-hint">Musik stoppen über ■ STOP</div>
      </div>
    </div>
    ```
- **Styling (`css/app.css`):**
  - `position: absolute; inset: 0; background: rgba(11, 15, 23, 0.88); backdrop-filter: blur(8px);`
  - `display: flex; align-items: center; justify-content: center; z-index: 400;`
  - Sanftes Ein- und Ausblenden (`opacity`, `transition: 0.3s ease`).
  - Sanduhr-Icon: Animierte Kipp- und Rieselbewegung (`@keyframes hourglass-rotate`).
  - Aktionsleiste unten bleibt vollständig sichtbar und klickbar.
- **Logik (`js/app.js`):**
  - Wird eingeblendet (`showPauseOverlay(track)`), wenn ein Pausensong abgespielt wird (`playPauseSlot`, `btn-mobile-pause` oder Song aus Kategorie `pause`).
  - Wird ausgeblendet (`hidePauseOverlay()`), wenn Audio stoppt (`onTrackStop`, `onTrackEnd`, `stopAudio()`) oder ein anderer Song gestartet wird.

### 2.5 Pulsierende Animation des gedrückten Buttons
- **Logik (`js/app.js`):**
  - Variable `activeTriggerButtonElement` speichert die Referenz auf den zuletzt angetippten Button.
  - Wenn `handlePlayTrack(track, triggerElement)` aufgerufen wird:
    - Vorheriger Trigger-Button verliert `.is-playing` und `.playing`.
    - Neuer Trigger-Button erhält `.is-playing` und `.playing`.
    - Bei `onTrackStop` und `onTrackEnd` werden alle `.is-playing` / `.playing` Klassen entfernt.
- **Styling (`css/app.css`):**
  - `.quick-btn.is-playing`, `.mobile-quick-btn.is-playing` und `.pause-slot-btn.is-playing` nutzen dieselbe Keyframe-Animation:
    `animation: pulse-playing-glow 1.4s infinite ease-in-out;`
    mit leuchtendem blauem Rand (`border-color: #60A5FA;`) und dunklem Aktiv-Hintergrund (`#172554;`).

---

## 3. Test- & Verifizierungsstrategie

1. **Unit- & Integrationstests (`tests/action-bar-pause.test.js`):**
   - Prüfen, dass `#pause-overlay` in `index.html` vorhanden ist.
   - Prüfen, dass die Pause-Buttons mit `Pause 1` bis `Pause 4` beschriftet sind.
   - Prüfen, dass CSS-Klassen für 3-zeiligen Text und verdoppelte Pause-Button-Breite definiert sind.
   - Prüfen, dass die Aktionsbutton-Höhe um 50 % vergrößert wurde (`>= 108px`).
   - Prüfen, dass `showPauseOverlay` und `hidePauseOverlay` das Overlay korrekt steuern.
   - Prüfen, dass Trigger-Buttons die Klasse `is-playing` erhalten.
2. **Regressionstests:**
   - Alle bisherigen 84 Tests in `tests/*.test.js` müssen weiterhin erfolgreich durchlaufen.
3. **PWA- & Versions-Update:**
   - Version auf `1.5.0` in `version.json` und `sw.js` anheben.
