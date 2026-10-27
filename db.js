import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const variaveisObrigatorias = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME"
];

const variaveisFaltantes = variaveisObrigatorias.filter(
  (variavel) => !process.env[variavel]
);

if (variaveisFaltantes.length > 0) {
  throw new Error(
    `Configure no arquivo .env: ${variaveisFaltantes.join(", ")}`
  );
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

pool.on("error", (erro) => {
  console.error("Erro inesperado no PostgreSQL:", erro.message);
});

export default pool;