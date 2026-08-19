import type { Metadata } from "next"
import BookCanvas from "@/components/books/book-canvas"

export const metadata: Metadata = { title: "Book Editor" }

export default async function BookEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <BookCanvas bookId={id} />
}
