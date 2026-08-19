import type { Metadata } from "next"
import { BooksList } from "@/components/books/books-list"

export const metadata: Metadata = { title: "Books" }

export default function BooksPage() {
  return <BooksList />
}
