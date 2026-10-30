/**
 * Eine Eingabe-API fuer Tastatur, Maus und Touch.
 *
 * Spiele fragen Zustaende ab (down / pressed) statt Events zu abonnieren.
 * "pressed" gilt genau einen Logik-Schritt lang, danach muss das Spiel
 * endOfStep() rufen - das macht die Shell am Ende von update().
 */

export type Action = "up" | "down" | "left" | "right" | "a" | "b" | "pause";

const DEFAULT_BINDINGS: Record<string, Action> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Space: "a",
  Enter: "a",
  ShiftLeft: "b",
  KeyX: "b",
  Escape: "pause",
  KeyP: "pause",
};

export interface Pointer {
  x: number;
  y: number;
  /** liegt gerade ein Finger oder die Maustaste auf dem Canvas? */
  down: boolean;
  /** in diesem Schritt neu gedrueckt */
  pressed: boolean;
}

export class Input {
  private readonly down = new Set<Action>();
  private readonly fresh = new Set<Action>();
  private readonly bindings: Record<string, Action>;
  private readonly target: HTMLElement;
  private readonly listeners: Array<() => void> = [];

  readonly pointer: Pointer = { x: 0, y: 0, down: false, pressed: false };

  constructor(target: HTMLElement, bindings: Record<string, Action> = DEFAULT_BINDINGS) {
    this.target = target;
    this.bindings = bindings;

    this.on(window, "keydown", (e) => {
      const action = this.bindings[(e as KeyboardEvent).code];
      if (!action) return;
      e.preventDefault();
      if (!this.down.has(action)) this.fresh.add(action);
      this.down.add(action);
    });

    this.on(window, "keyup", (e) => {
      const action = this.bindings[(e as KeyboardEvent).code];
      if (!action) return;
      e.preventDefault();
      this.down.delete(action);
    });

    // Tab verlassen -> alles loslassen, sonst "klemmt" eine Taste.
    this.on(window, "blur", () => {
      this.down.clear();
      this.fresh.clear();
      this.pointer.down = false;
    });

    this.on(target, "pointerdown", (e) => {
      const pe = e as PointerEvent;
      target.setPointerCapture?.(pe.pointerId);
      this.movePointer(pe);
      if (!this.pointer.down) this.pointer.pressed = true;
      this.pointer.down = true;
    });

    this.on(target, "pointermove", (e) => this.movePointer(e as PointerEvent));

    this.on(target, "pointerup", (e) => {
      const pe = e as PointerEvent;
      target.releasePointerCapture?.(pe.pointerId);
      this.pointer.down = false;
    });

    this.on(target, "pointercancel", () => {
      this.pointer.down = false;
    });

    // Scrollen/Zoomen beim Wischen auf dem Spielfeld verhindern.
    this.on(target, "touchmove", (e) => e.preventDefault(), { passive: false });
  }

  isDown(action: Action): boolean {
    return this.down.has(action);
  }

  /** War die Taste in diesem Logik-Schritt neu gedrueckt? */
  wasPressed(action: Action): boolean {
    return this.fresh.has(action);
  }

  /** Richtung als -1 / 0 / 1, bequem fuer Bewegung. */
  axis(): { x: number; y: number } {
    return {
      x: (this.isDown("right") ? 1 : 0) - (this.isDown("left") ? 1 : 0),
      y: (this.isDown("down") ? 1 : 0) - (this.isDown("up") ? 1 : 0),
    };
  }

  /** Ruft die Shell am Ende jedes update(): loescht die "neu gedrueckt"-Markierungen. */
  endOfStep(): void {
    this.fresh.clear();
    this.pointer.pressed = false;
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners.length = 0;
  }

  private movePointer(e: PointerEvent) {
    const rect = this.target.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
  }

  private on(
    el: EventTarget,
    type: string,
    handler: (e: Event) => void,
    options?: AddEventListenerOptions,
  ) {
    el.addEventListener(type, handler, options);
    this.listeners.push(() => el.removeEventListener(type, handler, options));
  }
}
