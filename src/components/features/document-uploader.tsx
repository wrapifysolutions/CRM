"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Upload } from "lucide-react";
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

function docUrl(doc: {
  file_url?: string | null;
  file_path?: string | null;
}) {
  if (doc.file_url) return doc.file_url;
  const path = doc.file_path ?? "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("chat://")) {
    return `/api/groups/files/${path.slice("chat://".length)}`;
  }
  return path ? `/api/files/${path}` : null;
}

function isImageDoc(doc: { mime_type?: string | null; name?: string }) {
  if (doc.mime_type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(doc.name ?? "");
}

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

  const images = docs.filter(isImageDoc);
  const files = docs.filter((d) => !isImageDoc(d));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents</CardTitle>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
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
      <CardContent className="space-y-4">
        {docs.length === 0 && (
          <p className="text-sm text-slate-500">No documents yet.</p>
        )}

        {images.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Images
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((doc) => {
                const href = docUrl(doc);
                return (
                  <div
                    key={doc.id}
                    className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  >
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={href}
                          alt={doc.name}
                          className="aspect-square w-full object-cover transition group-hover:opacity-90"
                        />
                      </a>
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-slate-400">
                        <FileText className="h-8 w-8" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <p className="truncate text-xs font-medium">{doc.name}</p>
                      <DeleteButton
                        action={async () => {
                          const r = await softDeleteDocumentAction(doc.id);
                          if (r.success) refresh();
                          return r;
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-2">
            {images.length > 0 && (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Files
              </p>
            )}
            {files.map((doc) => {
              const href = docUrl(doc);
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
                >
                  <a
                    href={href ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(doc.created_at)}
                        {doc.uploader_name ? ` · ${doc.uploader_name}` : ""}
                      </p>
                    </div>
                    <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </a>
                  <DeleteButton
                    action={async () => {
                      const r = await softDeleteDocumentAction(doc.id);
                      if (r.success) refresh();
                      return r;
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
