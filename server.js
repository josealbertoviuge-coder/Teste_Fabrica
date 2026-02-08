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

app.get("/tag/:codigo", async (req, res) => {
  try {
    const codigo = req.params.codigo;

    // 🔹 Busca TAG + OP + Cliente
    const cabecalho = await pool.query(`
      SELECT
        t.tag,
        t.op,
        o.cliente_nome
      FROM tags t
      LEFT JOIN ordem_de_producao o
        ON o.ordem_producao = t.op
      WHERE t.tag = $1
    `, [codigo]);

    if (cabecalho.rowCount === 0) {
      return res.status(404).json({ error: "TAG não encontrada" });
    }

    // 🔹 Busca etapas da peça
    const etapas = await pool.query(`
      SELECT
        e.nome_etapa,
        a.status,
        a.inicio,
        a.fim
      FROM andamento_pecas a
      JOIN etapas e ON e.id_etapa = a.id_etapa
      WHERE a.tag = $1
      ORDER BY a.inicio
    `, [codigo]);

    res.json({
      tag: cabecalho.rows[0].tag,
      op: cabecalho.rows[0].op,
      cliente_nome: cabecalho.rows[0].cliente_nome,
      etapas: etapas.rows
    });

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











