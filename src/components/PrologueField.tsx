import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface PrologueFieldHandle {
  /** Push scrub-smoothed progress (0..1) from the Prologue's timeline. */
  setProgress(p: number): void;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * The Prologue's background — the tall illustrated composite rendered as
 * a shatterable tile mosaic (technique ported from hmohapatra.com, then
 * restructured for a much larger source image):
 *
 * - "Settled is free": the at-rest portion of the image is painted as ONE
 *   drawImage of the visible slice per frame. Only ACTIVE tiles (near the
 *   pointer, or kicked loose by a scroll pan) get punched out of the base
 *   and drawn individually with spring physics. Idle cost ≈ 1 draw call.
 * - Scroll position arrives as timeline progress via setProgress (pushed
 *   from the Prologue's ScrollTrigger-scrubbed timeline) and maps onto the
 *   pan LINEARLY — the mural is one continuous painting now, not discrete
 *   scenes to hold on, so text beats only need approximate alignment with
 *   where a scene passes, not exact sync. This component never reads
 *   window.scrollY.
 * - When the pan moves the image, visible tiles are activated at their
 *   OLD position so they lag behind and spring into place — that's the
 *   break-and-reassemble-on-scroll moment, now cheap enough to run at
 *   full frame rate (which is what makes the springs feel like water
 *   instead of molasses; the constants themselves match the reference).
 */
export const PrologueField = forwardRef<PrologueFieldHandle>(function PrologueField(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<{ setProgress(p: number): void } | null>(null);

  useImperativeHandle(ref, () => ({
    setProgress(p: number) {
      apiRef.current?.setProgress(p);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
    // Mobile tiles are larger in SOURCE px so they don't end up smaller
    // on screen than desktop's (phone cover-scale shrinks everything).
    const TILE = mobile ? 26 : 16;

    const image = new Image();
    image.decoding = "async";

    const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, lastX: -9999, lastY: -9999, active: false, lastMove: 0 };

    const state = {
      width: 0,
      height: 0,
      dpr: 1,
      progress: 0,
      prevOffset: -1,
      raf: 0,
      lastTime: 0,
      cols: 0,
      rows: 0,
    };

    // Tile state, allocated once at image load. Dormant tiles carry no
    // meaningful x/y — they're implicitly at their target inside the base
    // image draw. Positions only become real at activation time.
    let tileX: Float32Array = new Float32Array(0);
    let tileY: Float32Array = new Float32Array(0);
    let tileVX: Float32Array = new Float32Array(0);
    let tileVY: Float32Array = new Float32Array(0);
    let tileMass: Float32Array = new Float32Array(0);
    let tileSeed: Float32Array = new Float32Array(0);
    let isActive: Uint8Array = new Uint8Array(0);
    const active = new Set<number>();
    const MAX_ACTIVE = 14000; // safety valve; never activate beyond this

    function buildGrid() {
      state.cols = Math.ceil(image.width / TILE);
      state.rows = Math.ceil(image.height / TILE);
      const n = state.cols * state.rows;
      tileX = new Float32Array(n);
      tileY = new Float32Array(n);
      tileVX = new Float32Array(n);
      tileVY = new Float32Array(n);
      tileMass = new Float32Array(n);
      tileSeed = new Float32Array(n);
      isActive = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        tileMass[i] = 0.8 + Math.random() * 1.6;
        tileSeed[i] = Math.random() * Math.PI * 2;
      }
      active.clear();
    }

    function metrics() {
      const scale = Math.max((state.width / image.width) * 1.02, (state.height / image.height) * 1.02);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const x = (state.width - drawW) / 2;
      const travel = Math.max(0, drawH - state.height);
      return { scale, drawW, drawH, x, travel };
    }

    /** Linear progress → pan offset: the mural drifts at constant velocity,
     * like the reference site — no holds, no sprints, nothing to skip. */
    function offsetFor(progress: number, m: ReturnType<typeof metrics>) {
      return clamp(progress, 0, 1) * m.travel;
    }

    function activate(i: number, x: number, y: number) {
      if (isActive[i] || active.size >= MAX_ACTIVE) return;
      isActive[i] = 1;
      active.add(i);
      tileX[i] = x;
      tileY[i] = y;
      tileVX[i] = 0;
      tileVY[i] = 0;
    }

    /** Kick loose a share of the visible tiles when the image pans under them. */
    function kickVisible(dOff: number, m: ReturnType<typeof metrics>, offset: number) {
      const lag = clamp(dOff, -90, 90);
      const prob = clamp(Math.abs(lag) / 26, 0.3, 0.9);
      const row0 = Math.max(0, Math.floor(offset / m.scale / TILE));
      const row1 = Math.min(state.rows - 1, Math.ceil((offset + state.height) / m.scale / TILE));
      for (let row = row0; row <= row1; row++) {
        for (let col = 0; col < state.cols; col++) {
          const i = row * state.cols + col;
          if (isActive[i] || Math.random() > prob) continue;
          const tx = m.x + col * TILE * m.scale;
          const ty = row * TILE * m.scale - offset;
          // Start at the OLD target (where this tile was on screen before
          // the pan step) so it visibly lags and springs into place.
          activate(i, tx, ty + lag);
          tileVX[i] = (Math.random() - 0.5) * Math.abs(lag) * 0.06;
        }
      }
    }

    /** Activate dormant tiles inside the pointer's blast radius. */
    function activateAroundPointer(radius: number, m: ReturnType<typeof metrics>, offset: number) {
      const reach = radius + 24;
      const srcX = (pointer.x - m.x) / m.scale;
      const srcY = (pointer.y + offset) / m.scale;
      const srcR = reach / m.scale;
      const col0 = Math.max(0, Math.floor((srcX - srcR) / TILE));
      const col1 = Math.min(state.cols - 1, Math.ceil((srcX + srcR) / TILE));
      const row0 = Math.max(0, Math.floor((srcY - srcR) / TILE));
      const row1 = Math.min(state.rows - 1, Math.ceil((srcY + srcR) / TILE));
      const srcR2 = srcR * srcR;
      for (let row = row0; row <= row1; row++) {
        for (let col = col0; col <= col1; col++) {
          const i = row * state.cols + col;
          if (isActive[i]) continue;
          const cx = (col + 0.5) * TILE;
          const cy = (row + 0.5) * TILE;
          const dx = cx - srcX;
          const dy = cy - srcY;
          if (dx * dx + dy * dy > srcR2) continue;
          activate(i, m.x + col * TILE * m.scale, row * TILE * m.scale - offset);
        }
      }
    }

    const requestFrame = () => {
      if (!state.raf && image.width) state.raf = window.requestAnimationFrame(frame);
    };

    const frame = (time: number) => {
      state.raf = 0;
      const delta = Math.min(time - state.lastTime || 16, 34);
      state.lastTime = time;
      const m = metrics();
      const offset = offsetFor(state.progress, m);
      const dOff = state.prevOffset < 0 ? 0 : offset - state.prevOffset;
      state.prevOffset = offset;

      const radius = mobile ? 120 : 190;
      const pointerLive = !reduceMotion && pointer.active && time - pointer.lastMove < 900;
      const speed = clamp(Math.hypot(pointer.vx, pointer.vy) / 34, 0, 1.6);
      pointer.vx *= 0.9;
      pointer.vy *= 0.9;

      // Scroll-shatter is desktop-only. On a phone, scrolling IS a finger
      // drag, so the kick storm would fire for the whole momentum glide —
      // thousands of tile draws/frame on hardware that can't absorb them
      // (the reference site makes the same call: on mobile the shatter is
      // a touch effect, the pan itself stays a single cheap drawImage).
      if (!reduceMotion && !mobile && Math.abs(dOff) > 1.5) kickVisible(dOff, m, offset);
      if (pointerLive) activateAroundPointer(radius, m, offset);

      // Base pass: the whole settled image in one draw call.
      ctx.clearRect(0, 0, state.width, state.height);
      ctx.imageSmoothingEnabled = false;
      const srcY = offset / m.scale;
      const srcH = Math.min(state.height / m.scale, image.height - srcY);
      ctx.drawImage(image, 0, srcY, image.width, srcH, m.x, 0, m.drawW, srcH * m.scale);

      if (reduceMotion || active.size === 0) return;

      // Physics pass for active tiles only.
      const settled: number[] = [];
      const dt = delta / 16;
      for (const i of active) {
        const row = (i / state.cols) | 0;
        const col = i % state.cols;
        const tx = m.x + col * TILE * m.scale;
        const ty = row * TILE * m.scale - offset;
        let desiredX = tx;
        let desiredY = ty;

        if (pointerLive) {
          const cx = tx + TILE * m.scale * 0.5;
          const cy = ty + TILE * m.scale * 0.5;
          const dx = cx - pointer.x;
          const dy = cy - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < radius * radius) {
            const dist = Math.sqrt(d2);
            const safe = Math.max(dist, 0.001);
            const strength = (1 - dist / radius) ** 2.05;
            const blast = (34 + speed * 34) * strength;
            const swirl = Math.sin(time * 0.006 + tileSeed[i]) * 12 * strength;
            desiredX += (dx / safe) * blast - (dy / safe) * swirl + pointer.vx * 0.28 * strength;
            desiredY += (dy / safe) * blast + (dx / safe) * swirl + pointer.vy * 0.28 * strength;
          }
        }

        const spring = 0.2 / tileMass[i];
        tileVX[i] += (desiredX - tileX[i]) * spring;
        tileVY[i] += (desiredY - tileY[i]) * spring;
        tileVX[i] *= 0.58;
        tileVY[i] *= 0.58;
        tileX[i] += tileVX[i] * dt;
        tileY[i] += tileVY[i] * dt;

        const rx = tileX[i] - tx;
        const ry = tileY[i] - ty;
        const nearPointer =
          pointerLive &&
          (tx + TILE * m.scale * 0.5 - pointer.x) ** 2 + (ty + TILE * m.scale * 0.5 - pointer.y) ** 2 <
            (radius + 40) ** 2;
        if (!nearPointer && rx * rx + ry * ry < 0.05 && tileVX[i] * tileVX[i] + tileVY[i] * tileVY[i] < 0.02) {
          settled.push(i);
        }
      }
      for (const i of settled) {
        isActive[i] = 0;
        active.delete(i);
      }

      // Punch pass: open a hole at every active tile's home position...
      const ts = TILE * m.scale;
      for (const i of active) {
        const row = (i / state.cols) | 0;
        const col = i % state.cols;
        ctx.clearRect(m.x + col * TILE * m.scale, row * TILE * m.scale - offset, ts + 0.5, ts + 0.5);
      }
      // ...then draw each displaced tile.
      for (const i of active) {
        const row = (i / state.cols) | 0;
        const col = i % state.cols;
        const sx = col * TILE;
        const sy = row * TILE;
        const sw = Math.min(TILE, image.width - sx);
        const sh = Math.min(TILE, image.height - sy);
        ctx.drawImage(image, sx, sy, sw, sh, tileX[i], tileY[i], sw * m.scale + 0.6, sh * m.scale + 0.6);
      }

      if (active.size > 0) requestFrame();
    };

    const setSize = () => {
      state.width = window.innerWidth;
      state.height = window.innerHeight;
      state.dpr = mobile ? 1 : clamp(window.devicePixelRatio || 1, 1, 2);
      canvas.width = Math.round(state.width * state.dpr);
      canvas.height = Math.round(state.height * state.dpr);
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      state.prevOffset = -1; // don't treat a resize reflow as a scroll kick
      requestFrame();
    };

    const updatePointer = (e: PointerEvent) => {
      if (e.isPrimary === false) return;
      const x = e.clientX;
      const y = e.clientY;
      if (!pointer.active) {
        pointer.lastX = x;
        pointer.lastY = y;
        pointer.active = true;
      }
      pointer.vx = pointer.vx * 0.6 + (x - pointer.lastX) * 0.4;
      pointer.vy = pointer.vy * 0.6 + (y - pointer.lastY) * 0.4;
      pointer.x = x;
      pointer.y = y;
      pointer.lastX = x;
      pointer.lastY = y;
      pointer.lastMove = performance.now();
      requestFrame();
    };

    const clearPointer = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
      requestFrame();
    };

    apiRef.current = {
      setProgress(p: number) {
        state.progress = clamp(p, 0, 1);
        requestFrame();
      },
    };

    function handleLoad() {
      buildGrid();
      setSize();
      window.addEventListener("resize", setSize, { passive: true });
      if (!reduceMotion) {
        window.addEventListener("pointermove", updatePointer, { passive: true });
        window.addEventListener("pointerdown", updatePointer, { passive: true });
        window.addEventListener("pointerup", clearPointer, { passive: true });
        window.addEventListener("pointerleave", clearPointer, { passive: true });
        window.addEventListener("pointercancel", clearPointer, { passive: true });
        window.addEventListener("blur", clearPointer);
      }
    }

    image.addEventListener("load", handleLoad, { once: true });
    image.src = mobile ? "/assets/prologue-field-mobile.webp" : "/assets/prologue-field.webp";
    if (image.complete && image.naturalWidth) handleLoad();

    return () => {
      apiRef.current = null;
      window.removeEventListener("resize", setSize);
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerdown", updatePointer);
      window.removeEventListener("pointerup", clearPointer);
      window.removeEventListener("pointerleave", clearPointer);
      window.removeEventListener("pointercancel", clearPointer);
      window.removeEventListener("blur", clearPointer);
      if (state.raf) window.cancelAnimationFrame(state.raf);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
});

export default PrologueField;
