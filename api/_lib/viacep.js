const onlyDigits = value => String(value ?? '').replace(/\D/g, '')

export class ViaCepError extends Error {
  constructor(message, code = 'viacep_error') {
    super(message)
    this.name = 'ViaCepError'
    this.code = code
  }
}

export async function lookupCep(rawCep) {
  const cep = onlyDigits(rawCep)

  if (!/^\d{8}$/.test(cep)) {
    throw new ViaCepError('Informe um CEP válido com 8 dígitos.', 'invalid_cep')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${cep}/json/`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'QUEX/1.0',
        },
      }
    )

    if (!response.ok) {
      throw new ViaCepError(
        'O serviço de CEP está indisponível no momento. Tente novamente.',
        'viacep_unavailable'
      )
    }

    const data = await response.json()

    if (
      data?.erro === true ||
      !String(data?.localidade || '').trim() ||
      !/^[A-Za-z]{2}$/.test(String(data?.uf || '').trim())
    ) {
      throw new ViaCepError('CEP não encontrado. Confira os números.', 'invalid_cep')
    }

    return {
      cep,
      cidade: String(data.localidade).trim(),
      uf: String(data.uf).trim().toUpperCase(),
      logradouro: String(data.logradouro || '').trim(),
      bairro: String(data.bairro || '').trim(),
    }
  } catch (error) {
    if (error instanceof ViaCepError) throw error

    if (error?.name === 'AbortError') {
      throw new ViaCepError(
        'A consulta do CEP demorou demais. Tente novamente.',
        'viacep_unavailable'
      )
    }

    throw new ViaCepError(
      'Não foi possível consultar o CEP agora. Tente novamente em instantes.',
      'viacep_unavailable'
    )
  } finally {
    clearTimeout(timeout)
  }
}

export function buildStoredAddress({ numero, complemento, cepData }) {
  const parts = []

  if (cepData.logradouro) parts.push(cepData.logradouro)
  if (String(numero || '').trim()) parts.push(`nº ${String(numero).trim()}`)
  if (String(complemento || '').trim()) parts.push(String(complemento).trim())
  if (cepData.bairro) parts.push(cepData.bairro)

  parts.push(`${cepData.cidade} - ${cepData.uf}`)
  parts.push(`CEP ${cepData.cep.slice(0, 5)}-${cepData.cep.slice(5)}`)

  return parts.join(', ')
}
