export interface Base64Image {
  data: string;
  mediaType: "image/jpeg";
}

// Phone photos are several MB; Claude reads text just as well at this size
const MAX_EDGE = 1600;

// Resizes a photo to fit MAX_EDGE and re-encodes it as base64 JPEG for upload
export async function shrinkImage(file: File): Promise<Base64Image> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that photo");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
}
