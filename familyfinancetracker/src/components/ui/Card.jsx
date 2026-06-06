// Reusable card container with optional danger styling

export default function Card({ children, className = '', danger = false, onClick }) {
  const baseClasses = 'rounded-xl shadow-sm border bg-white p-4'
  const borderClass = danger ? 'border-red-200 border-l-4 border-l-red-500 bg-red-50' : 'border-slate-100'
  const interactiveClass = onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''

  return (
    <div
      className={`${baseClasses} ${borderClass} ${interactiveClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(e) } : undefined}
    >
      {children}
    </div>
  )
}
