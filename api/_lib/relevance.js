import { supabaseRequest } from './db.js'
import { normalizeText } from './text.js'

export const RELEVANCE_WEIGHTS = {
  proximity: 10,
  rating: 5,
  sales: 3,
}

const same = (a, b) =>
  Boolean(a && b) &&
  normalizeText(a) === normalizeText(b)

export function proximityFactor(viewer, seller, nearMe = false) {
  if (!viewer?.cidade || !viewer?.uf) return 1

  const sameState = same(viewer.uf, seller?.uf)
  const sameCity = sameState && same(viewer.cidade, seller?.cidade)

  if (sameCity) return 3
  if (nearMe) return 1
  if (sameState) return 2
  return 1
}

export function calculateRelevance({
  proximity,
  rating,
  completedSales,
}) {
  const normalizedSales = Math.log(Number(completedSales || 0) + 1)

  return (
    RELEVANCE_WEIGHTS.proximity * Number(proximity || 1) +
    RELEVANCE_WEIGHTS.rating * Number(rating || 0) +
    RELEVANCE_WEIGHTS.sales * normalizedSales
  )
}

export async function buildSellerRelevance(
  sellerIds,
  viewer = null,
  nearMe = false
) {
  const ids = [
    ...new Set(sellerIds.map(Number).filter(Boolean)),
  ]

  if (!ids.length) return new Map()

  const idList = ids.join(',')

  const [users, ratings, deliveries] = await Promise.all([
    supabaseRequest(
      `/usuario?select=id,cidade,uf&id=in.(${idList})`
    ),
    supabaseRequest(
      `/avaliacao_resumo?select=usuario_id,media,total&usuario_id=in.(${idList})`
    ),
    supabaseRequest(
      `/entrega?select=pedido_id,vendedor_id&vendedor_id=in.(${idList})`
    ),
  ])

  const orderIds = [
    ...new Set(
      (deliveries || [])
        .map(row => Number(row.pedido_id))
        .filter(Boolean)
    ),
  ]

  const orders = orderIds.length
    ? await supabaseRequest(
        `/pedido?select=id,status&id=in.(${orderIds.join(',')})`
      )
    : []

  const delivered = new Set(
    (orders || [])
      .filter(order => order.status === 'entregue')
      .map(order => Number(order.id))
  )

  const salesBySeller = new Map()

  for (const delivery of deliveries || []) {
    if (delivered.has(Number(delivery.pedido_id))) {
      const sellerId = Number(delivery.vendedor_id)
      salesBySeller.set(
        sellerId,
        (salesBySeller.get(sellerId) || 0) + 1
      )
    }
  }

  const userMap = new Map(
    (users || []).map(row => [Number(row.id), row])
  )

  const ratingMap = new Map(
    (ratings || []).map(row => [Number(row.usuario_id), row])
  )

  const result = new Map()

  for (const id of ids) {
    const seller = userMap.get(id) || {}
    const rating = Number(ratingMap.get(id)?.media || 0)
    const completedSales = Number(salesBySeller.get(id) || 0)
    const proximity = proximityFactor(viewer, seller, nearMe)
    const score = calculateRelevance({
      proximity,
      rating,
      completedSales,
    })

    result.set(id, {
      score,
      proximity,
      rating,
      completedSales,
      sameCity: proximity === 3,
      cidade: seller.cidade || '',
      uf: seller.uf || '',
    })
  }

  return result
}

export function sortByRelevance(
  items,
  relevanceMap,
  sellerIdOf,
  nearMe = false
) {
  return [...items].sort((a, b) => {
    const aInfo = relevanceMap.get(Number(sellerIdOf(a)))
    const bInfo = relevanceMap.get(Number(sellerIdOf(b)))

    if (nearMe) {
      const cityDiff =
        Number(Boolean(bInfo?.sameCity)) -
        Number(Boolean(aInfo?.sameCity))

      if (cityDiff !== 0) return cityDiff
    }

    const scoreDiff =
      Number(bInfo?.score || 0) -
      Number(aInfo?.score || 0)

    if (Math.abs(scoreDiff) > 0.0001) return scoreDiff

    return Number(b?.id || 0) - Number(a?.id || 0)
  })
}
