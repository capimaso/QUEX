export function methodNotAllowed(res, methods) {
  res.setHeader('Allow', methods.join(', '))
  return json(res, 405, { error: 'Método não permitido.' })
}

export function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').json(data)
}

export function ok(res, data) {
  return json(res, 200, data)
}

export function created(res, data) {
  return json(res, 201, data)
}

export function badRequest(res, message) {
  return json(res, 400, { error: message })
}

export function unauthorized(res, message = 'Não autenticado.') {
  return json(res, 401, { error: message })
}

export function forbidden(res, message = 'Você não tem permissão para esta ação.') {
  return json(res, 403, { error: message })
}

export function notFound(res, message = 'Registro não encontrado.') {
  return json(res, 404, { error: message })
}

export function serverError(res, error) {
  console.error(error)
  return json(res, error?.status && Number.isInteger(error.status) ? error.status : 500, {
    error: error?.message || 'Erro interno do servidor.',
  })
}

export function readBody(req) {
  return req.body && typeof req.body === 'object' ? req.body : {}
}
