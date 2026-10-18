import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { detectFile } from "./files.js";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function cloudinaryEnabled() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET,
  );
}

export function detectImage(buffer: Buffer) {
  const detected = detectFile(buffer);
  if (!detected) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(detected.mimeType)) return null;
  return detected;
}

export function assertPhotoSize(size: number) {
  if (size <= 0 || size > MAX_PHOTO_BYTES) {
    throw new Error("Photo must be between 1 byte and 5 MB.");
  }
}

async function uploadCloudinary(buffer: Buffer, folder: string) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", overwrite: true },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function storeStudentPhoto(schoolId: string, studentId: string, buffer: Buffer, extension: string) {
  if (cloudinaryEnabled()) {
    const uploaded = await uploadCloudinary(buffer, `emp/${schoolId}/students`);
    return {
      photoUrl: uploaded.secure_url,
      photoPublicId: uploaded.public_id,
      photoStorageKey: null as string | null,
    };
  }
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const folder = path.join(process.cwd(), "storage", "photos", schoolId, studentId);
  await mkdir(folder, { recursive: true });
  const fileName = `avatar-${hash}.${extension}`;
  await writeFile(path.join(folder, fileName), buffer);
  return {
    photoUrl: null as string | null,
    photoPublicId: null as string | null,
    photoStorageKey: path.posix.join("photos", schoolId, studentId, fileName),
  };
}

export async function storeGuardianPhoto(schoolId: string, guardianId: string, buffer: Buffer, extension: string) {
  if (cloudinaryEnabled()) {
    const uploaded = await uploadCloudinary(buffer, `emp/${schoolId}/parents`);
    return {
      photoUrl: uploaded.secure_url,
      photoPublicId: uploaded.public_id,
      photoStorageKey: null as string | null,
    };
  }
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const folder = path.join(process.cwd(), "storage", "photos", schoolId, "parents", guardianId);
  await mkdir(folder, { recursive: true });
  const fileName = `avatar-${hash}.${extension}`;
  await writeFile(path.join(folder, fileName), buffer);
  return {
    photoUrl: null as string | null,
    photoPublicId: null as string | null,
    photoStorageKey: path.posix.join("photos", schoolId, "parents", guardianId, fileName),
  };
}

export function guardianPhotoPath(guardianId: string, photoUrl: string | null, photoStorageKey: string | null) {
  if (photoUrl) return photoUrl;
  if (photoStorageKey) return `/api/v1/parents/${guardianId}/photo`;
  return null;
}

export function studentPhotoPath(studentId: string, photoUrl: string | null, photoStorageKey: string | null) {
  if (photoUrl) return photoUrl;
  if (photoStorageKey) return `/api/v1/students/${studentId}/photo`;
  return null;
}
