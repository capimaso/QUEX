import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, ShieldCheck, X } from 'lucide-react'
import { submitReview } from '@/api/data'
import StarInput from '@/components/StarInput'
import { Button, Textarea } from '@/components/ui'

export const MAX_COMMENT = 500

// Janela "Avaliar vendedor/comprador". A avaliação é anônima: a outra pessoa só vê a média geral.
export default function ReviewDialog({ open, onClose, orderId, counterpart, onDone }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const box = useRef(null)

  useEffect(() => {
    if (!open) return
    setRating(0); setComment(''); setError(''); setSending(false)
    box.current?.querySelector('[role=radio][tabindex="0"]')?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape' && !sending) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, sending, onClose])

  if (!open) return null
  const name = counterpart?.name || (counterpart?.role === 'seller' ? 'o vendedor' : 'o comprador')

  const submit = async e => {
    e.preventDefault()
    if (!rating) return setError('Escolha de 1 a 5 estrelas.')
    setError(''); setSending(true)
    try {
      await submitReview({ orderId, rating, comment: comment.trim() })
      toast.success('Avaliação enviada. Obrigado!')
      onDone?.(rating)
      onClose()
    } catch (err) {
      if (err.status === 409) {
        // já avaliou (outra aba/aparelho): a nota que valeu é a antiga, então não mostramos a que acabou de ser tentada
        toast(err.message || 'Você já avaliou este pedido.')
        onDone?.(null)
        onClose()
      } else {
        setError(err.message || 'Não foi possível enviar a avaliação.')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget && !sending) onClose() }}>
      <form ref={box} role="dialog" aria-modal="true" aria-labelledby="review-title" onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="review-title" className="text-lg font-heading font-bold text-[#0D1273]">Avaliar {name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pedido #{orderId}</p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} aria-label="Fechar" className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200"><X className="w-5 h-5" /></button>
        </div>

        <div className="mt-5"><StarInput value={rating} onChange={setRating} disabled={sending} /></div>

        <label className="block mt-4 text-sm font-medium text-gray-700" htmlFor="review-comment">Comentário <span className="font-normal text-gray-400">(opcional)</span></label>
        <Textarea id="review-comment" className="mt-1.5 min-h-24" maxLength={MAX_COMMENT} value={comment} onChange={e => setComment(e.target.value)} disabled={sending} placeholder="Conta como foi a experiência..." />
        <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Fica guardado só para a equipe do QUÉX (moderação), não aparece no perfil.</span><span>{comment.length}/{MAX_COMMENT}</span></div>

        <p className="mt-4 flex gap-2 rounded-xl bg-[#5A5FBF]/5 p-3 text-xs text-[#0D1273]"><ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />Sua avaliação é anônima: {name} só vê a nota média, sem saber quem avaliou.</p>

        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button type="submit" disabled={sending}>{sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : 'Enviar avaliação'}</Button>
        </div>
      </form>
    </div>
  )
}
