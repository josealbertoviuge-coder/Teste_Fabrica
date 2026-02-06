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

app.get("/peca/:codigo", async (req, res) => {
  try {
    const codigo = req.params.codigo;

    const result = await pool.query(
      `SELECT * FROM pecas WHERE codigo_peca = $1`,
      [codigo]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("ERRO QUERY:", err);
    res.status(500).send(err.message);
  }
});

app.listen(PORT, () => {
  console.log("Servidor iniciado");
});


