import Phaser from "phaser";
import { ALL_SYMBOLS, COLORS, GAME, LAUNCHER, TEX, Sym } from "../config/constants";

export interface FireEvent {
  index: number;
  shape: Sym;
  color: number;
  x: number; // world x of the muzzle
  y: number; // world y of the muzzle
}

/** One on-screen instance of a pad (a pad has two: its primary + a wrap ghost). */
interface PadSprite {
  body: Phaser.GameObjects.Image; // dark glossy button (untinted)
  rim: Phaser.GameObjects.Image; //  coloured neon ring + glow
  icon: Phaser.GameObjects.Image; // coloured symbol outline
  guide: Phaser.GameObjects.Rectangle;
}

interface Pad {
  index: number;
  shape: Sym;
  color: number;
  base: number; // centre x at scroll offset 0
  primary: PadSprite;
  ghost: PadSprite; // drawn at x ∓ WIDTH; off-screen except when wrapping an edge
}

const W = GAME.WIDTH;

/**
 * The launcher: four round controller-style pads laid across the screen width
 * as an endless horizontal carousel. Sliding scrolls the whole row; a pad that
 * leaves one edge seamlessly re-appears on the opposite edge (a wrap "ghost"
 * sprite fills the gap). Each pad fires its own symbol straight up.
 */
export class Launcher {
  private readonly scene: Phaser.Scene;
  private readonly pads: Pad[] = [];

  // Height-derived geometry (resolved at construction, once GAME.HEIGHT is set).
  private readonly guideBottom = LAUNCHER.Y - LAUNCHER.PAD_D * 0.32;
  private readonly guideHeight = this.guideBottom - 40;

  private offset = 0; // carousel scroll, unbounded (wrapped when positioning)
  private lift = 0; //   per-phase climb: how far the rack has risen (px)

  /** Muzzle Y where shots spawn — rises with the per-phase climb. */
  private get muzzleY(): number {
    return LAUNCHER.Y - 32 - this.lift;
  }
  private enabled = true;
  private lastFireAt = -Infinity;

  // Pointer drag state.
  private pointerDown = false;
  private dragging = false;
  private downX = 0;
  private downY = 0;
  private offsetAtDown = 0;
  private pendingPad = -1;

