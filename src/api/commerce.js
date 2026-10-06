import { apiRequest } from './client'

export async function getFreightAverage() {
  return apiRequest('/api/seller/freight-average')
}

export async function updateSellerFreight({
  entrega_disponivel,
  valor_por_km,
}) {
  return apiRequest('/api/seller/profile', {
    method: 'PUT',
    body: JSON.stringify({
      entrega_disponivel: Boolean(entrega_disponivel),
      valor_por_km:
        entrega_disponivel
          ? Number(valor_por_km)
          : null,
    }),
  })
}

export async function calculateShipping(vendedorIds) {
  return apiRequest('/api/shipping/calculate', {
    method: 'POST',
    body: JSON.stringify({
      vendedor_ids: vendedorIds.map(Number),
    }),
  })
}

export async function getCheckoutQuote() {
  return apiRequest('/api/checkout')
}

export async function createCheckout({
  items,
  deliveryMethods,
  paymentMethod,
}) {
  return apiRequest('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({
      items: items.map(item => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
      })),
      delivery_methods: deliveryMethods.map(item => ({
        vendedor_id: Number(item.vendedor_id),
        tipo_frete: item.tipo_frete,
      })),
      payment_method: paymentMethod,
    }),
  })
}

export async function confirmMockPayment({
  orderId,
  gatewayId,
}) {
  return apiRequest('/api/payment/mock-confirm', {
    method: 'POST',
    body: JSON.stringify({
      pedido_id: Number(orderId),
      gateway_id: gatewayId,
    }),
  })
}

export async function getOrder(id) {
  const data = await apiRequest(
    `/api/orders?id=${encodeURIComponent(id)}`
  )

  return data.order
}

export async function getPlatformConfig() {
  return apiRequest('/api/admin/configuracao')
}

export async function updatePlatformConfig(taxaPercentual) {
  return apiRequest('/api/admin/configuracao', {
    method: 'PUT',
    body: JSON.stringify({
      taxa_percentual: Number(taxaPercentual),
    }),
  })
}


export async function updateSellerOrderStatus(
  orderId,
  status,
  trackingCode = ''
) {
  return (
    await apiRequest(
      `/api/orders?id=${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          tracking_code: trackingCode,
        }),
      }
    )
  ).order
}
