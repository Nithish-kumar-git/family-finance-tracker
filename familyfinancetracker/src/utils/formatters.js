// Currency and date formatting utilities for FamilyFinanceTracker.
// Always use these functions — never format rupee amounts inline in components.

export const formatCurrency = (amount, compact = false) => {
  if (compact && Math.abs(amount) >= 10000000)
    return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (compact && Math.abs(amount) >= 100000)
    return `₹${(amount / 100000).toFixed(1)}L`
  if (compact && Math.abs(amount) >= 1000)
    return `₹${(amount / 1000).toFixed(0)}K`
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const formatMonth = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

export const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export const formatDeficit = (amount) => {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '−' : '+'
  return `${prefix}${formatCurrency(abs)}`
}

export const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
