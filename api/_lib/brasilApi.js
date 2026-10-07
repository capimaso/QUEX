import { onlyDigits, validarCPF, validarCNPJ } from './documents.js'

const CPF_URL = cpf => `https://brasilapi.com.br/api/cpf/v1/${cpf}`
const CNPJ_URL = cnpj => `https://brasilapi.com.br/cnpj/v1/${cnpj}`

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
    if (error?.name === 'AbortError') {
      throw new DocumentVerificationError(
        'Não foi possível validar seu documento agora. Tentaremos novamente em breve.',
        'verification_unavailable',
        503
      )
    }

    throw new DocumentVerificationError(
      'Não foi possível validar seu documento agora. Tentaremos novamente em breve.',
      'verification_unavailable',
      503
    )
  } finally {
    clearTimeout(timeout)
  }
}

function pendingResult(kind, submittedName) {
  return {
    kind,
    verified: false,
    pending: true,
    officialName: String(submittedName || '').trim(),
    legalName: null,
    tradeName: null,
    warning:
      'Não foi possível validar seu documento agora. Tentaremos novamente em breve.',
  }
}

export async function verifyDocument({
  document,
  submittedName = '',
  businessName = '',
}) {
  const digits = onlyDigits(document)

  if (digits.length === 11) {
    if (!validarCPF(digits)) {
      throw new DocumentVerificationError(
        'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.',
        'document_not_found',
        400
      )
    }

    /*
      A documentação pública atual da BrasilAPI não publica um endpoint de CPF.
      Ainda assim, tentamos exatamente a rota solicitada pelo requisito.
      Se a rota não estiver disponível (404/405/501) tratamos como indisponibilidade
      do provedor e usamos o fallback "verificação pendente", sem inventar nome oficial.
    */
    let response

    try {
      response = await fetchJson(CPF_URL(digits))
    } catch (error) {
      if (error instanceof DocumentVerificationError) {
        return pendingResult('cpf', submittedName)
      }
      throw error
    }

    if ([404, 405, 501].includes(response.status)) {
      return pendingResult('cpf', submittedName)
    }

    if (!response.ok) {
      if ([400, 422].includes(response.status)) {
        throw new DocumentVerificationError(
          'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.',
          'document_not_found',
          400
        )
      }

      return pendingResult('cpf', submittedName)
    }

    const officialName = String(
      response.data?.nome ||
      response.data?.nome_completo ||
      response.data?.name ||
      ''
    ).trim()

    if (!officialName) {
      return pendingResult('cpf', submittedName)
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
        'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.',
        'document_not_found',
        400
      )
    }

    let response

    try {
      response = await fetchJson(CNPJ_URL(digits))
    } catch (error) {
      if (error instanceof DocumentVerificationError) {
        return pendingResult('cnpj', businessName || submittedName)
      }
      throw error
    }

    if (response.status === 404 || response.status === 400) {
      throw new DocumentVerificationError(
        'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.',
        'document_not_found',
        400
      )
    }

    if (!response.ok) {
      return pendingResult('cnpj', businessName || submittedName)
    }

    const legalName = String(
      response.data?.razao_social ||
      response.data?.nome ||
      ''
    ).trim()

    const tradeName = String(
      response.data?.nome_fantasia ||
      businessName ||
      submittedName ||
      legalName
    ).trim()

    if (!legalName) {
      return pendingResult('cnpj', tradeName)
    }

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
    'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.',
    'document_not_found',
    400
  )
}
