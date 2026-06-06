import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CreditCard, PieChart, Calendar, FileText } from 'lucide-react'

const TABS = [
  { label: 'Home',     icon: Home,       path: '/dashboard'  },
  { label: 'Expenses', icon: CreditCard,  path: '/expenses'   },
  { label: 'Assets',   icon: PieChart,    path: '/assets'     },
  { label: 'Goals',    icon: Calendar,    path: '/milestones' },
  { label: 'Report',   icon: FileText,    path: '/report'     },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-slate-200 h-16">
      <div className="flex items-stretch h-full max-w-lg mx-auto">
        {TABS.map(({ label, icon: Icon, path }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
                ${active ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
