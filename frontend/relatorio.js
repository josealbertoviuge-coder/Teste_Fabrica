function dataBR() {
  return new Date().toLocaleString("pt-BR");
}

async function carregarRelatorio() {

  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("codigo");

  const res = await fetch("https://teste-fabrica.onrender.com/op/" + codigo);
  const dados = await res.json();

  // ==============================
  // DESCOBRIR TAG ATIVA
  // ==============================
  let tagAtiva = "—";

  for (const [nomeTag, etapas] of Object.entries(dados.tags)) {

    const lista = Object.values(etapas).flat();

    if (lista.some(e =>
      (e.status || "").toLowerCase().trim() === "em andamento"
    )) {
      tagAtiva = nomeTag;
      break;
    }
  }

  // ==============================
  // CABEÇALHO
  // ==============================
  document.getElementById("infoOP").innerHTML =
    `<strong>OP:</strong> ${dados.op} &nbsp;&nbsp;
     <strong>Cliente:</strong> ${dados.cliente_nome} &nbsp;&nbsp;
     <strong>TAG:</strong> ${tagAtiva}`;

  document.getElementById("dataRelatorio").innerHTML =
    `<strong>Emitido em:</strong> ${dataBR()}`;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

  // ==============================
  // LISTA DE ETAPAS
  // ==============================
  const todasEtapas = Object.values(dados.tags).flatMap(tag =>
    Object.values(tag).flat()
  );

  // ==============================
  // STATUS FINAL
  // ==============================
  let statusFinal = "Concluído";

  if (todasEtapas.some(e =>
    (e.status || "").toLowerCase().trim() === "em andamento"
  )) {
    statusFinal = "Em Andamento";
  }

  const statusEl = document.getElementById("statusFinal");
  statusEl.innerText = statusFinal;

  statusEl.className =
    statusFinal === "Em Andamento"
      ? "status-andamento"
      : "status-concluido";

  // ==============================
  // TABELA
  // ==============================
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
        <td class="${(e.status || '').toLowerCase().includes('andamento') 
          ? 'status-andamento' 
          : 'status-concluido'}">
          ${e.status}
        </td>
        <td>${e.inicio || "-"}</td>
        <td>${e.fim || "-"}</td>
      </tr>
    `;
  });

  document.getElementById("tabelaRelatorio").innerHTML = html;
}

// executa ao carregar
carregarRelatorio();

// se navegar entre OPs sem recarregar a página
window.addEventListener("popstate", carregarRelatorio);
