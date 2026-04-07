import { cva, type VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase',
  {
    variants: {
      status: {
        running: 'bg-tertiary/10 text-tertiary',
        completed: 'bg-primary/10 text-primary',
        errored: 'bg-error/10 text-error',
        pending: 'bg-on-surface-variant/10 text-on-surface-variant',
      },
    },
    defaultVariants: { status: 'pending' },
  },
)

const dotVariants = cva('w-1.5 h-1.5 rounded-full', {
  variants: {
    status: {
      running: 'bg-tertiary animate-pulse',
      completed: 'bg-primary',
      errored: 'bg-error',
      pending: 'bg-on-surface-variant',
    },
  },
  defaultVariants: { status: 'pending' },
})

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={badgeVariants({ status })}>
      <span className={dotVariants({ status })} />
      {label ?? status}
    </span>
  )
}
