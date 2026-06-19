/**
 * Tiny Web Audio synth — all SFX are generated at runtime, no asset files.
 *
 * The AudioContext is created lazily and resumed on the first user gesture
 * (browsers block audio before then). A master gain node implements mute.
 */
class SfxService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Call from within a user-gesture handler (pointerdown / keydown / tap). */
  unlock(): void {
    this.ensure();
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  private ensure(): boolean {
    if (this.ctx) return true;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return false;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    return true;
  }

  /** A single enveloped oscillator note. `t0` is an offset from "now" in seconds. */
  private note(
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    t0 = 0
  ): void {
    if (this.muted || !this.ensure() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime + t0;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /** Short upward blip when a pad fires. */
  fire(): void {
    this.note(520, 0.09, "square", 0.16);
    this.note(780, 0.07, "square", 0.08, 0.005);
  }

  /** Match chime — pitch rises with combo so streaks sound better. */
  match(combo: number): void {
    const base = 440;
    const semis = Math.min(combo, 16); // cap so it never gets shrill
    const freq = base * Math.pow(2, semis / 12);
    this.note(freq, 0.16, "triangle", 0.2);
    this.note(freq * 1.5, 0.12, "sine", 0.1, 0.02);
  }

  /** Falling "thunk" when a target is missed. */
  miss(): void {
    if (this.muted || !this.ensure() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.3);
    env.gain.setValueAtTime(0.22, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  /** Short descending arpeggio at game over. */
  gameOver(): void {
    const seq = [440, 349.23, 261.63, 174.61];
    seq.forEach((f, i) => this.note(f, 0.28, "triangle", 0.2, i * 0.13));
  }
}

export const Sfx = new SfxService();
