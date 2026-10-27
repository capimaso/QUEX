import "dotenv/config";
import express from "express";
import pool from "./db.js";

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(express.json());

function registrarLog(requisicao, resposta, proximo) {
  console.log(
    `[${new Date().toLocaleTimeString()}] ${requisicao.method} ${requisicao.url}`
  );

  proximo();
}

app.use(registrarLog);

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
`;

function obterIdValido(requisicao, resposta) {
  const id = Number(requisicao.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    resposta.status(400).json({
      mensagem: "O id deve ser um número inteiro positivo."
    });

    return null;
  }

  return id;
}

app.get("/api/produtos", async (requisicao, resposta) => {
  try {
    const resultado = await pool.query(
      `${consultaProdutos} ORDER BY p.id`
    );

    return resposta.status(200).json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao listar produtos:", erro.message);

    return resposta.status(500).json({
      mensagem: "Erro interno ao buscar os produtos."
    });
  }
});

app.get("/api/produtos/:id", async (requisicao, resposta) => {
  const id = obterIdValido(requisicao, resposta);

  if (id === null) {
    return;
  }

  try {
    const resultado = await pool.query(
      `${consultaProdutos} WHERE p.id = $1`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({
        mensagem: "Produto não encontrado."
      });
    }

    return resposta.status(200).json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar produto:", erro.message);

    return resposta.status(500).json({
      mensagem: "Erro interno ao buscar o produto."
    });
  }
});

app.use((requisicao, resposta) => {
  return resposta.status(404).json({
    mensagem: "Rota não encontrada."
  });
});

app.listen(PORTA, () => {
  console.log(`Servidor QUÉX rodando em http://localhost:${PORTA}`);
});