import express from "express";

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(express.json());

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

app.post("/api/produtos", (requisicao, resposta) => {
  const { nome, preco, vendedor, especie } = requisicao.body;

  if (!nome || !preco || !vendedor || !especie) {
    return resposta.status(400).json({
      mensagem: "Os campos nome, preco, vendedor e especie são obrigatórios."
    });
  }

  if (
    typeof nome !== "string" ||
    typeof vendedor !== "string" ||
    typeof especie !== "string" ||
    nome.trim() === "" ||
    vendedor.trim() === "" ||
    especie.trim() === "" ||
    !Number.isFinite(Number(preco)) ||
    Number(preco) <= 0
  ) {
    return resposta.status(400).json({
      mensagem: "Preencha os campos corretamente e informe um preco maior que zero."
    });
  }

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
});

app.listen(PORTA, () => {
  console.log(`Servidor QUÉX rodando em http://localhost:${PORTA}`);
});