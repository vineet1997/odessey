import { toBlob } from "html-to-image";

const WIDTH = 1080;
const HEIGHT = 1350;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}

async function settleArtifact(element: HTMLElement): Promise<void> {
  const image = element.querySelector("img");
  if (image) {
    if (!image.complete) await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("The helmet image could not load.")), { once: true });
    });
    if ("decode" in image) await image.decode().catch(() => undefined);
  }
  await document.fonts?.ready;
  // A task tick lets layout settle without rAF, which can stop indefinitely
  // when a mobile browser backgrounds the page during a share flow.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
}

export async function exportShareArtifact(element: HTMLElement): Promise<Blob> {
  await withTimeout(settleArtifact(element), 7000, "The brief did not finish loading.");
  const blob = await withTimeout(
    toBlob(element, {
      width: WIDTH,
      height: HEIGHT,
      canvasWidth: WIDTH,
      canvasHeight: HEIGHT,
      pixelRatio: 1,
      backgroundColor: "#070b10",
      cacheBust: true,
      skipFonts: true,
    }),
    12000,
    "Timed out generating the image."
  );
  if (!blob) throw new Error("Could not generate the share image.");
  return blob;
}

export function downloadShareArtifact(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
