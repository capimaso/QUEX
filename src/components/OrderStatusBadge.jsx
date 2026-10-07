import React from 'react'
import { Badge } from '@/components/ui'

const CONFIG = {
  aguardando_pagamento: {
    label: 'Aguardando Pagamento',
    classes: 'bg-amber-100 text-amber-800',
  },
  pendente: {
    label: 'Aguardando Pagamento',
    classes: 'bg-amber-100 text-amber-800',
  },
  pago: {
    label: 'Pago',
    classes: 'bg-cyan-100 text-cyan-800',
  },
  em_preparo: {
    label: 'Em Preparo',
    classes: 'bg-blue-100 text-blue-800',
  },
  enviado: {
    label: 'Enviado',
    classes: 'bg-purple-100 text-purple-800',
  },
  despachado: {
    label: 'Enviado',
    classes: 'bg-purple-100 text-purple-800',
  },
  entregue: {
    label: 'Entregue',
    classes: 'bg-green-100 text-green-800',
  },
  cancelado: {
    label: 'Cancelado',
    classes: 'bg-red-100 text-red-800',
  },
}

export function orderStatusLabel(status) {
  return (
    CONFIG[String(status || '').toLowerCase()]?.label ||
    String(status || '—')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
  )
}

export default function OrderStatusBadge({ status, className = '' }) {
  const item =
    CONFIG[String(status || '').toLowerCase()] || {
      label: orderStatusLabel(status),
      classes: 'bg-gray-100 text-gray-700',
    }

  return (
    <Badge className={`${item.classes} ${className}`}>
      {item.label}
    </Badge>
  )
}
