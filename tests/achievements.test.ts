import { beforeEach, describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  achievementStore,
  isUnlocked,
  markPlayed,
  onUnlock,
  progress,
  unlock,
} from "../src/shell/achievements";
import { getScore, scores, submitScore } from "../src/shell/save";

beforeEach(() => {
  achievementStore.reset();
  achievementStore.save({ unlocked: {}, played: [] });
  scores.reset();
  scores.save({});
});

describe("Erfolge", () => {
  it("hat keine doppelten ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("meldet nur beim ersten Mal einen neuen Erfolg", () => {
    expect(unlock("arcade.first-visit")).toBe(true);
    expect(unlock("arcade.first-visit")).toBe(false);
    expect(isUnlocked("arcade.first-visit")).toBe(true);
  });

  it("ignoriert unbekannte ids", () => {
    expect(unlock("gibt.es.nicht")).toBe(false);
    expect(progress().done).toBe(0);
  });

  it("benachrichtigt Zuhoerer genau einmal", () => {
    const seen: string[] = [];
    const off = onUnlock((a) => seen.push(a.id));

    unlock("arcade.first-visit");
    unlock("arcade.first-visit");
    off();
    unlock("arcade.first-play");

    expect(seen).toEqual(["arcade.first-visit"]);
  });

  it("zaehlt den Fortschritt gegen die Gesamtzahl", () => {
    unlock("arcade.first-visit");
    expect(progress()).toEqual({ done: 1, total: ACHIEVEMENTS.length });
  });

  it("schaltet 'Spielhalle' erst beim dritten verschiedenen Spiel frei", () => {
    markPlayed("breakout", 9);
    markPlayed("breakout", 9);
    expect(isUnlocked("arcade.three-games")).toBe(false);

    markPlayed("tetris", 9);
    markPlayed("minesweeper", 9);
    expect(isUnlocked("arcade.three-games")).toBe(true);
  });

  it("schaltet 'Komplettist' frei, wenn alle Spiele dran waren", () => {
    markPlayed("breakout", 2);
    expect(isUnlocked("arcade.all-games")).toBe(false);
    markPlayed("tetris", 2);
    expect(isUnlocked("arcade.all-games")).toBe(true);
  });

  it("vergibt 'Komplettist' nicht ohne Spiele im Katalog", () => {
    markPlayed("breakout", 0);
    expect(isUnlocked("arcade.all-games")).toBe(false);
  });
});

describe("Highscores", () => {
  it("startet bei null", () => {
    expect(getScore("tetris")).toBe(0);
  });

  it("speichert nur echte Rekorde", () => {
    expect(submitScore("tetris", 500)).toBe(true);
    expect(submitScore("tetris", 300)).toBe(false);
    expect(getScore("tetris")).toBe(500);

    expect(submitScore("tetris", 900)).toBe(true);
    expect(getScore("tetris")).toBe(900);
  });

  it("haelt die Spiele auseinander", () => {
    submitScore("tetris", 500);
    submitScore("breakout", 10);
    expect(getScore("tetris")).toBe(500);
    expect(getScore("breakout")).toBe(10);
  });
});
