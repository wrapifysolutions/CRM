import { v2 as cloudinary } from "cloudinary";

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function ensureConfigured() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function isRemoteUrl(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.startsWith("https://") || path.startsWith("http://");
}

/** Resolve a document/chat file path to a browser-safe URL. */
export function resolveFileUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (isRemoteUrl(filePath)) return filePath;
  if (filePath.startsWith("chat://")) {
    return `/api/groups/files/${filePath.slice("chat://".length)}`;
  }
  return `/api/files/${filePath}`;
}

export function isImageFile(mime: string | null | undefined, name: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
}

type UploadResult = { url: string; publicId: string };

/**
 * Upload any file to Cloudinary.
 * Images use resource_type "image"; everything else uses "raw".
 */
export async function uploadToCloudinary(params: {
  buffer: Buffer;
  folder: string;
  filename: string;
  mimeType?: string | null;
}): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  ensureConfigured();
  const image = isImageFile(params.mimeType, params.filename);
  const resourceType = image ? "image" : "raw";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: params.folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        filename_override: params.filename,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          const msg =
            error && typeof error === "object" && "message" in error
              ? String((error as { message: unknown }).message)
              : "Cloudinary upload failed";
          reject(new Error(msg));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    stream.end(params.buffer);
  });
}

/** Prefer Cloudinary; return null if not configured or upload fails. */
export async function tryUploadToCloudinary(params: {
  buffer: Buffer;
  folder: string;
  filename: string;
  mimeType?: string | null;
}): Promise<UploadResult | null> {
  if (!isCloudinaryConfigured()) return null;
  try {
    return await uploadToCloudinary(params);
  } catch (error) {
    console.error("[cloudinary] upload failed, using local fallback:", error);
    return null;
  }
}

/** @deprecated use uploadToCloudinary */
export async function uploadImageToCloudinary(params: {
  buffer: Buffer;
  folder: string;
  filename?: string;
}): Promise<UploadResult> {
  return uploadToCloudinary({
    buffer: params.buffer,
    folder: params.folder,
    filename: params.filename || "image",
    mimeType: "image/*",
  });
}
