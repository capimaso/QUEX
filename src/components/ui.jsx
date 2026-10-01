import React from 'react'

export function Button({ className = '', variant = 'primary', size = 'md', children, ...props }) {
  const sizes = { sm: 'px-3 py-2 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-sm' }
  const variants = {
    primary: 'gradient-btn',
    outline: 'bg-white border border-gray-200 text-[#0D1273] hover:bg-[#5A5FBF]/5',
    ghost: 'bg-transparent text-[#0D1273] hover:bg-[#5A5FBF]/10',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  }
  return <button className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`} {...props}>{children}</button>
}

export const Input = React.forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`input-base ${className}`} {...props} />
})

export function Textarea({ className = '', ...props }) {
  return <textarea className={`input-base resize-none ${className}`} {...props} />
}

export function Label({ className = '', children, ...props }) {
  return <label className={`block text-sm font-medium text-[#0D1273] ${className}`} {...props}>{children}</label>
}

export function Badge({ className = '', children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{children}</span>
}

export function Select({ className = '', children, ...props }) {
  return <select className={`input-base ${className}`} {...props}>{children}</select>
}

export function Field({ label, children, hint }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint && <p className="text-xs text-gray-400">{hint}</p>}</div>
}
