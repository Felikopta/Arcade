/**
 * Der Katalog. Eine Zeile pro Spiel - der Hub baut daraus die Karten,
 * der Router weiss daraus, was er laden darf.
 *
 * Neues Spiel fertig? status auf "ready" setzen und in loaders unten eintragen.
 */

import type { Game } from "../shell/loop";

export type GameStatus = "ready" | "next" | "soon";
export type GameKind = "ts" | "unity";

export interface GameEntry {
  id: string;
  title: string;
  /** "KW46", "Ferien", "Jän" */
  week: string;
  dates: string;
  status: GameStatus;
  kind: GameKind;
  /** ein Satz, der neugierig macht */
  tagline: string;
  /** was daran technisch neu war */
  tech: string;
  /** Akzentfarbe der Karte, passend zur Seepalette */
  accent: string;
  /** nur fuer kind "unity": Ordner unter public/games/ */
  build?: string;
}

export const GAMES: GameEntry[] = [
  {
    id: "cookieclicker",
    title: "Cookie Clicker",
    week: "KW45",
    dates: "2.–8. Nov",
    status: "next",
    kind: "unity",
    tagline: "Ein Klick, dann zehn, dann rechnet die Zeit für dich weiter.",
    tech: "Offline-Fortschritt, Zahlen die sehr groß werden",
    accent: "#d98b3f",
    build: "cookieclicker",
  },
  {
    id: "breakout",
    title: "Breakout",
    week: "KW46",
    dates: "9.–15. Nov",
    status: "soon",
    kind: "ts",
    tagline: "Ein Ball, eine Wand, und die Frage, wo genau er aufkommt.",
    tech: "Kreis-Rechteck-Kollision",
    accent: "#e07a4f",
  },
  {
    id: "marketsim",
    title: "Market Sim",
    week: "KW47",
    dates: "16.–22. Nov",
    status: "soon",
    kind: "unity",
    tagline: "Angebot, Nachfrage, und ein Markt der sich selbst einpendelt.",
    tech: "Unity-WebGL auf die Seite bringen",
    accent: "#7d6aa8",
    build: "marketsim",
  },
  {
    id: "tetris",
    title: "Tetris",
    week: "KW48",
    dates: "23.–29. Nov",
    status: "soon",
    kind: "ts",
    tagline: "Sieben Steine, die nie zufällig kommen, auch wenn es so wirkt.",
    tech: "SRS, 7-Bag, Lock-Delay",
    accent: "#4a7fb5",
  },
  {
    id: "towerdefense",
    title: "Tower Defense",
    week: "KW49",
    dates: "30. Nov–6. Dez",
    status: "soon",
    kind: "ts",
    tagline: "Hundert Gegner suchen denselben Weg — und finden ihn sofort.",
    tech: "Flow-Field per Breitensuche",
    accent: "#4e8f6d",
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    week: "KW50",
    dates: "7.–13. Dez",
    status: "soon",
    kind: "ts",
    tagline: "Jedes Feld ist lösbar. Raten ist nie nötig, das garantiert der Generator.",
    tech: "Constraint-Solver, Seed-Zufall",
    accent: "#c75f55",
  },
  {
    id: "verlet",
    title: "Verlet-Puzzle",
    week: "KW51",
    dates: "14.–20. Dez",
    status: "soon",
    kind: "ts",
    tagline: "Seile und Tücher, die sich bewegen wie echte — aus einer Formel.",
    tech: "Verlet-Integration, Strecken-Schnitt",
    accent: "#d9a94a",
  },
  {
    id: "raycaster",
    title: "Raycaster",
    week: "Ferien",
    dates: "24. Dez–6. Jän",
    status: "soon",
    kind: "ts",
    tagline: "3D, ohne eine einzige 3D-Bibliothek. Wie 1992.",
    tech: "DDA, Projektion, Texturen",
    accent: "#b05f8a",
  },
  {
    id: "rts",
    title: "RTS + Ultimate Tic-Tac-Toe",
    week: "Jän",
    dates: "ab 7. Jänner",
    status: "soon",
    kind: "unity",
    tagline: "Eine KI, die drei Züge weiter denkt als sie müsste.",
    tech: "Minimax mit Alpha-Beta",
    accent: "#8a6a4a",
    build: "rts",
  },
];

export function byId(id: string): GameEntry | undefined {
  return GAMES.find((g) => g.id === id);
}

export function playable(): GameEntry[] {
  return GAMES.filter((g) => g.status === "ready");
}

/**
 * Hier landen die fertigen TypeScript-Spiele. Der Hub laedt sie erst,
 * wenn jemand die Karte anklickt - die Startseite bleibt dadurch leicht,
 * auch wenn hier spaeter neun Eintraege stehen.
 *
 * Beispiel, sobald Breakout fertig ist:
 *   breakout: () => import("../games/breakout"),
 */
export const loaders: Record<string, () => Promise<{ default: new () => Game }>> = {};
