import React, { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button, Input } from '@/components/ui'

export default function TripleConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Excluir perfil',
  subject = 'esta conta',
  loading = false,
}) {
  const [checks, setChecks] = useState([false, false, false])
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) {
      setChecks([false, false, false])
      setTyped('')
    }
  }, [open])

  if (!open) return null

  const ready =
    checks.every(Boolean) &&
    typed.trim().toUpperCase() === 'EXCLUIR'

  const toggle = index => {
    setChecks(current =>
      current.map((value, i) =>
        i === index ? !value : value
      )
    )
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 py-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !loading) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-100 p-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-red-700">
                {title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Esta ação é irreversível.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {[
            `Tenho CERTEZA de que quero excluir ${subject}.`,
            'Entendo que essa ação é IRREVERSÍVEL.',
            'Entendo que meus dados pessoais e conteúdo serão apagados ou anonimizados.',
          ].map((label, index) => (
            <label
              key={label}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-100 bg-red-50/40 p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={checks[index]}
                onChange={() => toggle(index)}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-gray-700">
            Digite <strong>EXCLUIR</strong> para confirmar:
          </p>
          <Input
            value={typed}
            onChange={event => setTyped(event.target.value)}
            placeholder="EXCLUIR"
            autoComplete="off"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!ready || loading}
            onClick={onConfirm}
          >
            {loading ? 'Excluindo...' : 'Excluir definitivamente'}
          </Button>
        </div>
      </div>
    </div>
  )
}
