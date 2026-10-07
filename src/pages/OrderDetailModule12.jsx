import React, { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  getOrder,
} from '@/api/commerce'
import { listChats } from '@/api/module12'
import { Button } from '@/components/ui'
import OrderDetail from '@/pages/OrderDetail'
import { useAuth } from '@/lib/AuthContext'

const CONFIRMED = new Set([
  'em_preparo',
  'enviado',
  'despachado',
  'entregue',
])

function BuyerChatActions() {
  const { id } = useParams()
  const { user } = useAuth()

  const [order, setOrder] = useState(null)
  const [chats, setChats] = useState([])

  useEffect(() => {
    if (user?.role !== 'buyer') return

    let active = true

    Promise.all([
      getOrder(id),
      listChats({ orderId: id }),
    ])
      .then(([orderData, chatRows]) => {
        if (!active) return

        setOrder(orderData)
        setChats(chatRows)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [id, user?.id, user?.role])

  if (
    !order ||
    !CONFIRMED.has(order.status) ||
    !chats.length
  ) {
    return null
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#5A5FBF]/20 bg-white p-4">
        <div className="mr-auto">
          <p className="font-semibold text-[#0D1273]">
            Conversar sobre o pedido
          </p>
          <p className="mt-1 text-xs text-gray-400">
            O chat fica disponível somente para as partes desta compra.
          </p>
        </div>

        {chats.map(chat => (
          <Link
            key={chat.id}
            to={`/chat/${chat.id}`}
          >
            <Button size="sm">
              <MessageCircle className="mr-2 h-4 w-4" />
              Conversar com {chat.counterpart_name}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function OrderDetailModule12() {
  return (
    <>
      <BuyerChatActions />
      <OrderDetail />
    </>
  )
}
