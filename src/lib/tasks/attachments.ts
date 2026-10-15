import { ChatFileModel, DocumentModel, newId } from "@/lib/db/models";
import { isRemoteUrl, tryUploadToCloudinary } from "@/lib/cloudinary";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_EXT =
  /\.(jpe?g|png|gif|webp|heic|heif|pdf|doc|docx|xls|xlsx|txt|csv)$/i;

const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const WORD_LEGACY = "application/msword";
const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EXCEL_LEGACY = "application/vnd.ms-excel";

export function isUploadedFile(value: FormDataEntryValue): value is File {
  if (typeof value !== "object" || value === null) return false;
  const f = value as File;
  return (
    typeof f.arrayBuffer === "function" &&
    typeof f.size === "number" &&
    f.size > 0 &&
    typeof f.name === "string"
  );
}

export function validateTaskAttachment(file: File): string | null {
  if (file.size > MAX_BYTES) return `${file.name} is larger than 6MB`;
  const mime = file.type || "application/octet-stream";
  const ok =
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === WORD_MIME ||
    mime === WORD_LEGACY ||
    mime === EXCEL_MIME ||
    mime === EXCEL_LEGACY ||
    ALLOWED_EXT.test(file.name);
  if (!ok) {
    return `${file.name}: only images, PDF, Word, Excel, or text allowed`;
  }
  return null;
}

/**
 * Prefer Cloudinary (images + docs). Fall back to Mongo chat:// if Cloudinary
 * is missing or rejects the upload (so assign/chat never hard-fails).
 */
export async function saveTaskAttachments(params: {
  files: File[];
  taskId: string;
  uploadedBy: string;
  projectId?: string | null;
}) {
  const saved: { id: string; name: string; url?: string }[] = [];

  for (const file of params.files.slice(0, 5)) {
    const err = validateTaskAttachment(file);
    if (err) throw new Error(err);

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileId = newId();
    const mime = file.type || "application/octet-stream";

    const cloud = await tryUploadToCloudinary({
      buffer: bytes,
      folder: `wrapcrm/tasks/${params.taskId}`,
      filename: file.name,
      mimeType: mime,
    });

    let filePath: string;
    if (cloud) {
      filePath = cloud.url;
    } else {
      await ChatFileModel.create({
        id: fileId,
        group_id: `task:${params.taskId}`,
        message_id: params.taskId,
        uploaded_by: params.uploadedBy,
        file_name: file.name,
        mime_type: mime,
        size: bytes.length,
        data: bytes,
      });
      filePath = `chat://${fileId}`;
    }

    await DocumentModel.create({
      id: newId(),
      name: file.name,
      file_name: file.name,
      file_path: filePath,
      file_size: bytes.length,
      mime_type: mime,
      entity_type: "task",
      entity_id: params.taskId,
      uploaded_by: params.uploadedBy,
    });

    saved.push({
      id: fileId,
      name: file.name,
      url: isRemoteUrl(filePath) ? filePath : undefined,
    });
  }

  return saved;
}

export function attachmentPublicUrl(fileId: string) {
  return `/api/groups/files/${fileId}`;
}
