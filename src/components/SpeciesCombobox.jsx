import React, {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import {
  ChevronDown,
  Fish,
} from 'lucide-react'
import { Input } from '@/components/ui'
import {
  normalizeText,
} from '@/lib/text'

const fold = value =>
  normalizeText(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export default function SpeciesCombobox({
  options,
  value,
  onChange,
  loading = false,
  error = '',
  fallbackText = '',
  placeholder = 'Digite para pesquisar...',
}) {
  const listId = useId()

  const selected =
    options.find(
      option =>
        String(option.id) ===
        String(value)
    ) || null

  const [text, setText] =
    useState('')
  const [dirty, setDirty] =
    useState(false)
  const [open, setOpen] =
    useState(false)
  const [active, setActive] =
    useState(0)

  useEffect(() => {
    if (!dirty) {
      setText(
        selected?.name ||
          fallbackText ||
          ''
      )
    }
  }, [
    selected?.id,
    selected?.name,
    fallbackText,
    dirty,
  ])

  useEffect(() => {
    setActive(0)
  }, [text, open])

  useEffect(() => {
    document
      .getElementById(
        `${listId}-opt-${active}`
      )
      ?.scrollIntoView?.({
        block: 'nearest',
      })
  }, [active, listId])

  const filtered = useMemo(() => {
    const query =
      dirty ? fold(text) : ''

    return query
      ? options.filter(option =>
          fold(option.name).includes(
            query
          )
        )
      : options
  }, [options, text, dirty])

  const pick = option => {
    onChange(option.id)
    setText(option.name)
    setDirty(false)
    setOpen(false)
  }

  const type = event => {
    setText(event.target.value)
    setDirty(true)
    setOpen(true)

    if (
      value !== '' &&
      value != null
    ) {
      onChange('')
    }
  }

  const blur = () => {
    setOpen(false)

    if (!dirty) return

    const exact =
      options.find(
        option =>
          fold(option.name) ===
          fold(text)
      )

    if (exact) pick(exact)
  }

  const keydown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()

      if (!open) {
        setOpen(true)
      } else {
        setActive(index =>
          Math.min(
            index + 1,
            Math.max(
              filtered.length - 1,
              0
            )
          )
        )
      }
    } else if (
      event.key === 'ArrowUp'
    ) {
      event.preventDefault()
      setActive(index =>
        Math.max(index - 1, 0)
      )
    } else if (
      event.key === 'Enter' &&
      open
    ) {
      event.preventDefault()

      if (filtered[active]) {
        pick(filtered[active])
      }
    } else if (
      event.key === 'Escape'
    ) {
      setOpen(false)
    }
  }

  const invalid =
    Boolean(text.trim()) &&
    !selected &&
    !open

  return (
    <div className="relative">
      <Fish className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        aria-activedescendant={
          open && filtered[active]
            ? `${listId}-opt-${active}`
            : undefined
        }
        className={`pl-10 pr-10 ${
          invalid
            ? '!border-red-400'
            : ''
        }`}
        autoComplete="off"
        value={text}
        placeholder={
          loading
            ? 'Carregando espécies...'
            : placeholder
        }
        disabled={loading}
        onChange={type}
        onFocus={() => setOpen(true)}
        onBlur={blur}
        onKeyDown={keydown}
      />

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="quex-popover absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li
              role="presentation"
              className="px-4 py-3 text-sm text-gray-500"
            >
              Nenhuma espécie encontrada.
            </li>
          ) : (
            filtered.map(
              (option, index) => (
                <li
                  key={option.id}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={
                    String(option.id) ===
                    String(value)
                  }
                  onMouseDown={event => {
                    event.preventDefault()
                    pick(option)
                  }}
                  onMouseEnter={() =>
                    setActive(index)
                  }
                  className={`cursor-pointer px-4 py-2 text-sm transition-colors duration-200 ease-in-out ${
                    index === active
                      ? 'bg-[#5A5FBF]/10 text-[#0D1273]'
                      : 'text-gray-700'
                  } ${
                    String(option.id) ===
                    String(value)
                      ? 'font-semibold'
                      : ''
                  }`}
                >
                  {option.name}
                </li>
              )
            )
          )}
        </ul>
      )}

      {error ? (
        <p className="mt-1.5 text-xs text-red-500">
          {error}
        </p>
      ) : invalid ? (
        <p className="mt-1.5 text-xs text-red-500">
          Escolha uma espécie da lista.
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-gray-400">
          Só espécies da lista podem ser vendidas.
        </p>
      )}
    </div>
  )
}
