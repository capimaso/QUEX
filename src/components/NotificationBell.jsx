import React, { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/module13'

function relativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  )

  if (seconds < 60) return 'agora'
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`
  if (seconds < 604800) return `há ${Math.floor(seconds / 86400)} d`

  return date.toLocaleDateString('pt-BR')
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async silent => {
    if (!silent) setLoading(true)

    try {
      const data = await listNotifications()
      setRows(data.notifications || [])
      setUnread(Number(data.unread_count || 0))
    } catch (error) {
      if (!silent) {
        toast.error(
          error.message ||
            'Não foi possível carregar as notificações.'
        )
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load(true)

    const timer = window.setInterval(() => {
      load(true)
    }, 60000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const close = event => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const clickNotification = async item => {
    try {
      if (!item.read) {
        await markNotificationRead(item.id)
      }
    } catch {}

    setOpen(false)
    setRows(current =>
      current.map(row =>
        row.id === item.id ? { ...row, read: true } : row
      )
    )
    setUnread(current => Math.max(0, current - (item.read ? 0 : 1)))
    navigate(item.link || '/')
  }

  const readAll = async () => {
    try {
      await markAllNotificationsRead()
      setRows(current =>
        current.map(row => ({ ...row, read: true }))
      )
      setUnread(0)
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) load(false)
        }}
        className="relative rounded-lg p-2 transition hover:bg-[#5A5FBF]/10"
        aria-label="Abrir notificações"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 text-[#0D1273]" />

        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[80] mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="font-semibold text-[#0D1273]">
                Notificações
              </p>
              <p className="text-xs text-gray-400">
                {unread} não lida{unread === 1 ? '' : 's'}
              </p>
            </div>

            <button
              type="button"
              onClick={readAll}
              disabled={!unread}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0D1273] disabled:opacity-40"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como lidas
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Carregando...
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Nenhuma notificação por enquanto.
              </div>
            ) : (
              rows.map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => clickNotification(item)}
                  className={`block w-full border-b border-gray-50 px-4 py-3 text-left transition hover:bg-[#5A5FBF]/5 ${
                    item.read ? 'bg-white' : 'bg-red-50/30'
                  }`}
                >
                  <div className="flex gap-3">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        item.read ? 'bg-gray-200' : 'bg-red-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0D1273]">
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        {relativeTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