  // Keyboard.
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  onFire?: (e: FireEvent) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildPads();
    this.positionPads();
    this.bindInput();
    this.pulseGuides();
  }

  private makePadSprite(shape: Sym, color: number): PadSprite {
    const iconSize = LAUNCHER.PAD_D * LAUNCHER.ICON_FRAC;
    const guide = this.scene.add
      .rectangle(0, this.guideBottom, 4, this.guideHeight, color, 0.12)
      .setOrigin(0.5, 1)
      .setDepth(18);
    const body = this.scene.add
      .image(0, LAUNCHER.Y, TEX.padRound)
      .setDisplaySize(LAUNCHER.PAD_D, LAUNCHER.PAD_D)
      .setDepth(20); // dark body, untinted
    const rim = this.scene.add
      .image(0, LAUNCHER.Y, TEX.padRing)
      .setDisplaySize(LAUNCHER.PAD_D, LAUNCHER.PAD_D)
      .setTint(color)
      .setDepth(21);
    const icon = this.scene.add
      .image(0, LAUNCHER.Y, TEX.shape(shape))
      .setDisplaySize(iconSize, iconSize)
      .setTint(color)
      .setDepth(22);
    return { body, rim, icon, guide };
  }

  private buildPads(): void {
    ALL_SYMBOLS.forEach((shape, i) => {
      const color = COLORS[shape];
      this.pads.push({
        index: i,
        shape,
        color,
        base: LAUNCHER.BASES[i],
        primary: this.makePadSprite(shape, color),
        ghost: this.makePadSprite(shape, color),
      });
    });
  }

  private pulseGuides(): void {
    this.pads.forEach((p) => {
      this.scene.tweens.add({
        targets: [p.primary.guide, p.ghost.guide],
        alpha: { from: 0.06, to: 0.2 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    });
  }

  /** Compute each pad's wrapped x and place its primary + ghost sprites. */
  private positionPads(): void {
    for (const p of this.pads) {
      const x = Phaser.Math.Wrap(p.base + this.offset, 0, W);
      const ghostX = x >= W / 2 ? x - W : x + W;
      this.place(p.primary, x);
      this.place(p.ghost, ghostX);
    }
  }

  private place(s: PadSprite, x: number): void {
    s.body.x = x;
    s.rim.x = x;
    s.icon.x = x;
    s.guide.x = x;
  }

  private bindInput(): void {
    const input = this.scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    // iOS/WKWebView (Capacitor) often delivers a tap's release as
    // POINTER_UP_OUTSIDE (or a touchcancel routed to it) instead of POINTER_UP —
    // e.g. when the tap's haptic/audio/gesture heuristics make upElement != canvas.
    // Without this, `pointerDown` would stay stuck true and firing would wedge
    // after the first shot. Routing it through the same release handler fixes it.
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);

    const kb = input.keyboard;
    if (kb) {
      this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
      this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
      this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      kb.on("keydown-ONE", () => this.fire(0));
      kb.on("keydown-TWO", () => this.fire(1));
      kb.on("keydown-THREE", () => this.fire(2));
      kb.on("keydown-FOUR", () => this.fire(3));
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    this.pointerDown = true;
    this.dragging = false;
    this.downX = pointer.x;
    this.downY = pointer.y;
    this.offsetAtDown = this.offset;
    this.pendingPad = this.padAt(pointer.x, pointer.y);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || !this.pointerDown) return;
    const dx = pointer.x - this.downX;
    const dy = pointer.y - this.downY;
    if (!this.dragging && Math.hypot(dx, dy) > LAUNCHER.DRAG_THRESHOLD) {
      this.dragging = true;
    }
    if (this.dragging) {
      this.offset = this.offsetAtDown + dx; // carousel follows the finger
      this.positionPads();
    }
  }

  private onPointerUp(): void {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    // A press that never crossed the drag threshold is a tap: fire the pad it
    // began on. We trust `pendingPad` (captured on press) rather than the
    // release coordinates, because a release reported as POINTER_UP_OUTSIDE /
    // touchcancel on iOS can carry stale coordinates — re-checking them there is
    // exactly what used to drop the shot. If it was a drag, we scrolled instead.
    if (!this.dragging && this.pendingPad >= 0) this.fire(this.pendingPad);
    this.dragging = false;
    this.pendingPad = -1;
  }

  /**
   * Pad index under a world point. The control area is the whole bottom strip —
   * from a little above the pads down to the screen edge — split into four
   * columns, so a tap anywhere on a pad (or below it, toward the screen bottom)
   * fires that pad. This is forgiving for thumbs and robust to the small
   * touch-position offsets that device safe-area insets can introduce (which
   * otherwise made only the top of each pad respond). The nearest column wins,
   * so there are no dead gaps between pads. Wrap ghosts are considered too.
   */
  private padAt(px: number, py: number): number {
    if (py < LAUNCHER.Y - (LAUNCHER.HIT_R + 16)) return -1; // above the control strip
    let best = -1;
    let bestDist = Infinity;
    for (const p of this.pads) {
      const x = Phaser.Math.Wrap(p.base + this.offset, 0, W);
      const ghostX = x >= W / 2 ? x - W : x + W;
      const d = Math.min(Math.abs(px - x), Math.abs(px - ghostX));
      if (d < bestDist) {
        bestDist = d;
        best = p.index;
      }
    }
    return best;
  }

  /** Per-frame keyboard scroll. `dt` is in seconds. */
  update(dt: number): void {
    if (this.enabled) {
      let dir = 0;
      if (this.keyLeft?.isDown || this.keyA?.isDown) dir -= 1;
      if (this.keyRight?.isDown || this.keyD?.isDown) dir += 1;
      if (dir !== 0) this.offset += dir * LAUNCHER.KEY_SPEED * dt;
    }
    this.positionPads();
  }

  fire(i: number): void {
    if (!this.enabled) return;
    const pad = this.pads[i];
    if (!pad) return;
    const now = this.scene.time.now;
    if (now - this.lastFireAt < LAUNCHER.FIRE_COOLDOWN) return;
    this.lastFireAt = now;

    const x = Phaser.Math.Wrap(pad.base + this.offset, 0, W);
    // Guard the flash so a visual hiccup can never block the actual shot.
    try {
      this.flashPad(pad, x);
      this.recoil(pad);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Quadshot] flashPad error:", err);
    }
    this.onFire?.({ index: i, shape: pad.shape, color: pad.color, x, y: this.muzzleY });
  }

  /** A short downward kick on the fired pad — recoil feedback. */
  private recoil(pad: Pad): void {
    const parts = [pad.primary.body, pad.primary.rim, pad.primary.icon];
    const restY = LAUNCHER.Y - this.lift; // rest position accounts for the climb
    this.scene.tweens.killTweensOf(parts);
    parts.forEach((s) => (s.y = restY));
    this.scene.tweens.add({
      targets: parts,
      y: restY + 7,
      duration: 70,
      yoyo: true,
      ease: "Quad.out",
    });
  }

  /** Raise (or lower) the whole rack by `px` — the per-phase "climb". */
  setLift(px: number): void {
    if (px === this.lift) return;
    this.lift = px;
    for (const p of this.pads) {
      for (const s of [p.primary, p.ghost]) {
        this.scene.tweens.add({
          targets: [s.body, s.rim, s.icon],
          y: LAUNCHER.Y - px,
          duration: 400,
          ease: "Quad.out",
        });
        this.scene.tweens.add({
          targets: s.guide,
          y: this.guideBottom - px,
          duration: 400,
          ease: "Quad.out",
        });
      }
    }
  }

  /** Flare every pad rim white briefly — used on phase-up. */
  flarePads(): void {
    this.pads.forEach((p) => {
      [p.primary.rim, p.ghost.rim].forEach((rim) => {
        rim.setTint(0xffffff);
        this.scene.time.delayedCall(150, () => rim.setTint(p.color));
      });
    });
  }

  /** Press feedback: a bright ring that pops outward and fades (no sprite-scale clobber). */
  private flashPad(pad: Pad, x: number): void {
    const flash = this.scene.add
      .image(x, LAUNCHER.Y, TEX.padRing)
      .setDisplaySize(LAUNCHER.PAD_D, LAUNCHER.PAD_D)
      .setTint(pad.color)
      .setAlpha(0.9)
      .setDepth(23)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: flash,
      scale: flash.scale * 1.3,
      alpha: 0,
      duration: 200,
      ease: "Quad.out",
      onComplete: () => flash.destroy(),
    });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  reset(): void {
    this.lastFireAt = -Infinity;
    this.pointerDown = false;
    this.dragging = false;
    this.pendingPad = -1;
    this.offset = 0;
    this.positionPads();
    this.setEnabled(true);
  }

  destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    const kb = input.keyboard;
    if (kb) {
      kb.off("keydown-ONE");
      kb.off("keydown-TWO");
      kb.off("keydown-THREE");
      kb.off("keydown-FOUR");
    }
    this.pads.forEach((p) => {
      [p.primary, p.ghost].forEach((s) => {
        this.scene.tweens.killTweensOf(s.guide); // stop the infinite pulse first
        s.body.destroy();
        s.rim.destroy();
        s.icon.destroy();
        s.guide.destroy();
      });
    });
  }
}
