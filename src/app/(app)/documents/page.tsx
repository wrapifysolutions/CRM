import { getDocuments } from "@/actions/documents";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { softDeleteDocumentAction } from "@/actions/documents";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const docs = await getDocuments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-slate-500">
          Files uploaded across projects and tasks
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Linked to</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                    No documents uploaded yet. Upload from a client, project, or
                    task page.
                  </TableCell>
                </TableRow>
              )}
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {doc.file_url ? (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {doc.name}
                      </a>
                    ) : (
                      doc.name
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {doc.entity_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {doc.file_size
                      ? `${Math.round(doc.file_size / 1024)} KB`
                      : "—"}
                  </TableCell>
                  <TableCell>{formatDate(doc.created_at)}</TableCell>
                  <TableCell>
                    <DeleteButton
                      action={softDeleteDocumentAction.bind(null, doc.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
