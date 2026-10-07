import { onlyDigits, validarCPF, validarCNPJ } from './documents.js'

const CPF_URL = cpf => `https://brasilapi.com.br/api/cpf/v1/${cpf}`
const CNPJ_URL = cnpj => `https://brasilapi.com.br/cnpj/v1/${cnpj}`

const INVALID_MESSAGE =
  'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.'

const UNAVAILABLE_MESSAGE =
  'Não foi possível validar seu documento agora. Tentaremos novamente em breve.'

export class DocumentVerificationError extends Error {
  constructor(message, code = 'document_verification_error', status = 400) {
    super(message)
    this.name = 'DocumentVerificationError'
    this.code = code
    this.status = status
  }
}

async function fetchJson(url, timeoutMs = 6500) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'QUEX/1.0',
      },
    })

    const text = await response.text()
    let data = null

    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    }
  } catch (error) {
    throw new DocumentVerificationError(
      UNAVAILABLE_MESSAGE,
      'verification_unavailable',
      503
    )
  } finally {
    clearTimeout(timeout)
  }
}

function pendingResult(kind) {
  return {
    kind,
    verified: false,
    pending: true,
    officialName: '',
    legalName: null,
    tradeName: null,
    warning: UNAVAILABLE_MESSAGE,
  }
}

export async function verifyDocument({ document }) {
  const digits = onlyDigits(document)

  if (digits.length === 11) {
    if (!validarCPF(digits)) {
      throw new DocumentVerificationError(
        INVALID_MESSAGE,
        'document_not_found',
        400
      )
    }

    let response

    try {
      response = await fetchJson(CPF_URL(digits))
    } catch (error) {
      if (
        error instanceof DocumentVerificationError &&
        error.code === 'verification_unavailable'
      ) {
        return pendingResult('cpf')
      }
      throw error
    }

    /*
      A rota de CPF solicitada pelo projeto não consta na documentação pública
      atual da BrasilAPI. Quando a própria rota não existe, tratamos como
      indisponibilidade do provedor (fallback), e NÃO como "CPF inexistente".
    */
    if ([404, 405, 501].includes(response.status)) {
      return pendingResult('cpf')
    }

    if (!response.ok) {
      if ([400, 422].includes(response.status)) {
        throw new DocumentVerificationError(
          INVALID_MESSAGE,
          'document_not_found',
          400
        )
      }

      return pendingResult('cpf')
    }

    const officialName = String(
      response.data?.nome ||
      response.data?.nome_completo ||
      response.data?.name ||
      ''
    ).trim()

    if (!officialName) {
      return pendingResult('cpf')
    }

    return {
      kind: 'cpf',
      verified: true,
      pending: false,
      officialName,
      legalName: null,
      tradeName: null,
      warning: null,
    }
  }

  if (digits.length === 14) {
    if (!validarCNPJ(digits)) {
      throw new DocumentVerificationError(
        INVALID_MESSAGE,
        'document_not_found',
        400
      )
    }

    let response

    try {
      response = await fetchJson(CNPJ_URL(digits))
    } catch (error) {
      if (
        error instanceof DocumentVerificationError &&
        error.code === 'verification_unavailable'
      ) {
        return pendingResult('cnpj')
      }
      throw error
    }

    if ([400, 404, 422].includes(response.status)) {
      throw new DocumentVerificationError(
        INVALID_MESSAGE,
        'document_not_found',
        400
      )
    }

    if (!response.ok) {
      return pendingResult('cnpj')
    }

    const legalName = String(
      response.data?.razao_social ||
      response.data?.nome ||
      ''
    ).trim()

    if (!legalName) {
      return pendingResult('cnpj')
    }

    const tradeName = String(
      response.data?.nome_fantasia ||
      legalName
    ).trim()

    return {
      kind: 'cnpj',
      verified: true,
      pending: false,
      officialName: tradeName || legalName,
      legalName,
      tradeName: tradeName || legalName,
      warning: null,
    }
  }

  throw new DocumentVerificationError(
    INVALID_MESSAGE,
    'document_not_found',
    400
  )
}
