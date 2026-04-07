interface IconProps {
  name: string
  className?: string
  'aria-label'?: string
}

export function Icon({ name, className = '', 'aria-label': ariaLabel }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
    >
      {name}
    </span>
  )
}
