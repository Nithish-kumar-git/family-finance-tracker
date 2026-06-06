/**
 * PWAInstallButton — renders an "Install App" button only when the browser
 * fires the beforeinstallprompt event. Renders null otherwise.
 * Designed to be dropped into Header.jsx with a single import + JSX line.
 */
import { Download } from 'lucide-react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

export function PWAInstallButton() {
  const { isInstallable, triggerInstall } = usePWAInstall()

  if (!isInstallable) return null

  return (
    <button
      onClick={triggerInstall}
      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-600 border border-violet-200 rounded-lg bg-violet-50 hover:bg-violet-100 transition-colors"
      aria-label="Install FamilyFinanceTracker app"
    >
      <Download size={13} />
      <span>Install</span>
    </button>
  )
}
