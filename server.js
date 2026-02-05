const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.get("/", (req, res) => {
  res.send("API rodando");
});

app.get("/peca/:codigo", async (req, res) => {
  try {
    const codigo = req.params.codigo;

    const result = await pool.query(
      `SELECT p.codigo_peca,
              p.descricao,
              e.nome_etapa,
              a.status
       FROM pecas p
       JOIN andamento_pecas a ON p.id_peca = a.id_peca
       JOIN etapas e ON a.id_etapa = e.id_etapa
       WHERE p.codigo_peca = $1
       ORDER BY a.data DESC
       LIMIT 1`,
      [codigo]
    );

    res.json(result.rows[0] || {});
  } catch (err) {
  console.error("ERRO REAL:", err.message);
  res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});


