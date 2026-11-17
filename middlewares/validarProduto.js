import produtoSchema from "../schemas/produtoSchema.js";

function validarProduto(requisicao, resposta, proximo) {
  const { error, value } = produtoSchema.validate(requisicao.body, {
    abortEarly: false
  });

  if (error) {
    return resposta.status(400).json({
      mensagem: "Dados do produto inválidos.",
      erros: error.details.map((detalhe) => detalhe.message)
    });
  }

  requisicao.produtoValidado = value;

  return proximo();
}

export default validarProduto;