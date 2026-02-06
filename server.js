import express from "express";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

// Conexão única
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

// Teste inicial de conexão
pool.connect()
  .then(() => console.log("Banco conectado"))
  .catch(err => console.error("Erro conexão:", err));

app.get("/", (req, res) => {
  res.send("API rodando");
});

const result = await pool.query(`
SELECT 
  p.codigo_peca,
  p.descricao,
  e.nome_etapa,
  a.status,
  a.data
FROM pecas p
JOIN andamento_pecas a ON p.id_peca = a.id_peca
JOIN etapas e ON a.id_etapa = e.id_etapa
WHERE p.codigo_peca = $1
ORDER BY a.data DESC
`, [codigo]);

app.listen(PORT, () => {
  console.log("Servidor iniciado");
});



