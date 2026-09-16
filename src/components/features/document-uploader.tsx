"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import {
  getDocuments,
  softDeleteDocumentAction,
  uploadDocumentAction,
} from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EntityType } from "@/types/database";
import { useEffect } from "react";
import { formatDate } from "@/lib/utils";
import { DeleteButton } from "@/components/shared/delete-button";

export function DocumentUploader({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [docs, setDocs] = useState<
    Awaited<ReturnType<typeof getDocuments>>
  >([]);

  useEffect(() => {
    getDocuments({ entity_type: entityType, entity_id: entityId }).then(setDocs);
  }, [entityType, entityId]);

  function refresh() {
    getDocuments({ entity_type: entityType, entity_id: entityId }).then(setDocs);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents</CardTitle>
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.set("file", file);
              fd.set("entity_type", entityType);
              fd.set("entity_id", entityId);
              startTransition(async () => {
                const result = await uploadDocumentAction(fd);
                if (result.success) {
                  toast.success("Uploaded");
                  refresh();
                } else toast.error(result.error ?? "Upload failed");
              });
            }}
          />
          <Button
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {docs.length === 0 && (
          <p className="text-sm text-slate-500">No documents yet.</p>
        )}
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
          >
            <a
              href={
                doc.file_url ||
                (doc.file_path?.startsWith("chat://")
                  ? `/api/groups/files/${doc.file_path.slice("chat://".length)}`
                  : `/api/files/${doc.file_path}`)
              }
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 hover:underline"
            >
              <p className="truncate text-sm font-medium">{doc.name}</p>
              <p className="text-xs text-slate-500">
                {formatDate(doc.created_at)}
                {doc.uploader_name ? ` · ${doc.uploader_name}` : ""}
              </p>
            </a>
            <DeleteButton
              action={async () => {
                const r = await softDeleteDocumentAction(doc.id);
                if (r.success) refresh();
                return r;
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
