// =======================
// IMPORTAÇÕES
// =======================

import express from "express";
import cors from "cors";
import pkg from "pg";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";

const { Pool } = pkg;

// =======================
// CONFIGURAÇÃO BÁSICA
// =======================

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// pasta do frontend
app.use(express.static(path.join(__dirname, "frontend")));

const PORT = process.env.PORT || 3000;

// =======================
// CONEXÃO COM BANCO
// =======================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // necessário para Render / cloud
});

// teste inicial
pool.connect()
  .then(() => console.log("✅ Banco conectado"))
  .catch(err => console.error("❌ Erro conexão:", err));

// =======================
// ROTA PRINCIPAL
// =======================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ======================================================
// 🔹 BUSCA POR TAG (MODO ORIGINAL)
// ======================================================

app.get("/tag/:codigo", async (req, res) => {
  try {
    const codigo = req.params.codigo;

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

    const andamento = await pool.query(`
      SELECT
        a.componente,
        e.nome_etapa,
        a.status,
        a.inicio,
        a.fim
      FROM andamento_pecas a
      JOIN etapas e ON e.id_etapa = a.id_etapa
      WHERE a.tag = $1
      ORDER BY a.componente, a.inicio
    `, [codigo]);

    const componentes = {};

    andamento.rows.forEach(l => {
      const comp = l.componente || "Sem componente";
      if (!componentes[comp]) componentes[comp] = [];

      componentes[comp].push({
        nome_etapa: l.nome_etapa,
        status: l.status,
        inicio: l.inicio,
        fim: l.fim
      });
    });

    res.json({
      tag: cabecalho.rows[0].tag,
      op: cabecalho.rows[0].op,
      cliente_nome: cabecalho.rows[0].cliente_nome,
      componentes
    });

  } catch (err) {
    console.error("ERRO TAG:", err);
    res.status(500).send(err.message);
  }
});

// ======================================================
// 🔹 BUSCA POR OP (SUPORTA BARRAS - VERSÃO FINAL)
// ======================================================

app.get(/^\/op\/(.+)/, async (req, res) => {
  try {

    let op = decodeURIComponent(req.params[0])
      .replace(/\u00A0/g, " ")
      .trim();

    console.log("🔎 OP recebida:", op);

    if (!op) {
      return res.status(400).json({ error: "OP inválida" });
    }

    const cab = await pool.query(`
      SELECT cliente_nome, data_abertura
      FROM ordem_de_producao
      WHERE TRIM(ordem_producao::text) = TRIM($1)
      LIMIT 1
    `, [op]);

    if (cab.rowCount === 0) {
      return res.status(404).json({ error: "OP não encontrada" });
    }

    const dados = await pool.query(`
      SELECT
        t.tag,
        a.componente,
        e.nome_etapa,
        a.status,
        a.inicio,
        a.fim
      FROM tags t
      JOIN andamento_pecas a ON a.tag = t.tag
      JOIN etapas e ON e.id_etapa = a.id_etapa
      WHERE TRIM(t.op::text) = TRIM($1)
      ORDER BY t.tag, a.componente, a.inicio
    `, [op]);

    const tags = {};

    dados.rows.forEach(l => {
      const tag = l.tag;
      const comp = l.componente || "Sem componente";

      if (!tags[tag]) tags[tag] = {};
      if (!tags[tag][comp]) tags[tag][comp] = [];

      tags[tag][comp].push({
        nome_etapa: l.nome_etapa,
        status: l.status,
        inicio: l.inicio,
        fim: l.fim
      });
    });

    res.json({
      op,
      cliente_nome: cab.rows[0].cliente_nome,
      data_abertura: cab.rows[0].data_abertura,
      tags
    });

  } catch (err) {
    console.error("ERRO OP:", err);
    res.status(500).send(err.message);
  }
});

// ======================================================
// 🔹 GERAR PDF DO RELATÓRIO
// ======================================================

app.get("/pdf/:codigo", async (req, res) => {
  try {
    const codigo = req.params.codigo;

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "new"
    });

    const page = await browser.newPage();

    // carrega seu relatório já existente
    await page.goto(
      `https://${req.headers.host}/relatorio.html?codigo=${codigo}`,
      { waitUntil: "networkidle0" }
    );

    // aguarda renderização dos gráficos
    await new Promise(r => setTimeout(r, 1500));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        bottom: "15mm",
        left: "10mm",
        right: "10mm"
      }
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=relatorio-${codigo}.pdf`,
      "Content-Length": pdf.length
    });

    res.send(pdf);

  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).send("Erro ao gerar PDF");
  }
});

// ======================================================
// 🔹 ROTA DE LOGIN (OPCIONAL)
// ======================================================

app.post("/login", (req, res) => {
  const { user, pass } = req.body;

  if (user === "admin" && pass === "123") {
    res.json({ ok: true });
  } else {
    res.status(401).send("Login inválido");
  }
});

// =======================
// INICIA SERVIDOR
// =======================

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado na porta ${PORT}`);
});



