// Reusable button with variant, size, loading, and disabled support

const VARIANT_CLASSES = {
  primary:   'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  ghost:     'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200',
}

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
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
