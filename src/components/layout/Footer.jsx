import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="quex-footer border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-sm text-gray-500 sm:flex-row sm:px-6 lg:px-8">
        <p>© Cerne. Todos os direitos reservados.</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/privacy" className="hover:text-[#0D1273] hover:underline">Política de Privacidade</Link>
          <Link to="/terms" className="hover:text-[#0D1273] hover:underline">Termos de Uso</Link>
        </div>
      </div>
    </footer>
  )
}
