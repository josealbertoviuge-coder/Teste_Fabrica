function dataBR() {
  return new Date().toLocaleString("pt-BR");
}

async function carregarRelatorio() {

  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("codigo");
  const tagSelecionada = params.get("tag"); // ⭐ importante

  if (!codigo) {
    alert("Código da OP não informado.");
    return;
  }

  const res = await fetch("https://teste-fabrica.onrender.com/op/" + codigo);
  const dados = await res.json();

  // ==============================
  // DESCOBRIR TAG ATIVA (fallback)
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
     <strong>Cliente / Client:</strong> ${dados.cliente_nome} &nbsp;&nbsp;
     <strong>TAG:</strong> ${tagSelecionada || tagAtiva}`;

  document.getElementById("dataRelatorio").innerHTML =
    `<strong>Emitido em:</strong> ${dataBR()}`;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

  // ==============================
  // LISTA DE ETAPAS
  // ==============================
  let todasEtapas = [];

  if (tagSelecionada && dados.tags[tagSelecionada]) {
    todasEtapas = Object.values(dados.tags[tagSelecionada]).flat();
  } else {
    todasEtapas = Object.values(dados.tags).flatMap(tag =>
      Object.values(tag).flat()
    );
  }

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

  montarGantt(todasEtapas);
montarDuracao(todasEtapas);
}

carregarRelatorio();

function montarGantt(etapas) {

  const canvas = document.getElementById("graficoRelatorio");

  const dados = etapas
    .filter(e => e.inicio)
    .map(e => ({
      x: [
        new Date(e.inicio),
        e.fim ? new Date(e.fim) : new Date()
      ],
      y: e.nome_etapa,
      backgroundColor:
        (e.status || "").toLowerCase().includes("andamento")
          ? "#f59e0b"
          : "#2563eb"
    }));

  new Chart(canvas, {
    type: "bar",
    data: {
      datasets: [{
        data: dados,
        borderRadius: 4,
        barThickness: 14,
        backgroundColor: ctx => ctx.raw.backgroundColor
      }]
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Linha do Tempo"
        }
      },
      scales: {
        x: { type: "time" }
      }
    }
  });
}

function montarDuracao(etapas) {

  const total = {};

  etapas.forEach(e => {
    if (!e.inicio) return;

    const ini = new Date(e.inicio);
    const fim = e.fim ? new Date(e.fim) : new Date();

    const horas = (fim - ini) / 36e5;

    total[e.nome_etapa] = (total[e.nome_etapa] || 0) + horas;
  });

  const labels = Object.keys(total);
  const valores = Object.values(total);

  const canvas = document.getElementById("graficoDuracaoRelatorio");

  new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: valores
      }]
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Duração por Etapa (horas)"
        }
      }
    }
  });
}
