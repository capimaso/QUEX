import { Router } from 'express'
import validarProduto from '../middlewares/validarProduto.js'
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
router.post('/', validarProduto, criarProduto)
router.put('/:id', validarProduto, atualizarProduto)
router.delete('/:id', excluirProduto)

export default router