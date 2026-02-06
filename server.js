import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "frontend")));

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

app.get("/", (req,res)=>{
  res.sendFile(path.join(__dirname,"frontend","index.html"));
});

app.get("/peca/:codigo", async (req, res) => {
  try {
    const codigo = req.params.codigo;   // 👈 ESTA LINHA

    const result = await pool.query(`
      SELECT
      p.codigo_peca,
      e.nome_etapa,
      a.status,
      a.inicio,
      a.fim
    FROM andamento_pecas a
    JOIN etapas e ON e.id_etapa = a.id_etapa
    JOIN pecas p ON p.id_peca = a.id_peca
    WHERE p.codigo_peca = $1
    ORDER BY a.inicio;
    `, [codigo]);

    res.json(result.rows);

  } catch (err) {
    console.error("ERRO QUERY:", err);
    res.status(500).send(err.message);
  }
});

app.listen(PORT, () => {
  console.log("Servidor iniciado");
});

app.post("/login",(req,res)=>{
  const {user,pass} = req.body;

  if(user==="admin" && pass==="123"){
    res.json({ok:true});
  }else{
    res.status(401).send("Login inválido");
  }
});







