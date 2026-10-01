import React from 'react'
import { Link } from 'react-router-dom'
import { Fish } from 'lucide-react'
export default function NotFound(){return <div className="min-h-screen flex items-center justify-center px-4"><div className="text-center"><Fish className="w-14 h-14 mx-auto mb-4 text-[#5A5FBF]"/><h1 className="text-3xl font-heading font-bold text-[#0D1273]">Página não encontrada</h1><p className="text-gray-500 mt-2">Essa rota não existe.</p><Link to="/" className="inline-block mt-5 text-[#0D1273] font-medium hover:underline">Voltar ao início</Link></div></div>}
