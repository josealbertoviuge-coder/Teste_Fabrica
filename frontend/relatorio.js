function dataBR() {
  return new Date().toLocaleString("pt-BR");
}

async function carregarRelatorio() {

  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("codigo");
  const tagSelecionada = params.get("tag");

  if (!codigo) {
    alert("Código da OP não informado.");
    return;
  }

  const res = await fetch("https://teste-fabrica.onrender.com/op/" + codigo);
  const dados = await res.json();

  // ==============================
  // TAG ATIVA (fallback)
  // ==============================
  let tagAtiva = "—";

  for (const [nomeTag, etapas] of Object.entries(dados.tags)) {
    const lista = Object.values(etapas).flat();

    if (lista.some(e =>
      (e.status || "").toLowerCase().includes("andamento")
    )) {
      tagAtiva = nomeTag;
      break;
    }
  }

  const tagUsada = tagSelecionada || tagAtiva;

  // ==============================
  // CABEÇALHO
  // ==============================
  document.getElementById("infoOP").innerHTML =
    `<strong>OP:</strong> ${dados.op} &nbsp;&nbsp;
     <strong>Cliente / Client:</strong> ${dados.cliente_nome} &nbsp;&nbsp;
     <strong>TAG:</strong> ${tagUsada}`;

  document.getElementById("dataRelatorio").innerHTML =
    `<strong>Data de Emissão / Issued Date:</strong> ${dataBR()}`;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

  // ==============================
  // ETAPAS DA TAG
  // ==============================
  let todasEtapas = [];

  if (tagUsada && dados.tags[tagUsada]) {
    todasEtapas = Object.values(dados.tags[tagUsada]).flat();
  }

  // ==============================
  // STATUS FINAL
  // ==============================
  let statusFinal = "Concluído / Concluded";

  if (todasEtapas.some(e =>
    (e.status || "").toLowerCase().includes("andamento")
  )) {
    statusFinal = "Em Andamento / In Progress";
  }

  const statusEl = document.getElementById("statusFinal");
  statusEl.innerText = statusFinal;
  statusEl.className =
    statusFinal.includes("Andamento")
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

  // gráficos
  montarGanttRelatorio(todasEtapas);
  montarDuracaoRelatorio(todasEtapas);
}

carregarRelatorio();


// ===================================================
// GANTT IGUAL AO SISTEMA (SEM SCROLL / SEM LOOP)
// ===================================================

let chartGantt;

function montarGanttRelatorio(etapas) {

  if (chartGantt) chartGantt.destroy();

  const canvas = document.getElementById("graficoRelatorio");

  const agora = new Date();
  const agrupadas = {};
  const labels = [];
  const dados = [];

  etapas.forEach(e => {
    if (!e.inicio) return;

    if (!agrupadas[e.nome_etapa]) {
      agrupadas[e.nome_etapa] = [];
      labels.push(e.nome_etapa);
    }

    agrupadas[e.nome_etapa].push(e);
  });

  Object.values(agrupadas).forEach(lista => {

    lista.sort((a,b)=> new Date(a.inicio) - new Date(b.inicio));

    const ultimo = lista[lista.length - 1];
    const concluida =
      (ultimo.status || "").toLowerCase().includes("concl");

lista.forEach(item => {

  const inicio = item.inicio ? new Date(item.inicio) : null;
  if (!inicio || isNaN(inicio)) return;

  const fim = item.fim ? new Date(item.fim) : agora;

  dados.push({
    x: [inicio, fim],
    y: item.nome_etapa,
    backgroundColor: concluida ? "#2563eb" : "#f59e0b"
  });

});
  });

  // ⭐ altura fixa proporcional (igual sistema)
  const alturaPorEtapa = 55;
  canvas.height = Math.max(labels.length * alturaPorEtapa, 280);

  chartGantt = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: dados,
        borderRadius: 5,
        barThickness: 16,
        backgroundColor: ctx => ctx.raw.backgroundColor
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Linha do Tempo de Fabricação"
        }
      },
      scales: {
        x: {
          type: "time",
          time: { unit: "hour" },
          title: { display: true, text: "Tempo" }
        },
        y: {
          ticks: { font: { weight: "bold" } },
          title: { display: true, text: "Etapas" }
        }
      }
    }
  });
}


// ===================================================
// GRÁFICO DE DURAÇÃO (IGUAL AO SISTEMA)
// ===================================================

let chartDuracao;

function montarDuracaoRelatorio(etapas) {

  if (chartDuracao) chartDuracao.destroy();

  const acumulado = {};
  const statusEtapa = {};

  const agrupadas = {};

  etapas.forEach(e => {
    if (!e.inicio) return;

    if (!agrupadas[e.nome_etapa]) {
      agrupadas[e.nome_etapa] = [];
    }

    agrupadas[e.nome_etapa].push(e);
  });

  Object.entries(agrupadas).forEach(([etapa, lista]) => {

    lista.sort((a,b)=> new Date(a.inicio)-new Date(b.inicio));

    const ultimo = lista[lista.length - 1];

    let total = 0;

    lista.forEach(d => {
if (!d.inicio) return;
const ini = new Date(d.inicio);
if (isNaN(ini)) return;
      const fim = d.fim ? new Date(d.fim) : ini;
      total += (fim - ini) / 36e5;
    });

    acumulado[etapa] = Number(total.toFixed(2));

    statusEtapa[etapa] =
      !(ultimo.status || "").toLowerCase().includes("concl");
  });

  const labels = Object.keys(acumulado);
  const valores = Object.values(acumulado);

  const canvas = document.getElementById("graficoDuracaoRelatorio");

  canvas.height = Math.max(labels.length * 30, 180);

  chartDuracao = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: ctx => {
          const etapa = labels[ctx.dataIndex];
          return statusEtapa[etapa] ? "#f59e0b" : "#2563eb";
        }
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Duração Total por Etapa (h)"
        }
      },
      scales: {
        x: { title: { display: true, text: "Horas" } },
        y: { title: { display: true, text: "Etapas" } }
      }
    }
  });
}
