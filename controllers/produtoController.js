import * as ProdutoModel from '../models/produtoModel.js'

function obterIdValido(req, res) {
  const id = Number(req.params.id)

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      mensagem: 'O id deve ser um número inteiro positivo.',
    })

    return null
  }

  return id
}

function responderErroDoBanco(erro, res) {
  console.error('Erro no banco:', erro.message)

  if (erro.code === '23503') {
    return res.status(400).json({
      mensagem:
        'Não foi possível concluir a operação: confira o vendedor e os registros relacionados ao produto.',
    })
  }

  return res.status(500).json({
    mensagem: 'Erro interno ao acessar o banco de dados.',
  })
}

export async function listarProdutos(req, res) {
  try {
    const produtos = await ProdutoModel.listarProdutos()
    return res.status(200).json(produtos)
  } catch (erro) {
    return responderErroDoBanco(erro, res)
  }
}

export async function buscarProduto(req, res) {
  const id = obterIdValido(req, res)
  if (id === null) return

  try {
    const produto = await ProdutoModel.buscarProdutoPorId(id)

    if (!produto) {
      return res.status(404).json({
        mensagem: 'Produto não encontrado.',
      })
    }

    return res.status(200).json(produto)
  } catch (erro) {
    return responderErroDoBanco(erro, res)
  }
}

export async function criarProduto(req, res) {
  try {
    const produto = await ProdutoModel.criarProduto(
      req.produtoValidado
    )

    return res.status(201).json({
      mensagem: 'Produto cadastrado com sucesso.',
      produto,
    })
  } catch (erro) {
    return responderErroDoBanco(erro, res)
  }
}

export async function atualizarProduto(req, res) {
  const id = obterIdValido(req, res)
  if (id === null) return

  try {
    const produto = await ProdutoModel.atualizarProduto(
      id,
      req.produtoValidado
    )

    if (!produto) {
      return res.status(404).json({
        mensagem: 'Produto não encontrado.',
      })
    }

    return res.status(200).json({
      mensagem: 'Produto atualizado com sucesso.',
      produto,
    })
  } catch (erro) {
    return responderErroDoBanco(erro, res)
  }
}

export async function excluirProduto(req, res) {
  const id = obterIdValido(req, res)
  if (id === null) return

  try {
    const produto = await ProdutoModel.excluirProduto(id)

    if (!produto) {
      return res.status(404).json({
        mensagem: 'Produto não encontrado.',
      })
    }

    return res.status(200).json({
      mensagem: 'Produto removido com sucesso.',
      produto,
    })
  } catch (erro) {
    return responderErroDoBanco(erro, res)
  }
}