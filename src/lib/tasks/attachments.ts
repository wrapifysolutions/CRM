import { ChatFileModel, DocumentModel, newId } from "@/lib/db/models";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_EXT =
  /\.(jpe?g|png|gif|webp|heic|heif|pdf|doc|docx|xls|xlsx|txt|csv)$/i;

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
    ALLOWED_EXT.test(file.name);
  if (!ok) {
    return `${file.name}: only images, PDF, Word, Excel, or text allowed`;
  }
  return null;
}

/** Persist attachment in MongoDB (Vercel-safe) and index as a Document row. */
export async function saveTaskAttachments(params: {
  files: File[];
  taskId: string;
  uploadedBy: string;
  projectId?: string | null;
}) {
  const saved: { id: string; name: string }[] = [];

  for (const file of params.files.slice(0, 5)) {
    const err = validateTaskAttachment(file);
    if (err) throw new Error(err);

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileId = newId();
    const mime = file.type || "application/octet-stream";

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

    await DocumentModel.create({
      id: newId(),
      name: file.name,
      file_path: `chat://${fileId}`,
      file_size: bytes.length,
      mime_type: mime,
      entity_type: "task",
      entity_id: params.taskId,
      uploaded_by: params.uploadedBy,
    });

    saved.push({ id: fileId, name: file.name });
  }

  return saved;
}

export function attachmentPublicUrl(fileId: string) {
  return `/api/groups/files/${fileId}`;
}
