import React from 'react'
export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f2f2] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0D1273] mb-4 shadow-lg shadow-[#0D1273]/15">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-[#0D1273]">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-2">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">{children}</div>
        {footer && <p className="text-center text-sm text-gray-500 mt-6">{footer}</p>}
      </div>
    </div>
  )
}
