// Reusable button with variant, size, loading, and disabled support

const VARIANT_CLASSES = {
  primary:   'bg-accent text-white hover:bg-accent active:bg-accent',
  secondary: 'bg-canvas text-ink hover:bg-canvas active:bg-surface',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  ghost:     'bg-transparent text-muted hover:bg-canvas active:bg-canvas',
}

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  onClick,
  children,
  className = '',
  disabled = false,
  type = 'button',
}) {
  const isDisabled = disabled || loading
  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium transition-colors
        ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary}
        ${SIZE_CLASSES[size] ?? SIZE_CLASSES.md}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {loading ? (
        <span
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        children
      )}
    </button>
  )
}
