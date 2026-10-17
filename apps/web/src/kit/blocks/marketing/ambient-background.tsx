"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./ambient-background.module.css";

export type AmbientKind = "globe" | "rails" | "grid" | "constellation" | "matrix";

const GLOBE_PERSPECTIVE = 3.8;

/** Fibonacci sphere — every dot lives on the same shell. */
function spherePoints(count: number) {
  const points = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const radius = Math.sqrt(1 - y * y);
    points.set([Math.cos(i * goldenAngle) * radius, y, Math.sin(i * goldenAngle) * radius], i * 3);
  }
  return points;
}

function globeRadius(width: number, height: number) {
  const maxScale = GLOBE_PERSPECTIVE / (GLOBE_PERSPECTIVE - 1);
  const preferred = Math.min(width, height) / 760;
  const scale = Math.min(0.94, Math.max(0.66, preferred));
  return (Math.min(width, height) / (2 * maxScale)) * scale;
}

const MATRIX_GLYPHS = "01<>[]{}()/\\=+-*#;:.".split("");

/**
 * Kit block — animated canvas backdrop for heroes, auth stages, and feature
 * sections. Absolute-fills its nearest positioned ancestor (`.host` on a
 * parent is the intended pairing), paints only theme tokens, and never
 * touches layout. `prefers-reduced-motion` renders a single static frame and
 * hides the pause control; the rAF loop sleeps offscreen/hidden/paused.
 */
