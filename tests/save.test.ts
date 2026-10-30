import { describe, expect, it } from "vitest";
import { Store, type StorageLike } from "../src/shell/save";

/** localStorage-Ersatz fuer die Tests, inklusive "geht gerade kaputt"-Variante. */
function memory(initial: Record<string, string> = {}, broken = false): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      if (broken) throw new DOMException("denied");
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      if (broken) throw new DOMException("quota");
      map.set(key, value);
    },
    removeItem(key) {
      if (broken) throw new DOMException("denied");
      map.delete(key);
    },
  };
}

interface Profile {
  name: string;
  runs: number;
}

const DEFAULTS: Profile = { name: "Gast", runs: 0 };

function store(storage: StorageLike, version = 1, migrations = {}) {
  return new Store<Profile>({
    key: "test.profile",
    version,
    defaults: DEFAULTS,
    storage,
    migrations,
  });
}

describe("Store", () => {
  it("laedt genau das, was gespeichert wurde", () => {
    const s = store(memory());
    s.save({ name: "Felix", runs: 12 });
    expect(s.load()).toEqual({ name: "Felix", runs: 12 });
  });

  it("gibt die Defaults zurueck, wenn noch nichts gespeichert ist", () => {
    expect(store(memory()).load()).toEqual(DEFAULTS);
  });

  it("aendert die Defaults nicht, wenn der Aufrufer das Ergebnis veraendert", () => {
    const s = store(memory());
    const loaded = s.load();
    loaded.runs = 99;
    expect(s.load().runs).toBe(0);
  });

  it("faellt bei kaputtem JSON auf die Defaults zurueck, statt zu werfen", () => {
    const s = store(memory({ "test.profile": "{ das ist kein json" }));
    expect(() => s.load()).not.toThrow();
    expect(s.load()).toEqual(DEFAULTS);
  });

  it("faellt zurueck, wenn der Inhalt zwar JSON ist, aber kein Spielstand", () => {
    const s = store(memory({ "test.profile": '"nur ein String"' }));
    expect(s.load()).toEqual(DEFAULTS);
  });

  it("stuerzt nicht ab, wenn localStorage gesperrt ist", () => {
    const s = store(memory({}, true));
    expect(s.load()).toEqual(DEFAULTS);
    expect(() => s.save({ name: "Felix", runs: 1 })).not.toThrow();
  });

  it("migriert einen alten Spielstand auf die neue Version", () => {
    const storage = memory({
      "test.profile": JSON.stringify({ v: 1, data: { name: "Felix" } }),
    });
    const s = new Store<Profile>({
      key: "test.profile",
      version: 2,
      defaults: DEFAULTS,
      storage,
      migrations: {
        2: (old) => ({ ...(old as object), runs: 0 }),
      },
    });
    expect(s.load()).toEqual({ name: "Felix", runs: 0 });
  });

  it("nimmt lieber die Defaults, als eine Migration zu ueberspringen", () => {
    const storage = memory({
      "test.profile": JSON.stringify({ v: 1, data: { name: "Felix" } }),
    });
    const s = store(storage, 3); // keine Migrationen hinterlegt
    expect(s.load()).toEqual(DEFAULTS);
  });

  it("fasst einen Spielstand aus einer neueren Version nicht an", () => {
    const future = JSON.stringify({ v: 9, data: { name: "Zukunft", runs: 5 } });
    const storage = memory({ "test.profile": future });
    const s = store(storage);
    expect(s.load()).toEqual(DEFAULTS);
    // und er bleibt unveraendert liegen
    expect(storage.getItem("test.profile")).toBe(future);
  });

  it("update() liest, aendert und schreibt in einem Schritt", () => {
    const s = store(memory());
    s.save({ name: "Felix", runs: 3 });
    const next = s.update((p) => ({ ...p, runs: p.runs + 1 }));
    expect(next.runs).toBe(4);
    expect(s.load().runs).toBe(4);
  });

  it("reset() loescht den Eintrag und gibt die Defaults zurueck", () => {
    const storage = memory();
    const s = store(storage);
    s.save({ name: "Felix", runs: 7 });
    expect(s.reset()).toEqual(DEFAULTS);
    expect(storage.getItem("test.profile")).toBeNull();
  });

  it("weist eine Migration ab, die selbst abstuerzt", () => {
    const storage = memory({
      "test.profile": JSON.stringify({ v: 1, data: { name: "Felix" } }),
    });
    const s = new Store<Profile>({
      key: "test.profile",
      version: 2,
      defaults: DEFAULTS,
      storage,
      migrations: {
        2: () => {
          throw new Error("kaputt");
        },
      },
    });
    expect(s.load()).toEqual(DEFAULTS);
  });

  it("validate() faengt einen Spielstand ab, der die Form nicht erfuellt", () => {
    const storage = memory({
      "test.profile": JSON.stringify({ v: 1, data: { name: "Felix", runs: "viele" } }),
    });
    const s = new Store<Profile>({
      key: "test.profile",
      version: 1,
      defaults: DEFAULTS,
      storage,
      validate: (value): value is Profile =>
        typeof value === "object" &&
        value !== null &&
        typeof (value as Profile).name === "string" &&
        typeof (value as Profile).runs === "number",
    });
    expect(s.load()).toEqual(DEFAULTS);
  });
});
