import React, { useEffect, useMemo, useState } from 'react'
import { Flag, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { submitModule12Report } from '@/api/module12'
import { Button, Label, Textarea } from '@/components/ui'

const CATEGORIES = [
  {
    value: 'anuncio_enganoso',
    label: 'Anúncio Enganoso/Fake',
  },
  {
    value: 'perfil_improprio',
    label: 'Perfil Impróprio',
  },
  {
    value: 'preco_abusivo_fraude',
    label: 'Preço Abusivo/Fraude',
  },
  {
    value: 'conteudo_ofensivo',
    label: 'Conteúdo Ofensivo',
  },
  {
    value: 'outros',
    label: 'Outros',
  },
]

export default function ReportModal({
  open,
  onClose,
  reporterId,
  reportedUserId,
  productId = null,
  messageId = null,
  questionId = null,
  answerId = null,
  contextType = 'produto',
  contextLabel = '',
  contextDescription = '',
  initialCategory = '',
}) {
  const [category, setCategory] = useState(initialCategory)
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)

  const detailLimit = contextDescription ? 400 : 1000

  useEffect(() => {
    if (!open) return
    setCategory(initialCategory || '')
    setDescription('')
    setSending(false)
  }, [open, initialCategory])

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = event => {
      if (event.key === 'Escape' && !sending) onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, sending, onClose])

  const automaticContext = useMemo(
    () => String(contextDescription || '').trim(),
    [contextDescription]
  )

  if (!open) return null

  const send = async event => {
    event.preventDefault()

    if (!category) {
      toast.error('Escolha uma categoria para a denúncia.')
      return
    }

    const combinedDescription = [
      automaticContext,
      description.trim(),
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 1000)

    setSending(true)

    try {
      await submitModule12Report({
        reporterId,
        reportedUserId,
        productId,
        messageId,
        questionId,
        answerId,
        category,
        description: combinedDescription,
        contextType,
      })

      toast.success('Denúncia enviada. Obrigada por nos avisar.')
      onClose()
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível enviar a denúncia.'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6"
      onMouseDown={event => {
        if (
          event.target === event.currentTarget &&
          !sending
        ) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[#0D1273]">
              <Flag className="h-5 w-5" />
              <h2
                id="report-modal-title"
                className="text-xl font-heading font-bold"
              >
                Por que você quer denunciar?
              </h2>
            </div>

            {contextLabel && (
              <p className="text-sm text-gray-500">
                {contextLabel}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={send}
          className="space-y-5 px-6 py-5"
        >
          {automaticContext && (
            <div className="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
              O contexto da mensagem será incluído automaticamente na denúncia.
            </div>
          )}

          <fieldset>
            <legend className="mb-3 text-sm font-medium text-[#0D1273]">
              Categoria
            </legend>

            <div className="space-y-2">
              {CATEGORIES.map(option => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                    category === option.value
                      ? 'border-[#5A5FBF] bg-[#5A5FBF]/5 text-[#0D1273]'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-category"
                    value={option.value}
                    checked={category === option.value}
                    onChange={() =>
                      setCategory(option.value)
                    }
                    className="h-4 w-4 accent-[#0D1273]"
                  />

                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="report-details">
                Detalhes adicionais (opcional)
              </Label>

              <span className="text-xs text-gray-400">
                {description.length}/{detailLimit}
              </span>
            </div>

            <Textarea
              id="report-details"
              rows={4}
              maxLength={detailLimit}
              value={description}
              onChange={event =>
                setDescription(event.target.value)
              }
              placeholder="Conte o que aconteceu. Evite colocar senhas ou dados sensíveis."
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={sending}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={sending || !category}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Flag className="mr-2 h-4 w-4" />
                  Enviar denúncia
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
