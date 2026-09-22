"use client"

interface FlatBlock { id: string; level: string; text: string }

interface ChapterPickerProps {
  blocks: FlatBlock[]
  onSelect: (nodeId: string, title: string) => void
  disabled?: boolean
}

export function ChapterPicker({ blocks, onSelect, disabled }: ChapterPickerProps) {
  const chapters = blocks.filter(b => b.level === "chapter")

  return (
    <select
      disabled={disabled || !chapters.length}
      defaultValue=""
      onChange={e => {
        const chapter = chapters.find(c => c.id === e.target.value)
        if (chapter) { onSelect(chapter.id, chapter.text); e.target.value = "" }
      }}
      className="rounded-md border border-dashed border-border bg-background px-2.5 py-1 text-xs text-muted-foreground outline-none hover:border-ring hover:text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-40 transition-colors"
    >
      <option value="" disabled>+ Assign chapter</option>
      {chapters.map(c => (
        <option key={c.id} value={c.id}>{c.text}</option>
      ))}
    </select>
  )
}
