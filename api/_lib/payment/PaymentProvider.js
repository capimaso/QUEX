export default class PaymentProvider {
  async createPayment(_pedido, _valor) {
    throw new Error('createPayment precisa ser implementado pelo provedor.')
  }

  async processPayment(_gatewayId) {
    throw new Error('processPayment precisa ser implementado pelo provedor.')
  }
}
