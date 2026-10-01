import React from 'react'
import { Link } from 'react-router-dom'
import { Fish } from 'lucide-react'

export default function NotFound() { return <div className="min-h-screen flex items-center justify-center px-4"><div className="text-center"><Fish className="w-14 h-14 mx-auto text-[#0D1273] mb-4" /><h1 className="text-4xl font-heading font-bold text-[#0D1273]">404</h1><p className="text-gray-500 mt-2">Página não encontrada.</p><Link to="/" className="inline-block mt-6 text-[#0D1273] font-medium hover:underline">Voltar para o início</Link></div></div> }
