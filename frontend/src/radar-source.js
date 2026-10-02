import { decodeReflectivityImageData, decodeDopplerImageData } from "./palette.js";

async function blobToImageData(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap,0,0);
  return ctx.getImageData(0,0,bitmap.width,bitmap.height);
}

export async function fetchReadableImage(url) {
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error(`Image request failed: HTTP ${response.status}`);
  return blobToImageData(await response.blob());
}

export async function fileToImageData(file) {
  return blobToImageData(file);
}

export async function reflectivityFromUrl(url, palette, tolerance = 0) {
  const imageData = await fetchReadableImage(url);
  return { width: imageData.width, height: imageData.height, categories: decodeReflectivityImageData(imageData,palette,tolerance) };
}

export async function reflectivityFromFile(file, palette, tolerance = 0) {
  const imageData = await fileToImageData(file);
  return { width: imageData.width, height: imageData.height, categories: decodeReflectivityImageData(imageData,palette,tolerance) };
}

export async function dopplerFromUrl(url, palette, tolerance = 0) {
  const imageData = await fetchReadableImage(url);
  return { width: imageData.width, height: imageData.height, velocities: decodeDopplerImageData(imageData,palette,tolerance) };
}
