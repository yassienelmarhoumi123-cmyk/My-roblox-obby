# Die Villa – Online-Koop (reparierte Version)

## Auf GitHub Pages veröffentlichen

1. Lade den Inhalt des Projekt-ZIPs in den Stammordner deines Repositorys hoch.
2. `index.html` muss direkt neben dem Ordner `assets/` liegen.
3. Aktiviere GitHub Pages unter **Settings → Pages** für `main` und `/root`.
4. Öffne die veröffentlichte Seite über HTTPS.

## Gemeinsam spielen

1. Ein Spieler klickt auf **Raum erstellen** und teilt den angezeigten Raumcode.
2. Die anderen geben den Code ein und klicken **Beitreten**.
3. Der Beitritt ist erst abgeschlossen, wenn der Host ihn bestätigt. Danach kann jeder PC oder Handy starten.
4. Schlüssel, Sicherungen und Tagebuchseiten werden für das ganze Team gezählt. Andere Spieler erscheinen als 3D-Figuren mit Namen.

Der Host muss den Tab offen lassen. Bis zu 6 Spieler können einem Raum beitreten.

## Netzwerk und Fehlersuche

Das Spiel verwendet PeerJS 1.5.5 und WebRTC. PeerJS vermittelt den Verbindungsaufbau; danach werden Spielpositionen und Fortschritt direkt zwischen den Browsern übertragen. Die Seite muss über HTTPS geöffnet werden. Browser und Netzwerk müssen PeerJS Cloud sowie WebRTC-Datenverbindungen zulassen. In stark eingeschränkten Netzwerken kann eine Verbindung trotz korrektem Code scheitern.

Die reparierte Version zeigt bei Zeitüberschreitungen und Verbindungsfehlern konkrete Meldungen und setzt den Verbindungszustand zurück, damit ein neuer Versuch möglich ist.

## Spieler-Modell

`assets/gavin/Gavin.fbx` und `assets/gavin/textures/` sind im Projekt-ZIP enthalten. Der Ordner `assets/` muss beim Upload mit hochgeladen werden, sonst verwendet das Spiel seinen eingebauten einfachen 3D-Ersatzavatar.

## Dateien

- `index.html` – das Spiel
- `assets/gavin/Gavin.fbx` – das 3D-Spielermodell
- `assets/gavin/textures/` – Texturen für das Modell
