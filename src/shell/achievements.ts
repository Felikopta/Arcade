/**
 * Spieluebergreifende Erfolge.
 *
 * Jedes Spiel meldet nur "das ist passiert" (unlock), der Hub zeigt den Rest.
 * Die Liste waechst mit jedem Spiel mit - der Zaehler im Hub rechnet
 * automatisch gegen die Gesamtzahl.
 */

import { Store } from "./save";

export interface Achievement {
  id: string;
  /** zu welchem Spiel es gehoert, oder "arcade" fuer seitenweite Erfolge */
  game: string;
  title: string;
  hint: string;
  /** versteckte Erfolge zeigt der Hub erst nach dem Freischalten an */
  secret?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "arcade.first-visit", game: "arcade", title: "Angekommen", hint: "Den Hub zum ersten Mal geöffnet" },
  { id: "arcade.first-play", game: "arcade", title: "Erster Zug", hint: "Irgendein Spiel gestartet" },
  { id: "arcade.three-games", game: "arcade", title: "Spielhalle", hint: "Drei verschiedene Spiele gespielt" },
  { id: "arcade.all-games", game: "arcade", title: "Komplettist", hint: "Jedes freigeschaltete Spiel einmal gespielt" },
  { id: "arcade.night-owl", game: "arcade", title: "Nachtschicht", hint: "Zwischen 2 und 5 Uhr gespielt", secret: true },
  { id: "arcade.duck-whisperer", game: "arcade", title: "Entenflüsterer", hint: "Eine Ente am See angeklickt", secret: true },
];

interface AchievementState {
  unlocked: Record<string, number>; // id -> Zeitstempel
  played: string[]; // Spiel-ids, die schon gestartet wurden
}

export const achievementStore = new Store<AchievementState>({
  key: "arcade.achievements",
  version: 1,
  defaults: { unlocked: {}, played: [] },
});

type Listener = (achievement: Achievement) => void;
const listeners = new Set<Listener>();

/** Der Hub haengt sich hier ein, um die Toast-Meldung zu zeigen. */
export function onUnlock(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function byId(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function isUnlocked(id: string): boolean {
  return id in achievementStore.load().unlocked;
}

export function unlockedIds(): string[] {
  return Object.keys(achievementStore.load().unlocked);
}

export function progress(): { done: number; total: number } {
  const unlocked = new Set(unlockedIds());
  const known = ACHIEVEMENTS.filter((a) => unlocked.has(a.id));
  return { done: known.length, total: ACHIEVEMENTS.length };
}

/** Schaltet frei. Gibt zurueck, ob es neu war (nur dann feiert der Hub). */
export function unlock(id: string): boolean {
  if (isUnlocked(id)) return false;

  const achievement = byId(id);
  if (!achievement) return false;

  achievementStore.update((state) => ({
    ...state,
    unlocked: { ...state.unlocked, [id]: Date.now() },
  }));

  for (const listener of listeners) listener(achievement);
  return true;
}

/** Merkt sich, dass ein Spiel gestartet wurde, und zieht die Meilensteine nach. */
export function markPlayed(gameId: string, unlockedGameCount: number): void {
  const state = achievementStore.update((current) =>
    current.played.includes(gameId)
      ? current
      : { ...current, played: [...current.played, gameId] },
  );

  unlock("arcade.first-play");
  if (state.played.length >= 3) unlock("arcade.three-games");
  if (unlockedGameCount > 0 && state.played.length >= unlockedGameCount) {
    unlock("arcade.all-games");
  }

  const hour = new Date().getHours();
  if (hour >= 2 && hour < 5) unlock("arcade.night-owl");
}

export function playedGames(): string[] {
  return achievementStore.load().played;
}
