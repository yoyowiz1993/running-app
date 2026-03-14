import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error: unknown }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string | null }) {
    console.error('App error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : err ? String(err) : undefined
      return (
        <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center p-5 text-white">
          <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="text-lg font-semibold">Something went wrong</div>
            <div className="mt-2 text-sm text-white/70">
              The app encountered an error. Try refreshing the page.
            </div>
            {(msg != null && msg !== '') && (
              <div className="mt-3 rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2 text-left text-xs font-mono text-red-300 break-all">
                {msg}
              </div>
            )}
            {!msg && this.state.error == null && (
              <div className="mt-3 text-xs text-white/50">
                Check the browser console (F12) for details.
              </div>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30 transition"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
