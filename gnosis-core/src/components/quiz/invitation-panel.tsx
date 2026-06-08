"use client"

// Phase 4 rewrite: the invitation model is replaced by the test assignment workflow.
// Educators assign tests directly to linked students via /tests/[id]/assign.
export function InvitationPanel({ configs: _ }: { configs: unknown[] }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
      <p className="font-medium">Invitations are now test assignments</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Use the Assign button on any published test to give linked students access.
      </p>
    </div>
  )
}
