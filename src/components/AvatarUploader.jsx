import React, { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { Button } from '@/components/ui'
import { AVATAR_ACCEPT } from '@/lib/image'

export default function AvatarUploader({ user, onUpload, onRemove }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const hasPhoto = Boolean(user?.foto_url)

  const pick = async e => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    setBusy(true)
    try { await onUpload(file); toast.success('Foto atualizada!') }
    catch (err) { toast.error(err.message || 'Não foi possível enviar a foto.') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await onRemove(); toast.success('Foto removida.') }
    catch (err) { toast.error(err.message || 'Não foi possível remover a foto.') }
    finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar src={user?.foto_url} name={user?.full_name} size={88} />
      <div className="space-y-2">
        <input ref={input} type="file" accept={AVATAR_ACCEPT} className="hidden" onChange={pick} data-testid="avatar-input" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}{hasPhoto ? 'Trocar foto' : 'Adicionar foto'}
          </Button>
          {hasPhoto && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}><Trash2 className="w-4 h-4 mr-2" />Remover</Button>}
        </div>
        <p className="text-xs text-gray-400">JPG, PNG ou WebP. A foto é cortada em quadrado.</p>
      </div>
    </div>
  )
}
