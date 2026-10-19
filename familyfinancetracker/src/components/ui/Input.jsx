// Labelled input with optional ₹ prefix and error display

export default function Input({
  label,
  prefix,
  inputMode,
  value,
  onChange,
  placeholder,
  error,
  maxLength,
  type = 'text',
  id,
  name,
  disabled = false,
  autoFocus = false,
}) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-ink mb-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm select-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`
            w-full rounded-lg border px-3 py-2 text-sm bg-white
            ${prefix ? 'pl-7' : ''}
            ${error
              ? 'border-red-300 focus:ring-red-500'
              : 'border-line focus:ring-accent'}
            focus:outline-none focus:ring-2 focus:border-transparent
            disabled:bg-canvas disabled:text-muted disabled:cursor-not-allowed
          `}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
