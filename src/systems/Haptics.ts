import { Capacitor } from "@capacitor/core";
import {
  Haptics as CapHaptics,
  ImpactStyle,
  NotificationType,
} from "@capacitor/haptics";

/**
 * Thin haptics wrapper. Uses native taptic feedback on device; falls back to
 * `navigator.vibrate` on supporting web browsers. All calls are fire-and-forget
 * and guarded, so they never throw or block the game loop. Honours a setting.
 */
class HapticsService {
  private enabled = true;
  private readonly native = Capacitor.isNativePlatform();

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Light tap — firing a pad. */
  fire(): void {
    this.impact(ImpactStyle.Light, 10);
  }

  /** Heavier knock — missing a target (losing a life). */
  miss(): void {
    this.impact(ImpactStyle.Heavy, 40);
  }

  /** Positive cue — advancing a phase. */
  phaseUp(): void {
    this.notify(NotificationType.Success, [18, 40, 18]);
  }

  /** Strong negative cue — game over. */
  gameOver(): void {
    this.notify(NotificationType.Error, [60, 50, 80]);
  }

  private impact(style: ImpactStyle, webMs: number): void {
    if (!this.enabled) return;
    // Fully guarded: a haptics call must never throw (e.g. on the iOS Simulator,
    // which has no Taptic Engine) and break the game loop.
    try {
      if (this.native) void CapHaptics.impact({ style }).catch(() => {});
      else this.webVibrate(webMs);
    } catch {
      /* haptics unavailable; ignore */
    }
  }

  private notify(type: NotificationType, webPattern: number[]): void {
    if (!this.enabled) return;
    try {
      if (this.native) void CapHaptics.notification({ type }).catch(() => {});
      else this.webVibrate(webPattern);
    } catch {
      /* haptics unavailable; ignore */
    }
  }

  private webVibrate(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* unsupported; ignore */
    }
  }
}

export const Haptics = new HapticsService();
