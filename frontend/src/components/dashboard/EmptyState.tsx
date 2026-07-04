import type { ReactNode } from 'react'

interface Props {
  icon: ReactNode
  title: string
  message: string
}

/** Calm, reusable empty state — used when there's simply nothing to worry about. */
export function EmptyState({ icon, title, message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-surface text-good">
        {icon}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-xs text-xs text-muted">{message}</p>
    </div>
  )
}
