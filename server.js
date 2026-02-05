const { Pool } = require("pg");

const pool = new Pool({
 host: "db.weqlfktnorahxteiypul.supabase.co",
 user: "postgres",
 password: "Carbogas1234_GCQ",
 database: "postgres",
 port: 5432,
 ssl: { rejectUnauthorized: false }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
