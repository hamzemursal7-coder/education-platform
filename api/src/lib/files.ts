import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 10 * 1024 * 1024;

type Detected = { mimeType: string; extension: string };

export function detectFile(buffer: Buffer): Detected | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return { mimeType: "application/pdf", extension: "pdf" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

export function assertUploadSize(size: number) {
  if (size <= 0 || size > MAX_BYTES) {
    throw new Error("File must be between 1 byte and 10 MB.");
  }
}

export async function storeDocumentFile(schoolId: string, studentId: string, buffer: Buffer, extension: string) {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const folder = path.join(process.cwd(), "storage", "documents", schoolId, studentId);
  await mkdir(folder, { recursive: true });
  const fileName = `${Date.now()}-${hash}.${extension}`;
  const absolute = path.join(folder, fileName);
  await writeFile(absolute, buffer);
  return path.posix.join("documents", schoolId, studentId, fileName);
}

export function absoluteStoragePath(storageKey: string) {
  return path.join(process.cwd(), "storage", storageKey);
}
