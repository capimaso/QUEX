import pool from '../database/pool.js'

const consultaProdutos = `
  SELECT
    p.id,
    p.vendedor_id,
    p.nome,
    p.descricao,
    p.especie,
    p.preco,
    p.estoque,
    p.ativo,
    p.criado_em,
    u.nome AS vendedor,
    v.nome_loja
  FROM produto AS p
  JOIN vendedor AS v ON v.id = p.vendedor_id
  JOIN usuario AS u ON u.id = v.id
`

export async function listarProdutos() {
  const resultado = await pool.query(
    `${consultaProdutos} ORDER BY p.id`
  )

  return resultado.rows
}

export async function buscarProdutoPorId(id) {
  const resultado = await pool.query(
    `${consultaProdutos} WHERE p.id = $1`,
    [id]
  )

  return resultado.rows[0] || null
}

export async function criarProduto(produto) {
  const resultado = await pool.query(
    `
      INSERT INTO produto (
        vendedor_id,
        nome,
        descricao,
        especie,
        preco,
        estoque,
        ativo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      produto.vendedor_id,
      produto.nome,
      produto.descricao,
      produto.especie,
      produto.preco,
      produto.estoque,
      produto.ativo,
    ]
  )

  return resultado.rows[0]
}

export async function atualizarProduto(id, produto) {
  const resultado = await pool.query(
    `
      UPDATE produto
      SET
        vendedor_id = $1,
        nome = $2,
        descricao = $3,
        especie = $4,
        preco = $5,
        estoque = $6,
        ativo = $7
      WHERE id = $8
      RETURNING *
    `,
    [
      produto.vendedor_id,
      produto.nome,
      produto.descricao,
      produto.especie,
      produto.preco,
      produto.estoque,
      produto.ativo,
      id,
    ]
  )

  return resultado.rows[0] || null
}

export async function excluirProduto(id) {
  const resultado = await pool.query(
    'DELETE FROM produto WHERE id = $1 RETURNING *',
    [id]
  )

  return resultado.rows[0] || null
}