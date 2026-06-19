import { COLORS, GAME, Sym, UI } from "../config/constants";

const FONT = UI.FONT;
const SIZE = 1080; // square card — ideal for social feeds / stories crop

export interface ShareCardData {
  score: number;
  best: number;
  phase: number;
  isNewBest: boolean;
}

/** Render a branded, shareable score card to an offscreen canvas. */
export function buildShareCard(d: ShareCardData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const S = SIZE;
  const cx = S / 2;

  // Background + faint grid.
  ctx.fillStyle = GAME.BG_HEX;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(40,62,104,0.25)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= S; x += 90) line(ctx, x, 0, x, S);
  for (let y = 0; y <= S; y += 90) line(ctx, 0, y, S, y);

  // Ambient glows in the symbol palette.
  glow(ctx, S * 0.22, S * 0.32, 340, COLORS[Sym.TRIANGLE]);
  glow(ctx, S * 0.82, S * 0.28, 320, COLORS[Sym.CIRCLE]);
  glow(ctx, S * 0.8, S * 0.74, 360, COLORS[Sym.SQUARE]);
  glow(ctx, S * 0.2, S * 0.7, 320, COLORS[Sym.CROSS]);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Title.
  ctx.shadowColor = UI.ACCENT;
  ctx.shadowBlur = 46;
  ctx.fillStyle = UI.TEXT;
  ctx.font = `bold 132px ${FONT}`;
  ctx.fillText("QUADSHOT", cx, 240);
  ctx.shadowBlur = 0;
  ctx.fillStyle = UI.ACCENT;
  ctx.font = `bold 42px ${FONT}`;
  ctx.fillText("REFLEX ARCADE", cx, 300);

  // The four symbols.
  const syms = [Sym.TRIANGLE, Sym.CIRCLE, Sym.CROSS, Sym.SQUARE];
  const spread = 190;
  syms.forEach((s, i) => drawSymbol(ctx, s, cx - ((syms.length - 1) * spread) / 2 + i * spread, 430, 56));

  // Score.
  ctx.fillStyle = UI.TEXT_DIM;
  ctx.font = `bold 46px ${FONT}`;
  ctx.fillText("SCORE", cx, 600);
  ctx.shadowColor = UI.ACCENT;
  ctx.shadowBlur = 36;
  ctx.fillStyle = UI.TEXT;
  ctx.font = `bold 176px ${FONT}`;
  ctx.fillText(d.score.toLocaleString(), cx, 760);
  ctx.shadowBlur = 0;

  if (d.isNewBest) {
    ctx.fillStyle = UI.ACCENT;
    ctx.font = `bold 54px ${FONT}`;
    ctx.fillText("★ NEW BEST ★", cx, 832);
  } else {
    ctx.fillStyle = UI.TEXT_DIM;
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText(`BEST  ${d.best.toLocaleString()}`, cx, 826);
  }

  ctx.fillStyle = UI.TEXT_DIM;
  ctx.font = `bold 36px ${FONT}`;
  ctx.fillText(`Reached Phase ${d.phase}`, cx, 892);

  // Call to action.
  ctx.fillStyle = UI.ACCENT;
  ctx.font = `bold 60px ${FONT}`;
  ctx.fillText("Can you beat me?", cx, 1000);
  ctx.fillStyle = UI.TEXT_DIM;
  ctx.font = `28px ${FONT}`;
  ctx.fillText("free reflex arcade · tap, aim, fire", cx, 1046);

  return c;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: number): void {
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hex);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  shape: Sym,
  x: number,
  y: number,
  r: number
): void {
  const hex = `#${COLORS[shape].toString(16).padStart(6, "0")}`;
  ctx.save();
  ctx.strokeStyle = hex;
  ctx.lineWidth = 16;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = hex;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  switch (shape) {
    case Sym.TRIANGLE:
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.92, y + r * 0.72);
      ctx.lineTo(x - r * 0.92, y + r * 0.72);
      ctx.closePath();
      ctx.stroke();
      break;
    case Sym.CIRCLE:
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case Sym.CROSS: {
      const a = r * 0.72;
      line(ctx, x - a, y - a, x + a, y + a);
      line(ctx, x - a, y + a, x + a, y - a);
      break;
    }
    case Sym.SQUARE: {
      const s = r * 1.4;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - s / 2, y - s / 2, s, s, 14);
      else ctx.rect(x - s / 2, y - s / 2, s, s);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
