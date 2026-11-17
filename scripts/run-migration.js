import { readFile } from 'node:fs/promises'
import pool from '../database/pool.js'

try {
  const check = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `)

  if (check.rows[0].total !== 0) {
    throw new Error(
      `O banco já contém ${check.rows[0].total} tabelas. Migração cancelada para evitar duplicações.`
    )
  }

  const sql = await readFile(
    new URL('../database/quex_entrega.sql', import.meta.url),
    'utf8'
  )

  await pool.query(sql)

  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM usuario) AS usuarios,
      (SELECT COUNT(*)::int FROM produto) AS produtos,
      (SELECT COUNT(*)::int FROM pedido) AS pedidos
  `)

  console.log('Migração aplicada com sucesso.')
  console.log(result.rows[0])
} catch (error) {
  console.error('Migração não concluída:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}