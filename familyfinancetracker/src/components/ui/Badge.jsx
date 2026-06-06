// Small pill badge with colour variants

const COLOR_CLASSES = {
  violet: 'bg-violet-100 text-violet-700',
  green:  'bg-emerald-100 text-emerald-700',
  red:    'bg-red-100 text-red-700',
  amber:  'bg-amber-100 text-amber-700',
  slate:  'bg-slate-100 text-slate-600',
  blue:   'bg-blue-100 text-blue-700',
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
