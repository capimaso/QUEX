import React, { useState } from 'react'
import { Star } from 'lucide-react'
import ReviewDialog from '@/components/ReviewDialog'
import { Button } from '@/components/ui'

// No cartão do pedido: botão "Avaliar ..." quando dá pra avaliar, ou "Você avaliou: N/5" depois.
// order: { id, can_review, my_review: {rating}|null, counterpart: {name, role}|null }
export default function OrderReviewAction({ order, onReviewed }) {
  const [open, setOpen] = useState(false)
  if (order.my_review) {
    return <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />Você avaliou{order.my_review.rating ? `: ${order.my_review.rating}/5` : ''}</span>
  }
  if (!order.can_review || !order.counterpart) return null
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Star className="w-4 h-4 mr-2" />{order.counterpart.role === 'seller' ? 'Avaliar vendedor' : 'Avaliar comprador'}</Button>
      <ReviewDialog open={open} onClose={() => setOpen(false)} orderId={order.id} counterpart={order.counterpart} onDone={rating => onReviewed?.(order.id, rating)} />
    </>
  )
}
