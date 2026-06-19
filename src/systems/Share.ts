import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share as CapShare } from "@capacitor/share";
import { SHARE } from "../config/constants";
import { buildShareCard, ShareCardData } from "../ui/ShareCard";

/**
 * The viral share loop: turns a run into a branded score card + a "beat me"
 * message with a link, and opens the native share sheet (or the Web Share API,
 * with graceful fallbacks). All paths are guarded so a share can never crash
 * the game.
 */
class ShareService {
  private busy = false;

  /** Can we share at all on this platform? (used to show/hide the button) */
  canShare(): boolean {
    if (Capacitor.isNativePlatform()) return true;
    return typeof navigator !== "undefined" && (!!navigator.share || !!navigator.clipboard);
  }

  async shareScore(d: ShareCardData): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const text = `${SHARE.hook(d.score)} ${SHARE.URL}`;
      const canvas = buildShareCard(d);
      if (Capacitor.isNativePlatform()) {
        await this.shareNative(canvas, text);
      } else {
        await this.shareWeb(canvas, text);
      }
    } catch {
      /* user cancelled or share unavailable — ignore */
    } finally {
      this.busy = false;
    }
  }

  private async shareNative(canvas: HTMLCanvasElement, text: string): Promise<void> {
    // Write the PNG to the cache dir, then share the file + text via the OS sheet.
    try {
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      const name = `quadshot-${Date.now()}.png`;
      const file = await Filesystem.writeFile({
        path: name,
        data: base64,
        directory: Directory.Cache,
      });
      await CapShare.share({ title: SHARE.TITLE, text, url: file.uri });
      return;
    } catch {
      /* fall through to text-only share */
    }
    await CapShare.share({ title: SHARE.TITLE, text, url: SHARE.URL });
  }

  private async shareWeb(canvas: HTMLCanvasElement, text: string): Promise<void> {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
    const file = blob ? new File([blob], "quadshot.png", { type: "image/png" }) : null;

    const navAny = navigator as Navigator & {
      canShare?: (data?: unknown) => boolean;
    };
    // Best: share the image file (mobile browsers).
    if (file && navAny.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ title: SHARE.TITLE, text, files: [file] });
      return;
    }
    // Next: share text + link.
    if (navigator.share) {
      await navigator.share({ title: SHARE.TITLE, text, url: SHARE.URL });
      return;
    }
    // Fallback: download the card image and copy the message.
    if (file) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = "quadshot.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  }
}

export const Share = new ShareService();
