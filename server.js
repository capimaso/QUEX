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

function validarProduto(requisicao, resposta, proximo) {
  const {
    vendedor_id,
    nome,
    descricao,
    especie,
    preco,
    estoque,
    ativo
  } = requisicao.body;

  const vendedorId = Number(vendedor_id);
  const precoNumerico = Number(preco);
  const estoqueNumerico = Number(estoque);

  if (!Number.isInteger(vendedorId) || vendedorId <= 0) {
    return resposta.status(400).json({
      mensagem: "O vendedor_id deve ser um número inteiro positivo."
    });
  }

  if (typeof nome !== "string" || nome.trim() === "") {
    return resposta.status(400).json({
      mensagem: "O nome do produto é obrigatório."
    });
  }

  if (typeof especie !== "string" || especie.trim() === "") {
    return resposta.status(400).json({
      mensagem: "A espécie do produto é obrigatória."
    });
  }

  if (!Number.isFinite(precoNumerico) || precoNumerico <= 0) {
    return resposta.status(400).json({
      mensagem: "O preço deve ser um número maior que zero."
    });
  }

  if (!Number.isInteger(estoqueNumerico) || estoqueNumerico < 0) {
    return resposta.status(400).json({
      mensagem: "O estoque deve ser um número inteiro maior ou igual a zero."
    });
  }

  if (
    descricao !== undefined &&
    descricao !== null &&
    typeof descricao !== "string"
  ) {
    return resposta.status(400).json({
      mensagem: "A descrição deve ser um texto."
    });
  }

  if (ativo !== undefined && typeof ativo !== "boolean") {
    return resposta.status(400).json({
      mensagem: "O campo ativo deve ser verdadeiro ou falso."
    });
  }

  requisicao.produtoValidado = {
    vendedor_id: vendedorId,
    nome: nome.trim(),
    descricao:
      typeof descricao === "string" && descricao.trim() !== ""
        ? descricao.trim()
        : null,
    especie: especie.trim(),
    preco: precoNumerico,
    estoque: estoqueNumerico,
    ativo: ativo === undefined ? true : ativo
  };

  return proximo();
}

function responderErroDoBanco(erro, resposta) {
  console.error("Erro no banco:", erro.message);

  if (erro.code === "23503") {
    return resposta.status(400).json({
      mensagem:
        "Não foi possível concluir a operação: o vendedor informado não existe ou o produto possui registros relacionados."
    });
  }

  return resposta.status(500).json({
    mensagem: "Erro interno ao acessar o banco de dados."
  });
}

app.get("/api/produtos", async (requisicao, resposta) => {
  try {
    const resultado = await pool.query(
      `${consultaProdutos} ORDER BY p.id`
    );

    return resposta.status(200).json(resultado.rows);
  } catch (erro) {
    return responderErroDoBanco(erro, resposta);
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
    return responderErroDoBanco(erro, resposta);
  }
});

app.post(
  "/api/produtos",
  validarProduto,
  async (requisicao, resposta) => {
    const produto = requisicao.produtoValidado;

    try {
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
          produto.ativo
        ]
      );

      return resposta.status(201).json({
        mensagem: "Produto cadastrado com sucesso.",
        produto: resultado.rows[0]
      });
    } catch (erro) {
      return responderErroDoBanco(erro, resposta);
    }
  }
);

app.put(
  "/api/produtos/:id",
  validarProduto,
  async (requisicao, resposta) => {
    const id = obterIdValido(requisicao, resposta);

    if (id === null) {
      return;
    }

    const produto = requisicao.produtoValidado;

    try {
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
          id
        ]
      );

      if (resultado.rows.length === 0) {
        return resposta.status(404).json({
          mensagem: "Produto não encontrado."
        });
      }

      return resposta.status(200).json({
        mensagem: "Produto atualizado com sucesso.",
        produto: resultado.rows[0]
      });
    } catch (erro) {
      return responderErroDoBanco(erro, resposta);
    }
  }
);

app.delete("/api/produtos/:id", async (requisicao, resposta) => {
  const id = obterIdValido(requisicao, resposta);

  if (id === null) {
    return;
  }

  try {
    const resultado = await pool.query(
      "DELETE FROM produto WHERE id = $1 RETURNING *",
      [id]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({
        mensagem: "Produto não encontrado."
      });
    }

    return resposta.status(200).json({
      mensagem: "Produto removido com sucesso.",
      produto: resultado.rows[0]
    });
  } catch (erro) {
    return responderErroDoBanco(erro, resposta);
  }
});

app.use((erro, requisicao, resposta, proximo) => {
  if (erro instanceof SyntaxError && "body" in erro) {
    return resposta.status(400).json({
      mensagem: "O JSON enviado é inválido."
    });
  }

  return proximo(erro);
});

app.use((requisicao, resposta) => {
  return resposta.status(404).json({
    mensagem: "Rota não encontrada."
  });
});

app.listen(PORTA, () => {
  console.log(`Servidor QUÉX rodando em http://localhost:${PORTA}`);
});