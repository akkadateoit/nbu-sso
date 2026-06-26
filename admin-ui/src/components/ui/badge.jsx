import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-[--color-primary] text-[--color-primary-foreground] shadow',
        secondary:   'border-transparent bg-[--color-secondary] text-[--color-secondary-foreground]',
        destructive: 'border-transparent bg-[--color-destructive] text-[--color-destructive-foreground] shadow',
        outline:     'text-[--color-foreground]',
        success:     'border-transparent bg-green-100 text-green-800',
        warning:     'border-transparent bg-yellow-100 text-yellow-800',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
