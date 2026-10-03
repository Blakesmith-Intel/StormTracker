import { decodeReflectivityImageData, decodeDopplerImageData } from "./palette.js?v=live-bom-v1";

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  throw new Error("No browser canvas implementation is available.");
}

async function blobToImageData(blob) {
  let source;

  if (typeof createImageBitmap === "function") {
    source = await createImageBitmap(blob);
  } else if (typeof document !== "undefined") {
    source = await new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(blob);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to decode browser image."));
      };

      image.src = objectUrl;
    });
  } else {
    throw new Error("This browser cannot decode radar image blobs.");
  }

  const width = source.width ?? source.naturalWidth;
  const height = source.height ?? source.naturalHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) throw new Error("Unable to create image decode canvas.");

  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}

export async function fetchReadableImage(url) {
  let response;

  try {
    response = await fetch(url, {
      mode: "cors",
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(
      `Browser could not fetch readable radar pixels (network/CORS): ${error.message}`
    );
  }

  if (!response.ok) {
    throw new Error(`Image request failed: HTTP ${response.status}`);
  }

  return blobToImageData(await response.blob());
}

export async function fileToImageData(file) {
  return blobToImageData(file);
}

export async function reflectivityFromUrl(url, palette, tolerance = 0) {
  const imageData = await fetchReadableImage(url);
  return {
    width: imageData.width,
    height: imageData.height,
    categories: decodeReflectivityImageData(imageData, palette, tolerance)
  };
}

export async function reflectivityFromFile(file, palette, tolerance = 0) {
  const imageData = await fileToImageData(file);
  return {
    width: imageData.width,
    height: imageData.height,
    categories: decodeReflectivityImageData(imageData, palette, tolerance)
  };
}

export async function dopplerFromUrl(url, palette, tolerance = 0) {
  const imageData = await fetchReadableImage(url);
  return {
    width: imageData.width,
    height: imageData.height,
    velocities: decodeDopplerImageData(imageData, palette, tolerance)
  };
}
