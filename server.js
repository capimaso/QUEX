import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pool from './database/pool.js'
import bcrypt from 'bcrypt'
import produtoRouter from './routers/produtoRouter.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

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

app.post('/registro', async (req, res) => {
  const { nome, email, senha, telefone, endereco, data_nasc, tipo } =
    req.body ?? {}

  if (
    !nome ||
    !email ||
    !senha ||
    !telefone ||
    !endereco ||
    !data_nasc ||
    !['COMPRADOR', 'VENDEDOR'].includes(tipo)
  ) {
    return res.status(400).json({
      mensagem: 'Informe todos os campos e um tipo válido.',
    })
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10)

    const resultado = await pool.query(
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
      [nome, email, senhaHash, telefone, endereco, data_nasc, tipo]
    )

    return res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso.',
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