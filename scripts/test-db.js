import pool from '../database/pool.js'

try {
  const result = await pool.query(
    'SELECT current_database() AS nome'
  )

  console.log('Conexão funcionando.')
  console.log('Banco:', result.rows[0].nome)
} catch (error) {
  console.error('Falha na conexão:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}