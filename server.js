import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pool from './database/pool.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import produtoRouter from './routers/produtoRouter.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json())

function registrarLog(req, res, next) {
  console.log(
    `[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`
  )
  next()
}

app.use(registrarLog)
app.use('/api/produtos', produtoRouter)

function responderErroDoBanco(erro, res) {
  console.error('Erro no banco:', erro.message)

  if (erro.code === '23503') {
    return res.status(400).json({
      mensagem:
        'Não foi possível concluir a operação: confira os registros relacionados.',
    })
  }

  return res.status(500).json({
    mensagem: 'Erro interno ao acessar o banco de dados.',
  })
}

async function registrarUsuario(req, res) {
  const {
    nome,
    email,
    senha,
    telefone,
    endereco,
    data_nasc,
    tipo,
    cpf,
    cpf_cnpj,
    nome_loja,
    entrega_disponivel = false,
  } = req.body ?? {}

  if (
    !nome ||
    !email ||
    !senha ||
    !telefone ||
    !endereco ||
    !data_nasc ||
    (req.path === '/api/auth/register' &&
      (tipo === 'VENDEDOR' ? !cpf_cnpj : !cpf)) ||
    !['COMPRADOR', 'VENDEDOR'].includes(tipo)
  ) {
    return res.status(400).json({
      mensagem: 'Informe todos os campos e um tipo válido.',
    })
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10)
    const emailNormalizado = email.trim().toLowerCase()

    const client = await pool.connect()
    let resultado

    try {
      await client.query('BEGIN')
      resultado = await client.query(
        `
          INSERT INTO usuario (
            nome,
            email,
            senha_hash,
            telefone,
            endereco,
            data_nasc,
            tipo
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, nome, email, telefone, endereco, data_nasc, tipo
        `,
        [nome, emailNormalizado, senhaHash, telefone, endereco, data_nasc, tipo]
      )

      const userId = resultado.rows[0].id
      if (tipo === 'VENDEDOR' && cpf_cnpj) {
        await client.query(
          `
            INSERT INTO vendedor (
              id, cpf_cnpj, nome_loja, entrega_disponivel
            )
            VALUES ($1, $2, $3, $4)
          `,
          [
            userId,
            cpf_cnpj,
            nome_loja || nome,
            Boolean(entrega_disponivel),
          ]
        )
      } else if (tipo === 'COMPRADOR' && cpf) {
        await client.query(
          'INSERT INTO comprador (id, cpf) VALUES ($1, $2)',
          [userId, cpf]
        )
      }

      await client.query('COMMIT')
    } catch (erro) {
      await client.query('ROLLBACK')
      throw erro
    } finally {
      client.release()
    }

    return res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso.',
      user: resultado.rows[0],
      usuario: resultado.rows[0],
    })
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(400).json({
        mensagem: 'Já existe um usuário cadastrado com esse e-mail.',
      })
    }

    return responderErroDoBanco(erro, res)
  }
}

app.post('/registro', registrarUsuario)
app.post('/api/auth/register', registrarUsuario)

async function autenticarUsuario(req, res) {
  const { email } = req.body ?? {}
  const senha = req.body?.password ?? req.body?.senha
  if (
    typeof email !== 'string' ||
    typeof senha !== 'string' ||
    !email.trim() ||
    !senha
  ) {
    return res.status(400).json({
      mensagem: 'Informe o e-mail e a senha.',
    })
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      mensagem: 'JWT_SECRET não está configurado.',
    })
  }

  try {
    const emailNormalizado = email.trim().toLowerCase()

    const resultado = await pool.query(
      `
        SELECT id, nome, email, senha_hash, tipo
        FROM usuario
        WHERE LOWER(email) = $1
      `,
      [emailNormalizado]
    )

    const usuario = resultado.rows[0]

    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
      return res.status(401).json({
        mensagem: 'E-mail ou senha inválidos.',
      })
    }

    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )

    return res.status(200).json({
      mensagem: 'Login realizado com sucesso.',
      token,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        name: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
      },
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
      },
    })
  } catch (erro) {
    return responderErroDoBanco(erro, res)
  }
}

app.post('/login', autenticarUsuario)
app.post('/api/auth/login', autenticarUsuario)

app.get('/api/auth/me', async (req, res) => {
  const authorization = req.headers.authorization || ''
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || []

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({
      mensagem: 'Token de autenticação inválido ou ausente.',
    })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const resultado = await pool.query(
      `
        SELECT id, nome, email, telefone, endereco, data_nasc, tipo
        FROM usuario
        WHERE id = $1
      `,
      [payload.id]
    )
    const usuario = resultado.rows[0]

    if (!usuario) {
      return res.status(401).json({
        mensagem: 'Usuário não encontrado.',
      })
    }

    return res.status(200).json({
      user: {
        ...usuario,
        name: usuario.nome,
      },
    })
  } catch (erro) {
    if (erro.name === 'JsonWebTokenError' || erro.name === 'TokenExpiredError') {
      return res.status(401).json({
        mensagem: 'Token inválido ou expirado.',
      })
    }

    return responderErroDoBanco(erro, res)
  }
})

app.use((erro, req, res, next) => {
  if (erro instanceof SyntaxError && 'body' in erro) {
    return res.status(400).json({
      mensagem: 'O JSON enviado é inválido.',
    })
  }

  console.error('Erro inesperado:', erro.message)
  return res.status(500).json({
    mensagem: 'Erro interno do servidor.',
  })
})

app.use((req, res) => {
  return res.status(404).json({
    mensagem: 'Rota não encontrada.',
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor QUÉX rodando na porta ${PORT}`)
})