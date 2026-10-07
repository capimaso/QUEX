import React, { useEffect, useState } from 'react'
import {
  MessageCircle,
  MessagesSquare,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { listChats } from '@/api/module12'
import { Button } from '@/components/ui'
import SellerDashboardModule11 from '@/pages/seller/SellerDashboardModule11'
import { useAuth } from '@/lib/AuthContext'

function SellerChats() {
  const { user } = useAuth()
  const [chats, setChats] = useState([])

  useEffect(() => {
    if (user?.role !== 'seller') return

    let active = true

    listChats()
      .then(rows => {
        if (active) setChats(rows)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [user?.id, user?.role])

  if (!chats.length) return null

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-[#5A5FBF]/10 p-2 text-[#0D1273]">
            <MessagesSquare className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-heading text-lg font-bold text-[#0D1273]">
              Conversas dos pedidos
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Chats privados liberados após a confirmação da compra.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {chats.slice(0, 8).map(chat => (
            <div
              key={chat.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[#0D1273]">
                  Pedido #{chat.pedido_id} · {chat.counterpart_name}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  {chat.pedido_status || 'Pedido confirmado'}
                </p>
              </div>

              <Link to={`/chat/${chat.id}`}>
                <Button size="sm">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Conversar
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function SellerDashboardModule12() {
  return (
    <>
      <SellerChats />
      <SellerDashboardModule11 />
    </>
  )
}
