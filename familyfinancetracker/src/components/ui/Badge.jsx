// Small pill badge with colour variants

const COLOR_CLASSES = {
  violet: 'bg-accent-soft text-accent',
  green:  'bg-accent-soft text-accent',
  red:    'bg-red-100 text-red-700',
  amber:  'bg-canvas text-ink',
  slate:  'bg-canvas text-muted',
  blue:   'bg-accent-soft text-accent',
}

export default function Badge({ color = 'slate', children, className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
        ${COLOR_CLASSES[color] ?? COLOR_CLASSES.slate}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
