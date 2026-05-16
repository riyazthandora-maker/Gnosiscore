import type { Metadata } from "next"
import { UploadZone } from "@/components/documents/upload-zone"
import { DocumentsList } from "@/components/documents/documents-list"
import { StorageUsage } from "@/components/documents/storage-usage"

export const metadata: Metadata = { title: "Documents" }

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Upload PDFs or images to generate practice tests from.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <UploadZone />
          <DocumentsList />
        </div>
        <aside className="space-y-4">
          <StorageUsage />
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How it works</p>
            <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
              <li>Upload a PDF or image</li>
              <li>We convert it to optimized Markdown</li>
              <li>Click <span className="font-medium text-foreground">New test</span> to generate questions</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}
