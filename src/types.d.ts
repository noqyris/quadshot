import type Phaser from "phaser";

declare global {
  interface Window {
    /** The Phaser game instance, exposed for debugging / automated smoke tests. */
    game?: Phaser.Game;
    /** Dev-only: render a share card to a PNG data URL (set when DEV.ENABLED). */
    __shareCard?: (d: unknown) => string;
  }
}

export {};
