import "dotenv/config";
import express from "express";
import pool from "./db.js";
import validarProduto from "./middlewares/validarProduto.js";
import bcrypt from "bcrypt";

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

app.post("/registro", async (requisicao, resposta) => {
  const { nome, email, senha, telefone, endereco, data_nasc, tipo } =
    requisicao.body ?? {};

  if (
    !nome ||
    !email ||
    !senha ||
    !telefone ||
    !endereco ||
    !data_nasc ||
    !["COMPRADOR", "VENDEDOR"].includes(tipo)
  ) {
    return resposta.status(400).json({
      mensagem: "Informe todos os campos e um tipo válido."
    });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

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
    );

    return resposta.status(201).json({
      mensagem: "Usuário cadastrado com sucesso.",
      usuario: resultado.rows[0]
    });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({
        mensagem: "Já existe um usuário cadastrado com esse e-mail."
      });
    }

    return responderErroDoBanco(erro, resposta);
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