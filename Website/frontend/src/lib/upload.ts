import { apiFetch } from "@/lib/api";

/** Read a File into a base64 data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

const MAX_BYTES = 6 * 1024 * 1024; // 6MB

/** Upload an image file to the backend and return its public URL. */
export async function uploadImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_BYTES) throw new Error("Image is too large (max 6MB).");

  const dataUrl = await fileToDataUrl(file);
  const { url } = await apiFetch<{ url: string }>("/api/uploads", {
    method: "POST",
    body: JSON.stringify({ image: dataUrl }),
  });
  return url;
}