export function AmbientBackground({
  kind,
  pauseLabel = "Pause background animation",
  playLabel = "Play background animation",
}: {
  kind: AmbientKind;
  pauseLabel?: string;
  playLabel?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const control = useRef<(paused: boolean) => void>(() => {});
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const host = root.current;
    const canvas = canvasRef.current;
    const parent = host?.parentElement;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!host || !canvas || !parent || !ctx) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const points = kind === "globe" ? spherePoints(12000) : new Float32Array();
    const displacement = new Float32Array((points.length / 3) * 4);
    let pointerX = -10000,
      pointerY = -10000,
      pointerActive = false,
      stepSeconds = 0;
    const projected = new Float64Array(4);
    let ink = "#f5f5f5";
    let width = 1,
      height = 1,
      ratio = 1;
    let frame = 0,
      last = 0,
      elapsed = 0;
    let visible = false,
      stopped = false,
      disposed = false;
    let stride = 1,
      slowFrames = 0;
    let accent = "#efb66f";
    let rail = "#c5c5c5";

    // Constellation nodes + matrix columns are sized on each resize.
    let nodes: Float32Array = new Float32Array();
    let nodeVel: Float32Array = new Float32Array();
    let columnHeads: Float32Array = new Float32Array();
    let columnSpeed: Float32Array = new Float32Array();

    function drawGlobe() {
      if (!ctx) return;
      const angle = elapsed * 0.16;
      const tilt = -0.22;
      const ca = Math.cos(angle),
        sa = Math.sin(angle),
        ct = Math.cos(tilt),
        st = Math.sin(tilt);
      const radius = globeRadius(width, height);
      const cx = width * 0.5,
        cy = height * 0.5;
      function project(x: number, y: number, z: number) {
        const rx = x * ca + z * sa;
        const rz = z * ca - x * sa;
        const ry = y * ct - rz * st;
        const depth = y * st + rz * ct;
        const perspective = GLOBE_PERSPECTIVE / (GLOBE_PERSPECTIVE - depth);
        projected[0] = cx + rx * radius * perspective;
        projected[1] = cy + ry * radius * perspective;
        projected[2] = depth;
        projected[3] = perspective;
      }
      for (let i = 0; i < points.length; i += 3 * stride) {
        project(points[i]!, points[i + 1]!, points[i + 2]!);
        const x = projected[0]!,
          y = projected[1]!,
          depth = projected[2]!;
        if (x < 0 || x > width || y < 0 || y > height) continue;
        const bucket = Math.max(0, Math.min(11, Math.floor((depth + 1) * 5.5)));
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.12 + bucket * 0.067;
        const size = (i % 17 === 0 ? 1.45 : 0.9) * projected[3]!;
        const offset = (i / 3) * 4;
        if (stepSeconds > 0 && !media.matches) {
          const dx = x + displacement[offset]! - pointerX;
          const dy = y + displacement[offset + 1]! - pointerY;
          const distance = Math.hypot(dx, dy);
          const reach = width < 600 ? 64 : 105;
          const force =
            pointerActive && depth > -0.3 ? Math.max(0, 1 - distance / reach) * 1150 : 0;
          const damping = Math.exp(-stepSeconds * 6);
          displacement[offset + 2] =
            (displacement[offset + 2]! +
              ((dx / Math.max(distance, 1)) * force - displacement[offset]! * 26) * stepSeconds) *
            damping;
          displacement[offset + 3] =
            (displacement[offset + 3]! +
              ((dy / Math.max(distance, 1)) * force - displacement[offset + 1]! * 26) *
                stepSeconds) *
            damping;
          displacement[offset] = displacement[offset]! + displacement[offset + 2]! * stepSeconds;
          displacement[offset + 1] =
            displacement[offset + 1]! + displacement[offset + 3]! * stepSeconds;
        }
        ctx.fillRect(x + displacement[offset]!, y + displacement[offset + 1]!, size, size);
      }
      ctx.globalAlpha = 1;
    }

    function drawRails() {
      if (!ctx) return;
      // S-curves gather at a routing region, then fan out to destinations.
      const count = width < 600 ? 16 : 25;
      const routeX = width * 0.79;
      const routeY = height * 0.2;
      const sample = (t: number, lane: number) => {
        const start = (lane / (count - 1)) * height * 1.6 - height * 0.3;
        const end = height * 0.08 + (((lane * 7) % count) / count) * height * 0.9;
        const x = -80 + t * (width + 160);
        const gather = Math.exp(-Math.pow((x - routeX) / (width * 0.18), 2));
        const base = start * (1 - t) + end * t;
        return [
          x,
          base * (1 - gather * 0.85) + (routeY + (lane - count / 2) * 3.5) * gather * 0.85,
        ];
      };
      for (let lane = 0; lane < count; lane++) {
        ctx.beginPath();
        for (let step = 0; step <= 100; step++) {
          const p = sample(step / 100, lane);
          if (step === 0) ctx.moveTo(p[0]!, p[1]!);
          else ctx.lineTo(p[0]!, p[1]!);
        }
        ctx.strokeStyle = lane % 9 === 0 ? accent : rail;
        ctx.globalAlpha = lane % 9 === 0 ? 0.22 : 0.18;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        for (let packet = 0; packet < 2; packet++) {
          const head =
            ((elapsed * (0.115 + (lane % 4) * 0.008) + lane * 0.071 + packet * 0.5) % 1.16) - 0.08;
          for (let tail = 0; tail < 10; tail++) {
            const t = head - tail * 0.006;
            if (t < 0 || t > 1) continue;
            const a = sample(t, lane),
              b = sample(Math.max(0, t - 0.006), lane);
            ctx.beginPath();
            ctx.moveTo(a[0]!, a[1]!);
            ctx.lineTo(b[0]!, b[1]!);
            ctx.globalAlpha = (1 - tail / 10) * 0.8;
            ctx.lineWidth = tail === 0 ? 1.4 : 1;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawGrid() {
      if (!ctx) return;
      // Perspective floor scrolling toward the viewer; the horizon gets a
      // faint accent glow.
      const horizon = height * 0.4;
      const vanishX = width * 0.5;
      const spacing = Math.max(56, width / 22);
      ctx.strokeStyle = rail;
      ctx.lineWidth = 1;
      const lanes = Math.ceil(width / spacing) + 2;
      for (let i = -lanes; i <= lanes; i++) {
        ctx.beginPath();
        ctx.moveTo(vanishX + i * spacing * 0.08, horizon);
        ctx.lineTo(vanishX + i * spacing, height + 40);
        ctx.globalAlpha = 0.14;
        ctx.stroke();
      }
      const rows = 14;
      const phase = (elapsed * 0.12) % 1;
      for (let row = 0; row < rows; row++) {
        const t = Math.pow((row + phase) / rows, 2.6);
        const y = horizon + t * (height - horizon + 60);
        if (y > height + 40) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.globalAlpha = 0.05 + t * 0.22;
        ctx.stroke();
      }
      const glow = ctx.createRadialGradient(
        vanishX,
        horizon,
        0,
        vanishX,
        horizon,
        Math.max(width, height) * 0.5,
      );
      glow.addColorStop(0, accent);
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    function drawConstellation() {
      if (!ctx) return;
      const count = nodes.length / 2;
      const reach = Math.min(150, Math.max(90, width * 0.09));
      if (stepSeconds > 0) {
        for (let i = 0; i < count; i++) {
          let x = nodes[i * 2]! + nodeVel[i * 2]! * stepSeconds;
          let y = nodes[i * 2 + 1]! + nodeVel[i * 2 + 1]! * stepSeconds;
          if (x < -20) x = width + 20;
          else if (x > width + 20) x = -20;
          if (y < -20) y = height + 20;
          else if (y > height + 20) y = -20;
          nodes[i * 2] = x;
          nodes[i * 2 + 1] = y;
        }
      }
      ctx.lineWidth = 1;
      for (let a = 0; a < count; a++) {
        const ax = nodes[a * 2]!,
          ay = nodes[a * 2 + 1]!;
        for (let b = a + 1; b < count; b++) {
          const dx = ax - nodes[b * 2]!,
            dy = ay - nodes[b * 2 + 1]!;
          const distance = Math.hypot(dx, dy);
          if (distance > reach) continue;
          ctx.strokeStyle = rail;
          ctx.globalAlpha = (1 - distance / reach) * 0.26;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(nodes[b * 2]!, nodes[b * 2 + 1]!);
          ctx.stroke();
        }
      }
      for (let i = 0; i < count; i++) {
        const accentNode = i % 11 === 0;
        ctx.fillStyle = accentNode ? accent : ink;
        ctx.globalAlpha = accentNode ? 0.75 : 0.5;
        const size = accentNode ? 1.9 : 1.3;
        ctx.fillRect(nodes[i * 2]! - size / 2, nodes[i * 2 + 1]! - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    function drawMatrix() {
      if (!ctx) return;
      const cell = 18;
      const columns = columnHeads.length;
      ctx.font = "13px ui-monospace, monospace";
      ctx.textBaseline = "top";
      for (let column = 0; column < columns; column++) {
        if (stepSeconds > 0) {
          columnHeads[column] = columnHeads[column]! + columnSpeed[column]! * stepSeconds;
          if (columnHeads[column]! - 16 * cell > height) columnHeads[column] = 0;
        }
        const headRow = Math.floor(columnHeads[column]! / cell);
        for (let trail = 0; trail < 16; trail++) {
          const row = headRow - trail;
          if (row < 0) continue;
          const glyphIndex =
            (column * 31 + row * 7 + Math.floor(elapsed * 6 + column)) % MATRIX_GLYPHS.length;
          const glyph = MATRIX_GLYPHS[glyphIndex]!;
          const fade = 1 - trail / 16;
          ctx.fillStyle = trail === 0 ? accent : ink;
          ctx.globalAlpha = trail === 0 ? 0.5 : fade * 0.16;
          ctx.fillText(glyph, column * cell + 3, row * cell);
        }
      }
      ctx.globalAlpha = 1;
    }

    function draw() {
      if (!ctx) return;
      const start = performance.now();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (kind === "globe") drawGlobe();
      else if (kind === "rails") drawRails();
      else if (kind === "grid") drawGrid();
      else if (kind === "constellation") drawConstellation();
      else drawMatrix();
      if (performance.now() - start > 12) slowFrames++;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 20) stride = 2;
    }
    function eligible() {
      return visible && !document.hidden && !media.matches && !stopped;
    }
    function tick(now: number) {
      frame = 0;
      if (disposed || !eligible()) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      elapsed += dt;
      stepSeconds = dt;
      draw();
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      if (!host) return;
      host.dataset.state = media.matches
        ? "reduced"
        : stopped
          ? "paused"
          : eligible()
            ? "running"
            : "idle";
      if (eligible()) {
        if (!frame) {
          last = 0;
          frame = requestAnimationFrame(tick);
        }
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      }
      if (media.matches) {
        displacement.fill(0);
        stepSeconds = 0;
        pointerActive = false;
        pointerX = -10000;
        pointerY = -10000;
        draw();
      }
    }
    function resize() {
      if (!host || !canvas || !parent) return;
      width = host.clientWidth;
      height = host.clientHeight;
      ratio = Math.min(devicePixelRatio || 1, width < 600 ? 1.5 : 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const parentStyles = getComputedStyle(parent);
      accent = parentStyles.getPropertyValue("--accent").trim() || "#efb779";
      ink = parentStyles.getPropertyValue("--text").trim() || "#f5f5f5";
      rail = parentStyles.getPropertyValue("--muted").trim() || "#c5c5c5";
      if (kind === "constellation") {
        const count = Math.min(90, Math.max(36, Math.floor((width * height) / 16000)));
        nodes = new Float32Array(count * 2);
        nodeVel = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
          nodes[i * 2] = Math.random() * width;
          nodes[i * 2 + 1] = Math.random() * height;
          const angle = Math.random() * Math.PI * 2;
          const speed = 6 + Math.random() * 14;
          nodeVel[i * 2] = Math.cos(angle) * speed;
          nodeVel[i * 2 + 1] = Math.sin(angle) * speed;
        }
      }
      if (kind === "matrix") {
        const columns = Math.ceil(width / 18);
        columnHeads = new Float32Array(columns);
        columnSpeed = new Float32Array(columns);
        for (let column = 0; column < columns; column++) {
          columnHeads[column] = Math.random() * height;
          columnSpeed[column] = 40 + Math.random() * 100;
        }
      }
      draw();
      sync();
    }
    function pointer(event: PointerEvent) {
      if (media.matches || !parent) return;
      const rect = parent.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      pointerActive = true;
    }
    function leave() {
      pointerActive = false;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0 },
    );
    const sizeObserver = new ResizeObserver(resize);
    observer.observe(host);
    sizeObserver.observe(host);
    // Only the globe scatters from the pointer — the other kinds stay calm
    // so forms and copy sitting on top never fight the backdrop.
    if (kind === "globe") {
      parent.addEventListener("pointermove", pointer, { passive: true });
      parent.addEventListener("pointerleave", leave);
      parent.addEventListener("pointerdown", pointer, { passive: true });
      parent.addEventListener("pointerup", leave);
    }
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", sync);
    control.current = (value) => {
      stopped = value;
      sync();
    };
    resize();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizeObserver.disconnect();
      if (kind === "globe") {
        parent.removeEventListener("pointermove", pointer);
        parent.removeEventListener("pointerleave", leave);
        parent.removeEventListener("pointerdown", pointer);
        parent.removeEventListener("pointerup", leave);
      }
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
      control.current = () => {};
    };
  }, [kind]);

  useEffect(() => control.current(paused), [paused]);

  return (
    <div ref={root} className={`${styles.background} ${styles[kind]}`} data-ambient={kind}>
      <div className={styles.artwork} aria-hidden="true">
        <canvas ref={canvasRef} />
      </div>
      {kind === "globe" ? null : (
        <button
          className={styles.pause}
          type="button"
          aria-label={paused ? playLabel : pauseLabel}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            {paused ? <path d="m6 3 11 7-11 7Z" /> : <path d="M5 4h3v12H5zm7 0h3v12h-3z" />}
          </svg>
        </button>
      )}
    </div>
  );
}
