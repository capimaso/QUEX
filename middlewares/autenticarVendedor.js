import jwt from 'jsonwebtoken'

export default function autenticarVendedor(req, res, next) {
  const authorization = req.headers.authorization || ''
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || []

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({
      mensagem: 'Token de autenticação inválido ou ausente.',
    })
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)

    if (user.tipo !== 'VENDEDOR') {
      return res.status(403).json({
        mensagem: 'Apenas vendedores podem gerenciar produtos.',
      })
    }

    req.user = user
    if (req.body && ['POST', 'PUT'].includes(req.method)) {
      req.body.vendedor_id = Number(user.id)
    }

    return next()
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        mensagem: 'Token inválido ou expirado.',
      })
    }

    throw error
  }
}
