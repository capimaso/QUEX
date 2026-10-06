import React from 'react'
import {
  normalizeSearchDisplay,
} from '@/lib/text'

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) {
  const sizes = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  }

  const variants = {
    primary: 'gradient-btn',
    outline:
      'bg-white border border-gray-200 text-[#0D1273] hover:bg-[#5A5FBF]/5',
    ghost:
      'bg-transparent text-[#0D1273] hover:bg-[#5A5FBF]/10',
    danger:
      'bg-red-50 text-red-600 hover:bg-red-100',
  }

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export const Input = React.forwardRef(function Input(
  {
    className = '',
    onChange,
    type = 'text',
    placeholder = '',
    ...props
  },
  ref
) {
  const searchLike =
    type === 'search' ||
    /(buscar|pesquisar|cidade|região)/i.test(
      String(placeholder)
    )

  const handleChange = event => {
    if (searchLike) {
      const normalized =
        normalizeSearchDisplay(
          event.target.value
        )

      if (
        normalized !==
        event.target.value
      ) {
        event.target.value =
          normalized
      }
    }

    onChange?.(event)
  }

  return (
    <input
      ref={ref}
      type={type}
      placeholder={placeholder}
      className={`input-base transition-colors duration-200 ease-in-out ${className}`}
      onChange={
        onChange
          ? handleChange
          : undefined
      }
      {...props}
    />
  )
})

export const InputWithIcon =
  React.forwardRef(
    function InputWithIcon(
      {
        icon: Icon,
        className = '',
        wrapperClassName = '',
        iconClassName = '',
        rightElement = null,
        ...props
      },
      ref
    ) {
      return (
        <div
          className={`quex-input-with-icon relative ${wrapperClassName}`}
        >
          {Icon && (
            <Icon
              aria-hidden="true"
              className={`pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400 ${iconClassName}`}
            />
          )}

          <Input
            ref={ref}
            className={`${rightElement ? 'pr-11' : ''} ${className}`}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
      )
    }
  )

export function Textarea({
  className = '',
  ...props
}) {
  return (
    <textarea
      className={`input-base resize-none transition-colors duration-200 ease-in-out ${className}`}
      {...props}
    />
  )
}

export function Label({
  className = '',
  children,
  ...props
}) {
  return (
    <label
      className={`block text-sm font-medium text-[#0D1273] ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}

export function Badge({
  className = '',
  children,
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  )
}

export function Select({
  className = '',
  children,
  ...props
}) {
  return (
    <select
      className={`input-base transition-colors duration-200 ease-in-out ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Field({
  label,
  children,
  hint,
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && (
        <p className="text-xs text-gray-400">
          {hint}
        </p>
      )}
    </div>
  )
}
