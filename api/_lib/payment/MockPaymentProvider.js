import PaymentProvider from './PaymentProvider.js'

export default class MockPaymentProvider extends PaymentProvider {
  async createPayment(pedido, valor) {
    const stamp = Date.now()
    const random = Math.random().toString(36).slice(2, 10)
    const gatewayId = `mock_${stamp}_${random}`

    return {
      gateway_id: gatewayId,
      status: 'pendente',
      link_pagamento: pedido?.id ? `/orders/${pedido.id}?payment=mock` : '/orders',
      valor: Number(valor || 0),
    }
  }

  async processPayment(gatewayId) {
    const value = String(gatewayId || '')

    if (!value.startsWith('mock_')) {
      const error = new Error('Pagamento mock inválido.')
      error.status = 400
      throw error
    }

    return {
      status: 'aprovado',
    }
  }
}
