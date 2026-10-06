import React from 'react'
import { Contrast, Moon, RotateCcw, Type } from 'lucide-react'
import { Button } from '@/components/ui'
import { usePreferences } from '@/lib/PreferencesContext'

function Toggle({ checked, onChange, label, description, icon: Icon }) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#5A5FBF]/10 p-2 text-[#0D1273]"><Icon className="h-5 w-5" /></div>
        <div>
          <h2 className="font-semibold text-[#0D1273]">{label}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-[#0D1273]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

export default function Settings() {
  const {
    darkMode, fontSize, highContrast,
    setDarkMode, setFontSize, setHighContrast, resetPreferences,
  } = usePreferences()

  const fontButton = (value, label) => (
    <button
      type="button"
      onClick={() => setFontSize(value)}
      aria-pressed={fontSize === value}
      className={`rounded-xl border px-4 py-3 font-medium transition ${
        fontSize === value
          ? 'border-[#0D1273] bg-[#0D1273] text-white'
          : 'border-gray-200 bg-white text-[#0D1273] hover:bg-[#5A5FBF]/5'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">Configurações</h1>
        <p className="mt-1 text-gray-500">Personalize a aparência do QUÉX neste navegador.</p>
      </div>

      <div className="space-y-4">
        <Toggle
          checked={darkMode}
          onChange={setDarkMode}
          label="Modo Escuro"
          description="Troca as superfícies claras por uma interface escura."
          icon={Moon}
        />

        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-xl bg-[#5A5FBF]/10 p-2 text-[#0D1273]"><Type className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-[#0D1273]">Tamanho da Fonte</h2>
              <p className="mt-1 text-sm text-gray-500">A alteração é aplicada ao site inteiro.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {fontButton('small', 'A-')}
            {fontButton('normal', 'Normal')}
            {fontButton('large', 'A+')}
          </div>
        </div>

        <Toggle
          checked={highContrast}
          onChange={setHighContrast}
          label="Alto Contraste"
          description="Aumenta a diferença entre textos, fundos e bordas."
          icon={Contrast}
        />
      </div>

      <div className="mt-6">
        <Button variant="outline" onClick={resetPreferences}>
          <RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão
        </Button>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-gray-400">
        Essas preferências ficam salvas somente neste navegador usando localStorage.
        Nenhuma configuração visual é enviada ao banco de dados.
      </p>
    </div>
  )
}
