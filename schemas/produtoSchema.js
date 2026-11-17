import Joi from "joi";

const produtoSchema = Joi.object({
  vendedor_id: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      "any.required": "O vendedor_id é obrigatório.",
      "number.base": "O vendedor_id deve ser um número.",
      "number.integer": "O vendedor_id deve ser um número inteiro.",
      "number.min": "O vendedor_id deve ser maior que zero."
    }),

  nome: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .required()
    .messages({
      "any.required": "O nome do produto é obrigatório.",
      "string.empty": "O nome do produto é obrigatório.",
      "string.min": "O nome deve ter pelo menos 3 caracteres.",
      "string.max": "O nome deve ter no máximo 150 caracteres."
    }),

  descricao: Joi.string()
    .trim()
    .max(1000)
    .allow("", null)
    .optional()
    .messages({
      "string.max": "A descrição deve ter no máximo 1000 caracteres."
    }),

  especie: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "any.required": "A espécie é obrigatória.",
      "string.empty": "A espécie é obrigatória.",
      "string.min": "A espécie deve ter pelo menos 2 caracteres.",
      "string.max": "A espécie deve ter no máximo 100 caracteres."
    }),

  preco: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      "any.required": "O preço é obrigatório.",
      "number.base": "O preço deve ser um número.",
      "number.positive": "O preço deve ser maior que zero.",
      "number.precision": "O preço pode ter no máximo 2 casas decimais."
    }),

  estoque: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      "any.required": "O estoque é obrigatório.",
      "number.base": "O estoque deve ser um número.",
      "number.integer": "O estoque deve ser um número inteiro.",
      "number.min": "O estoque não pode ser negativo."
    }),

  ativo: Joi.boolean()
    .optional()
    .messages({
      "boolean.base": "O campo ativo deve ser verdadeiro ou falso."
    })
}).unknown(false);

export default produtoSchema;