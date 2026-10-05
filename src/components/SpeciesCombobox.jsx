import React, { useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown, Fish } from 'lucide-react'
import { Input } from '@/components/ui'

// "tilapia" acha "Tilápia"; hífen e espaço valem igual
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-_\s]+/g, ' ').trim()

// Combobox pesquisável. O valor é SEMPRE o id de uma espécie da lista (nada de texto livre).
// options: [{ id, name }]   value: id ou ''   onChange(id | '')
export default function SpeciesCombobox({ options, value, onChange, loading = false, error = '', fallbackText = '', placeholder = 'Digite para pesquisar...' }) {
  const listId = useId()
  const selected = options.find(o => String(o.id) === String(value)) || null
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false) // a pessoa digitou desde a última escolha
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => { if (!dirty) setText(selected?.name || fallbackText || '') }, [selected?.id, selected?.name, fallbackText, dirty])
  useEffect(() => { setActive(0) }, [text, open])
  useEffect(() => { document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView?.({ block: 'nearest' }) }, [active, listId])

  const filtered = useMemo(() => {
    const q = dirty ? fold(text) : ''
    return q ? options.filter(o => fold(o.name).includes(q)) : options
  }, [options, text, dirty])

  const pick = option => { onChange(option.id); setText(option.name); setDirty(false); setOpen(false) }
  const type = e => {
    setText(e.target.value)
    setDirty(true)
    setOpen(true)
    if (value !== '' && value != null) onChange('') // digitou de novo: a escolha anterior deixa de valer
  }
  const blur = () => {
    setOpen(false)
    if (!dirty) return
    const exact = options.find(o => fold(o.name) === fold(text))
    if (exact) pick(exact)
  }
  const keydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setActive(i => Math.min(i + 1, Math.max(filtered.length - 1, 0))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (filtered[active]) pick(filtered[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const invalid = Boolean(text.trim()) && !selected && !open
  return (
    <div className="relative">
      <Fish className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        aria-activedescendant={open && filtered[active] ? `${listId}-opt-${active}` : undefined}
        className={`pl-10 pr-10 ${invalid ? '!border-red-400' : ''}`}
        autoComplete="off"
        value={text}
        placeholder={loading ? 'Carregando espécies...' : placeholder}
        disabled={loading}
        onChange={type}
        onFocus={() => setOpen(true)}
        onBlur={blur}
        onKeyDown={keydown}
      />
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1">
          {filtered.length === 0
            ? <li role="presentation" className="px-4 py-3 text-sm text-gray-500">Nenhuma espécie encontrada.</li>
            : filtered.map((o, i) => (
              <li
                key={o.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={String(o.id) === String(value)}
                onMouseDown={e => { e.preventDefault(); pick(o) }}
                onMouseEnter={() => setActive(i)}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors duration-150 ${i === active ? 'bg-[#5A5FBF]/10 text-[#0D1273]' : 'text-gray-700'} ${String(o.id) === String(value) ? 'font-semibold' : ''}`}
              >{o.name}</li>
            ))}
        </ul>
      )}
      {error
        ? <p className="mt-1.5 text-xs text-red-500">{error}</p>
        : invalid
          ? <p className="mt-1.5 text-xs text-red-500">Escolha uma espécie da lista.</p>
          : <p className="mt-1.5 text-xs text-gray-400">Só espécies da lista podem ser vendidas.</p>}
    </div>
  )
}
