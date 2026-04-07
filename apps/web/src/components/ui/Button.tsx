import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-bold uppercase transition-all active:scale-95 focus:ring-1 focus:ring-primary focus:outline-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-lg text-xs tracking-widest py-3 px-4',
        mega:
          'w-full bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-xl py-6 font-headline font-black text-2xl tracking-tighter active:scale-[0.98] group relative overflow-hidden',
        outline:
          'border border-primary/30 text-primary rounded-lg text-xs tracking-widest py-2 px-4 hover:bg-primary/5',
        icon: 'text-on-surface-variant hover:text-primary p-1 rounded',
        destructive: 'text-on-surface-variant hover:text-error p-1 rounded',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ variant, className = '', children, ...props }: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, className })} {...props}>
      {children}
    </button>
  )
}
