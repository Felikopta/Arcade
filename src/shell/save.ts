/**
 * Typsicherer Wrapper um localStorage, mit Versionsnummer.
 *
 * Regeln:
 *  - Kaputtes JSON, fremder Inhalt, gesperrter Speicher -> Default statt Absturz.
 *  - Jeder Datensatz traegt seine Version mit. Aendert sich das Format,
 *    laeuft beim Laden eine Migration, statt den Spielstand wegzuwerfen.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Nimmt eine alte Version und gibt die naechsthoehere zurueck. */
export type Migration = (old: unknown) => unknown;

export interface StoreOptions<T> {
  key: string;
  version: number;
  defaults: T;
  /** migrations[2] macht aus Version 1 eine Version 2. */
  migrations?: Record<number, Migration>;
  storage?: StorageLike;
  /** Letzte Pruefung: passt die geladene Form ueberhaupt? */
  validate?: (value: unknown) => value is T;
}

interface Envelope {
  v: number;
  data: unknown;
}

/** localStorage kann im privaten Modus schon beim Zugriff werfen. */
function safeStorage(): StorageLike {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      const probe = "__arcade_probe__";
      ls.setItem(probe, "1");
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    /* faellt unten auf den Speicher im RAM zurueck */
  }
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  };
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Envelope).v === "number" &&
    "data" in value
  );
}

export class Store<T> {
  readonly key: string;
  readonly version: number;

  private readonly defaults: T;
  private readonly migrations: Record<number, Migration>;
  private readonly storage: StorageLike;
  private readonly validate?: (value: unknown) => value is T;

  constructor(options: StoreOptions<T>) {
    this.key = options.key;
    this.version = options.version;
    this.defaults = options.defaults;
    this.migrations = options.migrations ?? {};
    this.storage = options.storage ?? safeStorage();
    this.validate = options.validate;
  }

  load(): T {
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return this.clone(this.defaults);
    }
    if (raw === null) return this.clone(this.defaults);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.clone(this.defaults); // kaputtes JSON
    }
    if (!isEnvelope(parsed)) return this.clone(this.defaults);

    // Spielstand aus der Zukunft (anderer Browser-Tab, neuere Seite): nicht anfassen.
    if (parsed.v > this.version) return this.clone(this.defaults);

    let data = parsed.data;
    for (let v = parsed.v + 1; v <= this.version; v++) {
      const step = this.migrations[v];
      if (!step) return this.clone(this.defaults); // Luecke in der Kette
      try {
        data = step(data);
      } catch {
        return this.clone(this.defaults);
      }
    }

    if (this.validate && !this.validate(data)) return this.clone(this.defaults);
    return data as T;
  }

  save(data: T): void {
    const envelope: Envelope = { v: this.version, data };
    try {
      this.storage.setItem(this.key, JSON.stringify(envelope));
    } catch {
      /* Speicher voll oder gesperrt: das Spiel laeuft trotzdem weiter */
    }
  }

  /** Laden, aendern, speichern in einem Schritt. */
  update(fn: (current: T) => T): T {
    const next = fn(this.load());
    this.save(next);
    return next;
  }

  reset(): T {
    try {
      this.storage.removeItem(this.key);
    } catch {
      /* egal */
    }
    return this.clone(this.defaults);
  }

  private clone(value: T): T {
    return structuredClone(value);
  }
}

/** Highscore-Tabelle, die sich alle Spiele teilen. */
export interface Scores {
  [gameId: string]: number;
}

export const scores = new Store<Scores>({
  key: "arcade.scores",
  version: 1,
  defaults: {},
});

export function getScore(gameId: string): number {
  return scores.load()[gameId] ?? 0;
}

/** Schreibt nur, wenn der Wert wirklich besser ist. Gibt zurueck, ob es ein Rekord war. */
export function submitScore(gameId: string, value: number): boolean {
  let record = false;
  scores.update((all) => {
    if (value > (all[gameId] ?? 0)) {
      record = true;
      return { ...all, [gameId]: value };
    }
    return all;
  });
  return record;
}
