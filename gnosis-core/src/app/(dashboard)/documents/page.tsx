import type { Metadata } from "next"
import { UploadZone } from "@/components/documents/upload-zone"
import { DocumentsList } from "@/components/documents/documents-list"

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
          {/* Info tip — inline on mobile, hidden here on lg (shown in aside) */}
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2 lg:hidden">
            <p className="font-medium text-foreground">How it works</p>
            <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
              <li>Upload a PDF or image (max 4 MB)</li>
              <li>We convert it to optimized Markdown</li>
              <li>Generate questions from the processed content</li>
            </ol>
          </div>
          <UploadZone />
          <DocumentsList />
        </div>
        <aside className="hidden lg:block">
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How it works</p>
            <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
              <li>Upload a PDF or image (max 4 MB)</li>
              <li>We convert it to optimized Markdown</li>
              <li>Generate questions from the processed content</li>
            </ol>
            <p className="text-xs">Max 20 MB per upload session.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
