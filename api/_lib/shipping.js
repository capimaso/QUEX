const ORS_DIRECTIONS_URL =
  'https://api.heigit.org/openrouteservice/v2/directions/driving-car'

const round2 = value =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100

function validCoordinate(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max
}

export function validateCoordinates(point, label = 'Endereço') {
  if (
    !validCoordinate(point?.lat, -90, 90) ||
    !validCoordinate(point?.lng, -180, 180)
  ) {
    const error = new Error(
      `${label} não possui coordenadas válidas. Atualize o endereço antes de calcular a entrega.`
    )
    error.status = 400
    error.code = 'missing_coordinates'
    throw error
  }

  return {
    lat: Number(point.lat),
    lng: Number(point.lng),
  }
}

export async function routeDistanceKm(origin, destination) {
  const from = validateCoordinates(origin, 'Endereço do vendedor')
  const to = validateCoordinates(destination, 'Endereço do comprador')
  const apiKey = String(process.env.ORS_API_KEY || '').trim()

  if (!apiKey) {
    const error = new Error(
      'A OpenRouteService não está configurada no servidor. Defina ORS_API_KEY na Vercel.'
    )
    error.status = 503
    error.code = 'ors_not_configured'
    throw error
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(ORS_DIRECTIONS_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
        preference: 'fastest',
        instructions: false,
      }),
    })

    const text = await response.text()
    let data = null

    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      console.error('[QUÉX] OpenRouteService:', response.status, data || text)

      const error = new Error(
        response.status === 429
          ? 'O serviço de rotas atingiu o limite temporário. Tente novamente em instantes.'
          : 'Não foi possível calcular a rota de entrega agora.'
      )
      error.status = response.status === 429 ? 503 : 502
      error.code = 'ors_error'
      throw error
    }

    const meters = Number(data?.routes?.[0]?.summary?.distance)

    if (!Number.isFinite(meters) || meters < 0) {
      const error = new Error(
        'A OpenRouteService não retornou uma distância válida para esta rota.'
      )
      error.status = 502
      error.code = 'ors_invalid_distance'
      throw error
    }

    return round2(meters / 1000)
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(
        'O cálculo da rota demorou demais. Tente novamente.'
      )
      timeoutError.status = 504
      timeoutError.code = 'ors_timeout'
      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function calculateShipping({
  sellerPoint,
  buyerPoint,
  valuePerKm,
}) {
  const rate = Number(valuePerKm)

  if (!Number.isFinite(rate) || rate <= 0) {
    const error = new Error(
      'O vendedor não possui um valor por quilômetro válido.'
    )
    error.status = 400
    error.code = 'invalid_seller_rate'
    throw error
  }

  const distanceKm = await routeDistanceKm(sellerPoint, buyerPoint)

  return {
    distancia_km: distanceKm,
    valor_frete: round2(distanceKm * rate),
  }
}
