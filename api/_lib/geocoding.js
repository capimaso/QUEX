const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

const clean = value => String(value ?? '').trim()

export class GeocodingError extends Error {
  constructor(message, code = 'geocoding_error') {
    super(message)
    this.name = 'GeocodingError'
    this.code = code
  }
}

async function nominatimSearch(query) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    q: query,
  })

  const contact = clean(process.env.NOMINATIM_EMAIL)
  if (contact) params.set('email', contact)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'QUEX/1.0 (marketplace de pescadores artesanais)',
      },
    })

    if (!response.ok) {
      throw new GeocodingError(
        'O serviço de localização está indisponível no momento.',
        'geocoding_unavailable'
      )
    }

    const rows = await response.json()
    const first = Array.isArray(rows) ? rows[0] : null
    const lat = Number(first?.lat)
    const lng = Number(first?.lon)

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null
    }

    return { lat, lng }
  } catch (error) {
    if (error instanceof GeocodingError) throw error

    if (error?.name === 'AbortError') {
      throw new GeocodingError(
        'A localização do endereço demorou demais.',
        'geocoding_unavailable'
      )
    }

    throw new GeocodingError(
      'Não foi possível localizar o endereço agora.',
      'geocoding_unavailable'
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function geocodeAddress({
  cep,
  numero = '',
  logradouro = '',
  bairro = '',
  cidade,
  uf,
}) {
  const safeCidade = clean(cidade)
  const safeUf = clean(uf).toUpperCase()
  const safeCep = clean(cep).replace(/\D/g, '')

  if (!safeCidade || !/^[A-Z]{2}$/.test(safeUf)) {
    throw new GeocodingError(
      'Cidade e UF são necessárias para localizar o endereço.',
      'invalid_geocoding_address'
    )
  }

  const detailedQuery = [
    clean(logradouro),
    clean(numero),
    clean(bairro),
    safeCidade,
    safeUf,
    safeCep,
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')

  let result = await nominatimSearch(detailedQuery)

  // CEPs rurais ou muito amplos às vezes não resolvem com número/logradouro.
  // Nesse caso tentamos uma consulta mais ampla antes de desistir.
  if (!result) {
    const fallbackQuery = [
      safeCep,
      safeCidade,
      safeUf,
      'Brasil',
    ]
      .filter(Boolean)
      .join(', ')

    result = await nominatimSearch(fallbackQuery)
  }

  if (!result) {
    throw new GeocodingError(
      'Não foi possível localizar coordenadas para este CEP.',
      'coordinates_not_found'
    )
  }

  return result
}

export async function tryGeocodeAddress(address) {
  try {
    const result = await geocodeAddress(address)
    return {
      ...result,
      warning: null,
    }
  } catch (error) {
    console.warn(
      '[QUÉX] Endereço validado pelo ViaCEP, mas sem coordenadas:',
      error?.message || error
    )

    return {
      lat: null,
      lng: null,
      warning:
        'Endereço salvo, mas não foi possível obter as coordenadas. Edite o endereço novamente antes de usar entrega por distância.',
    }
  }
}
