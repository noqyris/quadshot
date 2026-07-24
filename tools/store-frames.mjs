/**
 * Writes one HTML page per store screenshot: caption + the raw gameplay capture
 * in a device frame, sized to the exact App Store pixel spec. A headless browser
 * screenshots each page — that is the whole renderer, so the marketing frames
 * are reproducible instead of living in a script under /tmp.
 *
 *   node tools/store-frames.mjs <rawDir> <outDir>
 *
 * `rawDir` holds title.png, shape.png, … at 1320x2868 (capture them with a
 * 440x956 viewport at deviceScaleFactor 3). Then point a browser at each
 * generated .html and screenshot it at the size named in `TARGETS`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** The story, in order. Captions must describe what the build actually does. */
export const SHOTS = [
  {
    key: "title",
    head: "FOUR PADS.<br>ONE THUMB.",
    sub: "Fast neon reflex arcade. Try to stop.",
  },
  { key: "shape", head: "SLIDE. AIM. FIRE.", sub: "Hit every symbol with its own pad." },
  { key: "color", head: "DON'T TRUST<br>THE SHAPE", sub: "The shape is a decoy. Match the color." },
  {
    key: "cross",
    head: "THEN THE<br>RULES SWAP",
    sub: "Cross kills square. Two symbols trade places.",
  },
  { key: "triple", head: "AND SWAP<br>AGAIN", sub: "Double cross. Triple cross. Keep up." },
  { key: "combo", head: "CHAIN IT, 5X IT", sub: "Streaks stack multipliers fast." },
  { key: "share", head: "CAN YOU<br>BEAT ME?", sub: "Share your score. Dare your friends." },
];

/**
 * Device sets. The frame sizes itself from the room the caption leaves, so the
 * only per-device knob is how big the headline should read — the iPad canvas is
 * much squarer, and a phone-sized headline there eats the frame.
 */
export const TARGETS = {
  iphone: { w: 1320, h: 2868, prefix: "screenshot", headScale: 0.072 },
  ipad: { w: 2048, h: 2732, prefix: "screenshot-ipad", headScale: 0.058 },
};

/** Raw gameplay captures are always this aspect (1320x2868). */
const CAPTURE_ASPECT = 1320 / 2868;

const page = (shot, t, rawPath) => {
  const headSize = Math.round(t.w * t.headScale);
  const subSize = Math.round(t.w * 0.031);
  // The headline block is pinned to two lines' worth of height whether the
  // caption wraps or not, so the device frame lands at the same y on every
  // screenshot in the set — a set whose frame jumps around reads as sloppy.
  const headBox = Math.round(headSize * 1.06 * 2);
  const topPad = Math.round(t.h * 0.042);
  const subGap = Math.round(t.h * 0.016);
  const subBox = Math.round(subSize * 1.3);
  const frameGap = Math.round(t.h * 0.03);
  const bottomPad = Math.round(t.h * 0.045);
  // Whatever vertical room is left goes to the frame; its width follows.
  const frameH = t.h - (topPad + headBox + subGap + subBox + frameGap + bottomPad);
  const frameW = Math.round(frameH * CAPTURE_ASPECT);

  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${t.w}px;height:${t.h}px;overflow:hidden}
  body{
    background:
      radial-gradient(120% 60% at 50% 0%, #12203f 0%, #070b1a 62%),
      repeating-linear-gradient(0deg,transparent 0 79px,rgba(94,234,212,.045) 79px 80px),
      repeating-linear-gradient(90deg,transparent 0 79px,rgba(94,234,212,.045) 79px 80px),
      #070b1a;
    font-family:"Helvetica Neue",Helvetica,system-ui,-apple-system,sans-serif;
    display:flex;flex-direction:column;align-items:center;padding-top:${topPad}px;
    box-sizing:border-box;
  }
  .head{height:${headBox}px;display:flex;align-items:center;justify-content:center}
  h1{
    margin:0;color:#fff;font-size:${headSize}px;line-height:1.06;
    font-weight:800;letter-spacing:-.5px;text-align:center;text-transform:uppercase;
    text-shadow:0 0 ${Math.round(headSize * 0.5)}px rgba(94,234,212,.55);
  }
  p{
    margin:${subGap}px 0 0;height:${subBox}px;color:#a8b6cf;
    font-size:${subSize}px;font-weight:500;text-align:center
  }
  .frame{
    margin-top:${frameGap}px;width:${frameW}px;height:${frameH}px;
    border-radius:${Math.round(t.w * 0.032)}px;overflow:hidden;
    border:2px solid rgba(94,234,212,.5);
    box-shadow:0 0 ${Math.round(t.w * 0.05)}px rgba(94,234,212,.28),
               0 ${Math.round(t.w * 0.012)}px ${Math.round(t.w * 0.05)}px rgba(0,0,0,.55);
  }
  .frame img{display:block;width:100%;height:100%}
</style>
<div class="head"><h1>${shot.head}</h1></div>
<p>${shot.sub}</p>
<div class="frame"><img src="${rawPath}"></div>`;
};

const [, , rawDir = "raw", outDir = "frames"] = process.argv;
mkdirSync(outDir, { recursive: true });
for (const [device, t] of Object.entries(TARGETS)) {
  SHOTS.forEach((shot, i) => {
    const n = String(i + 1).padStart(2, "0");
    const html = page(shot, t, `file://${resolve(rawDir, `${shot.key}.png`)}`);
    writeFileSync(resolve(outDir, `${t.prefix}-${n}-${shot.key}.html`), html);
  });
  console.log(`${device}: ${SHOTS.length} pages at ${t.w}x${t.h}`);
}
