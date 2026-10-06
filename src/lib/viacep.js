export function onlyCepDigits(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8)
}

export function formatCep(value) {
  const digits = onlyCepDigits(value)
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export async function lookupCep(rawCep) {
  const cep = onlyCepDigits(rawCep)

  if (cep.length !== 8) {
    throw new Error('Informe um CEP válido com 8 dígitos.')
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${cep}/json/`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    )

    if (!response.ok) {
      throw new Error('O serviço de CEP está indisponível. Tente novamente.')
    }

    const data = await response.json()

    if (data?.erro === true || !data?.localidade || !data?.uf) {
      throw new Error('CEP não encontrado. Confira os números.')
    }

    return {
      cep,
      cidade: String(data.localidade).trim(),
      uf: String(data.uf).trim().toUpperCase(),
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('A consulta do CEP demorou demais. Tente novamente.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
