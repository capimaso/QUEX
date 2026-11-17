import { Router } from 'express'
import validarProduto from '../middlewares/validarProduto.js'
import autenticarVendedor from '../middlewares/autenticarVendedor.js'
import {
  listarProdutos,
  buscarProduto,
  criarProduto,
  atualizarProduto,
  excluirProduto,
} from '../controllers/produtoController.js'

const router = Router()

router.get('/', listarProdutos)
router.get('/:id', buscarProduto)
router.post('/', autenticarVendedor, validarProduto, criarProduto)
router.put('/:id', autenticarVendedor, validarProduto, atualizarProduto)
router.delete('/:id', autenticarVendedor, excluirProduto)

export default router