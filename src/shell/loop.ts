/**
 * Der feste Zeitschritt. Jedes Spiel auf dieser Seite laeuft hierueber:
 * update() exakt 120-mal pro Sekunde, render() so oft der Bildschirm kann.
 */

export interface Game {
  init(ctx: CanvasRenderingContext2D): void;
  update(dt: number): void;
  /** alpha 0..1 = wie weit zwischen zwei Logik-Schritten */
  render(alpha: number): void;
  /** optional: aufraeumen, wenn der Hub zu einem anderen Spiel wechselt */
  dispose?(): void;
}

export interface Running {
  stop(): void;
}

export function run(game: Game, canvas: HTMLCanvasElement, STEP = 1 / 120): Running {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D nicht verfuegbar");

  game.init(ctx);

  let last = performance.now();
  let acc = 0;
  let paused = false;
  let frameId = 0;
  let stopped = false;

  const onVisibility = () => {
    paused = document.hidden;
    // kein Riesensprung beim Zurueckkommen
    last = performance.now();
  };
  document.addEventListener("visibilitychange", onVisibility);

  function frame(now: number) {
    if (stopped) return;

    if (!paused) {
      acc += Math.min((now - last) / 1000, 0.25); // gegen "Spiral of Death"
      last = now;
      while (acc >= STEP) {
        game.update(STEP);
        acc -= STEP;
      }
      game.render(acc / STEP);
    } else {
      last = now;
    }

    frameId = requestAnimationFrame(frame);
  }

  frameId = requestAnimationFrame(frame);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibility);
      game.dispose?.();
    },
  };
}

/**
 * Canvas auf die echte Pixelgroesse bringen (Retina-Displays zeichnen sonst matschig).
 * Gibt die CSS-Groesse zurueck, in der das Spiel rechnen darf.
 */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: w, height: h };
}
