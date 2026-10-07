import React, { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Input } from '@/components/ui'

export default function PasswordInput({
  className = '',
  withLockIcon = false,
  ...props
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      {withLockIcon && (
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      )}

      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${withLockIcon ? 'pl-10 ' : ''}pr-11 ${className}`}
      />

      <button
        type="button"
        onClick={() => setVisible(value => !value)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#0D1273]"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}
