// Page layout wrapper — clears fixed Header (top) and BottomNav (bottom)

export default function PageWrapper({ children, className = '' }) {
  return (
    <div className={`pt-14 pb-20 min-h-screen bg-slate-50 ${className}`}>
      <div className="px-4 py-4 max-w-lg mx-auto">
        {children}
      </div>
    </div>
  )
}
