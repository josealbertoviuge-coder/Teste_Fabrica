function dataBR() {
  return new Date().toLocaleString("pt-BR");
}

async function carregarRelatorio(){

  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("codigo");

  const res = await fetch("https://teste-fabrica.onrender.com/op/" + codigo);
  const dados = await res.json();

  // descobrir TAG ativa
let tagAtiva = "—";

for (const [nomeTag, etapas] of Object.entries(dados.tags)) {
  const lista = Object.values(etapas).flat();

  if (lista.some(e => e.status === "Em Andamento")) {
    tagAtiva = nomeTag;
    break;
  }
}

document.getElementById("infoOP").innerHTML =
  `<strong>OP:</strong> ${dados.op} &nbsp;&nbsp; 
   <strong>Cliente:</strong> ${dados.cliente_nome} &nbsp;&nbsp;
   <strong>TAG Ativa:</strong> ${tagAtiva}`;

  document.getElementById("dataRelatorio").innerHTML =
    `<strong>Emitido em:</strong> ${dataBR()}`;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

  const todasEtapas = Object.values(dados.tags).flatMap(tag =>
    Object.values(tag).flat()
  );

  // status final
let statusFinal = "Concluído";

if (todasEtapas.some(e => e.status === "Em Andamento")) {
  statusFinal = "Em Andamento";
}

const statusEl = document.getElementById("statusFinal");
statusEl.innerText = statusFinal;

// aplica cor automaticamente
statusEl.className =
  statusFinal === "Em Andamento"
    ? "status-andamento"
    : "status-concluido";

document.getElementById("statusFinal").innerText = statusFinal;
  // tabela
  let html = `
    <tr>
      <th>Etapa</th>
      <th>Status</th>
      <th>Início</th>
      <th>Fim</th>
    </tr>
  `;

  todasEtapas.forEach(e => {
    html += `
      <tr>
        <td>${e.nome_etapa}</td>
        <td>${e.status}</td>
        <td>${e.inicio || "-"}</td>
        <td>${e.fim || "-"}</td>
      </tr>
    `;
  });

  document.getElementById("tabelaRelatorio").innerHTML = html;

}

carregarRelatorio();
