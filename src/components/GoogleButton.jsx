import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.4a12 12 0 0 0 0 11l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  )
}

export default function GoogleButton({ label = 'Continuar com Google', onError }) {
  const { loginWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const click = async () => {
    setLoading(true)
    try { await loginWithGoogle() } catch (e) { setLoading(false); onError?.(e.message) }
  }
  return (
    <button type="button" onClick={click} disabled={loading} className="w-full h-12 inline-flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-60">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleLogo />}
      {label}
    </button>
  )
}

export function OrDivider() {
  return <div className="flex items-center gap-3 my-5 text-xs text-gray-400"><span className="flex-1 h-px bg-gray-200" />ou<span className="flex-1 h-px bg-gray-200" /></div>
}
