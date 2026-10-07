import { apiRequest } from './client'

export async function listProductQuestions(productId) {
  return apiRequest(
    `/api/products/${encodeURIComponent(productId)}/questions`
  )
}

export async function createProductQuestion(productId, question) {
  return apiRequest(
    `/api/products/${encodeURIComponent(productId)}/questions`,
    {
      method: 'POST',
      body: JSON.stringify({
        pergunta: question,
      }),
    }
  )
}

export async function answerProductQuestion(questionId, answer) {
  return apiRequest(
    `/api/questions/${encodeURIComponent(questionId)}/answer`,
    {
      method: 'POST',
      body: JSON.stringify({
        resposta: answer,
      }),
    }
  )
}

export async function listChats({
  orderId = null,
  sellerId = null,
} = {}) {
  const params = new URLSearchParams()

  if (orderId) {
    params.set('pedido_id', String(orderId))
  }

  if (sellerId) {
    params.set('vendedor_id', String(sellerId))
  }

  const suffix = params.toString()
    ? `?${params.toString()}`
    : ''

  const data = await apiRequest(`/api/chats${suffix}`)

  return data.chats || []
}

export async function getChatMessages(chatId) {
  return apiRequest(
    `/api/chats/${encodeURIComponent(chatId)}/messages`
  )
}

export async function sendPrivateChatMessage(chatId, message) {
  return apiRequest(
    `/api/chats/${encodeURIComponent(chatId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        mensagem: message,
      }),
    }
  )
}

export async function submitModule12Report({
  reporterId,
  reportedUserId,
  productId = null,
  messageId = null,
  questionId = null,
  answerId = null,
  category,
  description = '',
  contextType = 'produto',
}) {
  return apiRequest('/api/report', {
    method: 'POST',
    body: JSON.stringify({
      denunciante_id: Number(reporterId),
      usuario_denunciado_id: Number(reportedUserId),
      produto_id:
        productId == null ? null : Number(productId),
      mensagem_id:
        messageId == null ? null : Number(messageId),
      pergunta_id:
        questionId == null ? null : Number(questionId),
      resposta_id:
        answerId == null ? null : Number(answerId),
      categoria: category,
      descricao: description,
      contexto: contextType,
    }),
  })
}

export async function listAdminMessageReports() {
  const data = await apiRequest('/api/admin/message-reports')
  return data.reports || []
}

export async function removeReportedChatMessage(messageId) {
  return apiRequest(
    `/api/admin/messages/${encodeURIComponent(messageId)}/remove`,
    {
      method: 'POST',
    }
  )
}
