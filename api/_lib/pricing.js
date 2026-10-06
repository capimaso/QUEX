export function activePromotion(product, now = Date.now()) {
  const original = Number(product?.preco || 0)
  const promotional = Number(product?.preco_promocional)
  const expiresAt = product?.promocao_expira_em
    ? new Date(product.promocao_expira_em).getTime()
    : NaN

  return (
    Number.isFinite(promotional) &&
    promotional > 0 &&
    promotional < original &&
    Number.isFinite(expiresAt) &&
    expiresAt > now
  )
}

export function effectivePrice(product, now = Date.now()) {
  return activePromotion(product, now)
    ? Number(product.preco_promocional)
    : Number(product?.preco || 0)
}

export function promotionPayload(body, originalPrice) {
  const enabled = body.promotion_enabled === true

  if (!enabled) {
    return {
      preco_promocional: null,
      promocao_expira_em: null,
    }
  }

  const promotional = Number(body.promotional_price)
  const price = Number(originalPrice)

  if (!Number.isFinite(promotional) || promotional <= 0) {
    return { error: 'O preço promocional deve ser maior que zero.' }
  }

  if (!Number.isFinite(price) || promotional >= price) {
    return { error: 'O preço promocional deve ser menor que o preço original.' }
  }

  const rawExpiry = String(body.promotion_expires_at || '').trim()
  const expiry = new Date(rawExpiry)

  if (!rawExpiry || Number.isNaN(expiry.getTime())) {
    return { error: 'Informe uma data válida para o fim da promoção.' }
  }

  if (expiry.getTime() <= Date.now()) {
    return { error: 'A promoção precisa terminar em uma data futura.' }
  }

  return {
    preco_promocional: promotional,
    promocao_expira_em: expiry.toISOString(),
  }
}
