import "dotenv/config";
import express from "express";

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(express.json());

// Middleware global: registra cada requisição no terminal.
function registrarLog(requisicao, resposta, proximo) {
  console.log(
    `[${new Date().toLocaleTimeString()}] ${requisicao.method} ${requisicao.url}`
  );

  proximo();
}

app.use(registrarLog);

// Middleware reutilizável: valida os dados necessários para cadastrar/editar um produto.
function validarProduto(requisicao, resposta, proximo) {
  const { nome, preco, vendedor, especie } = requisicao.body;

  if (typeof nome !== "string" || nome.trim() === "") {
    return resposta.status(400).json({
      mensagem: "O nome do produto é obrigatório."
    });
  }

  const precoValido =
    (typeof preco === "number" || typeof preco === "string") &&
    String(preco).trim() !== "" &&
    Number.isFinite(Number(preco)) &&
    Number(preco) > 0;

  if (!precoValido) {
    return resposta.status(400).json({
      mensagem: "O preço deve ser um número maior que zero."
    });
  }

  if (typeof vendedor !== "string" || vendedor.trim() === "") {
    return resposta.status(400).json({
      mensagem: "O vendedor é obrigatório."
    });
  }

  if (typeof especie !== "string" || especie.trim() === "") {
    return resposta.status(400).json({
      mensagem: "A espécie é obrigatória."
    });
  }

  return proximo();
}

// "Banco de dados" temporário em memória.
const produtos = [
  {
    id: 1,
    nome: "Tilápia fresca",
    preco: 28.9,
    vendedor: "Pesqueiro Mar Azul",
    especie: "Tilápia"
  },
  {
    id: 2,
    nome: "Robalo inteiro",
    preco: 54.5,
    vendedor: "Pescador João da Costa",
    especie: "Robalo"
  }
];

app.get("/api/produtos", (requisicao, resposta) => {
  return resposta.status(200).json(produtos);
});

app.get("/api/produtos/:id", (requisicao, resposta) => {
  const id = Number(requisicao.params.id);
  const produto = produtos.find((item) => item.id === id);

  if (!produto) {
    return resposta.status(404).json({
      mensagem: "Produto não encontrado."
    });
  }

  return resposta.status(200).json(produto);
});

app.post(
  "/api/produtos",
  validarProduto,
  (requisicao, resposta) => {
    const { nome, preco, vendedor, especie } = requisicao.body;

    const novoProduto = {
      id: produtos.length + 1,
      nome: nome.trim(),
      preco: Number(preco),
      vendedor: vendedor.trim(),
      especie: especie.trim()
    };

    produtos.push(novoProduto);

    return resposta.status(201).json({
      mensagem: "Produto cadastrado com sucesso.",
      produto: novoProduto
    });
  }
);

app.put(
  "/api/produtos/:id",
  validarProduto,
  (requisicao, resposta) => {
    const id = Number(requisicao.params.id);
    const produto = produtos.find((item) => item.id === id);

    if (!produto) {
      return resposta.status(404).json({
        mensagem: "Produto não encontrado."
      });
    }

    const { nome, preco, vendedor, especie } = requisicao.body;

    produto.nome = nome.trim();
    produto.preco = Number(preco);
    produto.vendedor = vendedor.trim();
    produto.especie = especie.trim();

    return resposta.status(200).json({
      mensagem: "Produto atualizado com sucesso.",
      produto
    });
  }
);

app.delete("/api/produtos/:id", (requisicao, resposta) => {
  const id = Number(requisicao.params.id);

  const indiceProduto = produtos.findIndex(
    (item) => item.id === id
  );

  if (indiceProduto === -1) {
    return resposta.status(404).json({
      mensagem: "Produto não encontrado."
    });
  }

  const [produtoRemovido] = produtos.splice(
    indiceProduto,
    1
  );

  return resposta.status(200).json({
    mensagem: "Produto removido com sucesso.",
    produto: produtoRemovido
  });
});

// Este middleware deve ficar depois de todas as rotas.
app.use((requisicao, resposta) => {
  return resposta.status(404).json({
    mensagem: "Rota não encontrada."
  });
});

app.listen(PORTA, () => {
  console.log(`Servidor QUÉX rodando em http://localhost:${PORTA}`);
});

