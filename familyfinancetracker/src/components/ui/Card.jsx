// Reusable card container with optional danger styling

export default function Card({ children, className = '', danger = false, onClick }) {
  const baseClasses = 'surface'
  const borderClass = danger ? 'border-red-200 border-l-4 border-l-red-500 bg-red-50' : 'border-line'
  const interactiveClass = onClick ? 'cursor-pointer hover:border-accent transition-colors' : ''

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
