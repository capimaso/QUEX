import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

class Boundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[QUÉX] Erro de renderização capturado:', error, info)
  }

  componentDidUpdate(prevProps) {
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-heading font-bold text-[#0D1273]">
            Ops, essa tela não carregou direito
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            O QUÉX encontrou um erro inesperado nesta página. Você pode tentar
            carregar novamente ou voltar ao início sem ficar preso em uma tela branca.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="gradient-btn inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm transition-all duration-200 ease-in-out"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </button>

            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#0D1273] transition-all duration-200 ease-in-out hover:bg-[#5A5FBF]/5"
            >
              <Home className="mr-2 h-4 w-4" />
              Voltar ao início
            </Link>
          </div>

          {import.meta.env.DEV && (
            <details className="mt-6 rounded-xl bg-gray-50 p-3 text-left">
              <summary className="cursor-pointer text-xs font-medium text-gray-500">
                Detalhes para desenvolvimento
              </summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs text-red-600">
                {String(this.state.error?.stack || this.state.error)}
              </pre>
            </details>
          )}
        </section>
      </main>
    )
  }
}

export default function ErrorBoundary({ children }) {
  const location = useLocation()

  return (
    <Boundary resetKey={`${location.pathname}${location.search}`}>
      {children}
    </Boundary>
  )
}
