<!-- coderabbit-ai-generated:v1 -->

# Skyline: Web of the City

Ein eigenständiges 3D-Fanspiel mit einer frei erkundbaren Stadt, zwei Netzen, Dachlandungen, Wandklettern, Missionen und freischaltbaren Anzügen. Three.js zeichnet die Welt mit WebGL 2. Ohne WebGL 2 zeichnet ein einfacherer Software-Renderer dieselbe Stadt und verwendet dieselbe Spielmechanik. Quellcode, Geometrie, Texturen und erzeugter Klang sind im Projekt enthalten; im Spiel sind keine externen Dienste nötig.

## Lokal starten

Node.js 24 verwenden und im Projektordner ausführen:

```sh
npm ci
npm run dev
```

Vite zeigt die lokale URL an. Mit `npm test` werden Bewegung, Netze, Wandklettern, Kollision und Missionszustände geprüft. `npm run build` erstellt die statische Website in `dist/`. Sie verwendet relative Pfade und kann auch in einem Unterordner liegen.

## Steuerung

| Aktion | Eingabe |
| --- | --- |
| Bewegen, sprinten | WASD, Shift |
| Springen, Luftrolle, Netzabsprung | Leertaste |
| Links und rechts schwingen | Linke und rechte Maustaste halten und loslassen |
| Umsehen | Mittlere Maustaste ziehen oder Pfeiltasten |
| Klettern | Gegen eine Wand laufen, Shift für schnelleres Klettern |
| Interagieren, ausweichen | E, Q |
| Schlagen, treten | X, V |
| Netzangriff und Spezialimpuls | R, F |
| Kamera, Missionen, Pause | C, M, Esc |

Auf Geräten mit Touch werden Tasten eingeblendet. Ziehen auf der Spielfläche dreht die Kamera. Erfahrung, abgeschlossene Missionen, ausgewählter Anzug und Einstellungen werden lokal im Browser gespeichert.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7828a554302cd5740db1cc1657fd0a3ebcd5a826f8eab179fadb71a6172fc011 -->

## GitHub Pages

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f9fe010f6cd0a8641f40d6397abbcdb1b5c1a3bce89efd27aa52d32ce6b2eecf -->

Der fertige Website-Build liegt im Ordner `docs/`. Zum Veröffentlichen unter **Settings → Pages → Build and deployment → Source** die Option **Deploy from a branch**, den Branch `coderabbit/create-web-game/3586f141` und den Ordner `/docs` auswählen und speichern. Nach Änderungen am Spiel `npm ci`, `npm test` und `npm run build:pages` ausführen und die Änderungen in `docs/` mit committen. Falls später ein anderer Branch veröffentlicht werden soll, die Pages-Einstellungen entsprechend anpassen.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->
