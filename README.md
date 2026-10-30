# Arcade

Eine Spielhalle im Browser. Neun selbst gebaute Spiele, alle direkt spielbar,
nichts zu installieren.

**→ [felikopta.github.io/Arcade](https://felikopta.github.io/Arcade/)**

## Worum es geht

Jede Woche kommt ein Spiel dazu, und jedes bringt eine Technik mit, die im
vorigen noch nicht nötig war — Kollisionserkennung, Wegfindung, Physik,
Spielbaum-Suche, Rendering ohne 3D-Bibliothek.

Gebaut ohne Engine und ohne Framework: Canvas 2D und TypeScript. Alle Spiele
teilen sich dieselbe Game-Shell mit festem Zeitschritt — die Logik läuft
deshalb auf jedem Gerät exakt gleich schnell, egal ob der Bildschirm 30 oder
144 Bilder pro Sekunde zeichnet.

Die Seite ist statisch und kommt ohne Server und ohne Datenbank aus. Sie setzt
keine Cookies, lädt nichts von fremden Servern und zeichnet nichts auf.
Spielstände und Highscores bleiben im Browser.

## Die Spiele

| Spiel | Die Technik dahinter | |
|---|---|---|
| Cookie Clicker | Offline-Fortschritt, sehr große Zahlen | in Arbeit |
| Breakout | Kreis-Rechteck-Kollision | geplant |
| Market Sim | Angebot und Nachfrage, die sich einpendeln | geplant |
| Tetris | SRS, 7-Bag, Lock-Delay | geplant |
| Tower Defense | Flow-Field per Breitensuche | geplant |
| Minesweeper | Constraint-Solver, immer lösbar ohne Raten | geplant |
| Verlet-Puzzle | Verlet-Integration, Seile und Tücher | geplant |
| Raycaster | DDA und Projektion, 3D ohne 3D-Engine | geplant |
| Ultimate Tic-Tac-Toe | Minimax mit Alpha-Beta-Pruning | geplant |

## Technik

TypeScript · Canvas 2D · Vite · Vitest · GitHub Pages
