// =======================
// PLUGIN: TURNO NOTURNO
// =======================

const turnoNoturnoPlugin = {
  id: "turnoNoturno",

  beforeDatasetsDraw(chart) {
    if (chart.options.plugins?.turnoNoturno?.enabled === false) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    const inicio = xScale.min;
    const fim = xScale.max;

    let cursor = new Date(inicio);
    cursor.setHours(19, 0, 0, 0);

    if (cursor > inicio) cursor.setDate(cursor.getDate() - 1);

    ctx.save();

    ctx.beginPath();
    ctx.rect(
      chartArea.left,
      chartArea.top,
      chartArea.right - chartArea.left,
      chartArea.bottom - chartArea.top
    );
    ctx.clip();

    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";

    while (cursor < fim) {
      const inicioTurno = new Date(cursor);
      const fimTurno = new Date(cursor);
      fimTurno.setDate(fimTurno.getDate() + 1);
      fimTurno.setHours(7, 0, 0, 0);

      const xInicio = xScale.getPixelForValue(inicioTurno);
      const xFim = xScale.getPixelForValue(fimTurno);

      ctx.fillRect(
        xInicio,
        chartArea.top,
        xFim - xInicio,
        chartArea.bottom - chartArea.top
      );

      cursor.setDate(cursor.getDate() + 1);
    }

    ctx.restore();
  }
};

Chart.register(ChartDataLabels);
Chart.register(turnoNoturnoPlugin);

// =======================
// UTILIDADES
// =======================

function dataSemFuso(data) {
  if (!data) return null;
  return new Date(data.replace("Z", ""));
}

function formatarData(dateObj) {
  if (!(dateObj instanceof Date)) return "-";
  return dateObj.toLocaleString("pt-BR");
}

// =======================
// ESTADO GLOBAL
// =======================

let dadosOP = {};
let tagAtual = null;
let componentesCache = {};

// =======================
// BUSCAR OP
// =======================

async function buscar() {
  const codigo = document.getElementById("codigo").value;
  if (!codigo) return;

  const res = await fetch("/op/" + encodeURIComponent(codigo));
  const resposta = await res.json();

  dadosOP = resposta.tags;

  document.getElementById("linhaInfo").innerText =
    `OP: ${resposta.op} | Cliente: ${resposta.cliente_nome}`;

  montarAbasTags();
}

window.buscar = buscar;

// =======================
// ABAS DE TAGS
// =======================

function montarAbasTags() {
  const container = document.getElementById("abasTags");
  container.innerHTML = "";

  Object.keys(dadosOP).forEach((tag, index) => {
    const btn = document.createElement("button");
    btn.className = "aba-tag";
    btn.innerText = tag;

    if (index === 0) {
      btn.classList.add("ativa");
      carregarTag(tag);
    }

    btn.onclick = () => {
      document.querySelectorAll(".aba-tag")
        .forEach(b => b.classList.remove("ativa"));

      btn.classList.add("ativa");
      carregarTag(tag);
    };

    container.appendChild(btn);
  });
}

// =======================
// CARREGAR TAG
// =======================

function carregarTag(tag) {
  tagAtual = tag;
  componentesCache = dadosOP[tag];
  montarAbasComponentes(componentesCache);
}

// =======================
// ABAS DE COMPONENTES
// =======================

function montarAbasComponentes(componentes) {
  const container = document.getElementById("abasComponentes");
  container.innerHTML = "";

  Object.keys(componentes).forEach((nome, index) => {
    const btn = document.createElement("button");
    btn.className = "aba-componente";
    btn.innerText = nome;

    if (index === 0) {
      btn.classList.add("ativa");
      carregarComponente(nome);
    }

    btn.onclick = () => {
      document.querySelectorAll(".aba-componente")
        .forEach(b => b.classList.remove("ativa"));

      btn.classList.add("ativa");
      carregarComponente(nome);
    };

    container.appendChild(btn);
  });
}

// =======================
// CARREGAR COMPONENTE
// =======================

function carregarComponente(nome) {
  const dados = componentesCache[nome];
  montarTabela(dados);
  montarGraficoGantt(dados);
  montarGraficoDuracao(dados);
}

// =======================
// TABELA
// =======================

function montarTabela(dados) {
  let html = `
    <tr>
      <th>Etapa</th>
      <th>Status</th>
      <th>Início</th>
      <th>Fim</th>
    </tr>
  `;

  dados.forEach(d => {
    html += `
      <tr>
        <td>${d.nome_etapa}</td>
        <td>${d.status}</td>
        <td>${formatarData(dataSemFuso(d.inicio))}</td>
        <td>${d.fim ? formatarData(dataSemFuso(d.fim)) : "-"}</td>
      </tr>
    `;
  });

  document.getElementById("tabela").innerHTML = html;
}

// =======================
// GANTT
// =======================

let chartGantt;

function montarGraficoGantt(dados) {

  if (chartGantt) chartGantt.destroy();

  const etapas = {};
  const data = [];

  dados.forEach(d => {
    if (!etapas[d.nome_etapa]) etapas[d.nome_etapa] = [];
    etapas[d.nome_etapa].push(d);
  });

  Object.values(etapas).forEach(lista => {
    lista.sort((a,b)=> new Date(a.inicio) - new Date(b.inicio));

    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];

    const inicio = dataSemFuso(primeiro.inicio);
    const fim = ultimo.fim
      ? dataSemFuso(ultimo.fim)
      : dataSemFuso(ultimo.inicio);

    const statusFinal = (ultimo.status || "").toLowerCase();
    const emAndamento = statusFinal.includes("andamento");

    data.push({
      x: [inicio, fim],
      y: primeiro.nome_etapa,
      backgroundColor: emAndamento ? "#f59e0b" : "#2563eb"
    });
  });

  chartGantt = new Chart(
    document.getElementById("grafico"),
    {
      type: "bar",
      data: {
        datasets: [{
          data,
          backgroundColor: ctx => ctx.raw.backgroundColor,
          borderRadius: 5,
          barThickness: 16
        }]
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          turnoNoturno: { enabled: true }
        },
        scales: {
          x: { type: "time" }
        }
      }
    }
  );
}

// =======================
// GRÁFICO DE DURAÇÃO
// =======================

let chartDuracao;

function montarGraficoDuracao(dados) {

  if (chartDuracao) chartDuracao.destroy();

  const etapas = {};
  const statusFinal = {};

  dados.forEach(d => {
    if (!etapas[d.nome_etapa]) {
      etapas[d.nome_etapa] = 0;
      statusFinal[d.nome_etapa] = false;
    }

    const ini = dataSemFuso(d.inicio);
    const fim = d.fim ? dataSemFuso(d.fim) : ini;

    etapas[d.nome_etapa] += (fim - ini) / 36e5;

    if ((d.status || "").toLowerCase().includes("andamento")) {
      statusFinal[d.nome_etapa] = true;
    }
  });

  const labels = Object.keys(etapas);
  const valores = labels.map(l => etapas[l].toFixed(2));

  chartDuracao = new Chart(
    document.getElementById("graficoDuracao"),
    {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: valores,
          backgroundColor: ctx =>
            statusFinal[ctx.label] ? "#f59e0b" : "#2563eb"
        }]
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } }
      }
    }
  );
}

// =======================
// AUTO BUSCA VIA URL
// =======================

window.addEventListener("load", () => {
  const codigo = new URLSearchParams(window.location.search).get("codigo");
  if (codigo) {
    document.getElementById("codigo").value = codigo;
    buscar();
  }
});

