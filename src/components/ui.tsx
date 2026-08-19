import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12" role="status">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-accent" />
      {label && <p className="text-sm text-ink-muted">{label}</p>}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-sunset text-white shadow-soft hover:-translate-y-0.5 active:translate-y-0',
  secondary:
    'bg-surface text-ink ring-1 ring-line hover:bg-surface-sunk',
  ghost: 'text-ink-muted hover:bg-surface-sunk hover:text-ink active:scale-[0.98]',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  full?: boolean
}

export function Button({
  variant = 'primary',
  full,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl px-6 py-3 text-base font-medium transition disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    />
  )
}

export function Screen({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main
      className={`mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 safe-top safe-bottom ${className}`}
    >
      {children}
    </main>
  )
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="text-6xl" aria-hidden="true">{emoji}</div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-xs text-ink-muted">{body}</p>
      {action && <div className="mt-2 flex flex-col gap-3">{action}</div>}
    </div>
  )
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-2 inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-sunk hover:text-ink active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </Link>
  )
}
