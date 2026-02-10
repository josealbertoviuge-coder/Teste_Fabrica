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

// =======================
// REGISTRO DE PLUGINS
// =======================

Chart.register(ChartDataLabels);
Chart.register(turnoNoturnoPlugin);

// =======================
// DATA SEM FUSO
// =======================

function dataSemFuso(data) {
  if (!data) return null;
  return new Date(data.replace("Z", ""));
}

function formatarDataTabela(dateObj) {
  if (!(dateObj instanceof Date)) return "-";

  return dateObj.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// =======================
// BUSCA / ABAS
// =======================

let componentesCache = {};
let chartGantt = null;
let chartGanttY = null;
let chartDuracao = null;

function montarAbasComponentes(componentes) {
  const container = document.getElementById("abasComponentes");
  container.innerHTML = "";

  Object.keys(componentes).forEach((nome, index) => {
    const btn = document.createElement("button");
    btn.className = "aba-componente";
    btn.innerText = nome;

    if (index === 0) btn.classList.add("ativa");

    btn.onclick = () => {
      document
        .querySelectorAll(".aba-componente")
        .forEach(b => b.classList.remove("ativa"));

      btn.classList.add("ativa");

      const dados = componentesCache[nome];
      montarTabela(dados);
      montarGraficoGantt(dados);
      montarGraficoDuracao(dados);
    };

    container.appendChild(btn);
  });
}

async function buscar() {
  const codigo = document.getElementById("codigo").value;
  if (!codigo) return;

  gerarQRCode(codigo);

  const res = await fetch(
    "https://teste-fabrica.onrender.com/tag/" + codigo
  );
  const { tag, op, cliente_nome, componentes } = await res.json();

  componentesCache = componentes;

  document.getElementById("linhaInfo").innerText =
    `TAG: ${tag}` +
    (op ? ` | OP: ${op}` : "") +
    (cliente_nome ? ` | Cliente: ${cliente_nome}` : "");

  montarAbasComponentes(componentes);

  const primeiro = Object.keys(componentes)[0];
  const dados = componentes[primeiro];

  montarTabela(dados);
  montarGraficoGantt(dados);
  montarGraficoDuracao(dados);
}

window.buscar = buscar;

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
        <td>${d.inicio ? formatarDataTabela(dataSemFuso(d.inicio)) : "-"}</td>
        <td>${d.fim ? formatarDataTabela(dataSemFuso(d.fim)) : "Em andamento"}</td>
      </tr>
    `;
  });

  document.getElementById("tabela").innerHTML = html;
}

// =======================
// GANTT (EIXO Y FIXO)
// =======================

function montarGraficoGantt(dados) {
  if (chartGantt) chartGantt.destroy();
  if (chartGanttY) chartGanttY.destroy();

  const agora = new Date();
  const canvas = document.getElementById("grafico");
  const canvasY = document.getElementById("graficoY");

  const datas = dados.flatMap(d => [
    d.inicio ? dataSemFuso(d.inicio) : null,
    d.fim ? dataSemFuso(d.fim) : agora
  ]).filter(Boolean);

  if (!datas.length) return;

  const minData = new Date(Math.min(...datas));
  const maxData = new Date(Math.max(...datas));

  const labels = [...new Set(dados.map(d => d.nome_etapa))];

  const alturaPorEtapa = 65;
  const alturaCanvas = Math.max(labels.length * alturaPorEtapa, 280);

  canvas.height = alturaCanvas;
  canvasY.height = alturaCanvas;

  const larguraPorDia = 220;
  const diasTotais = (maxData - minData) / 86400000;
  canvas.width = Math.max(diasTotais * larguraPorDia, 14 * larguraPorDia);

  const data = [];
  const cores = [];

  dados.forEach(d => {
    if (!d.inicio) return;
    data.push({
      x: [dataSemFuso(d.inicio), d.fim ? dataSemFuso(d.fim) : agora],
      y: d.nome_etapa
    });
    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  // 🔹 GANTT PRINCIPAL (SEM EIXO Y)
  chartGantt = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: cores, barThickness: 16 }] },
    options: {
      responsive: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        turnoNoturno: { enabled: true }
      },
      scales: {
        x: { type: "time", min: minData, max: maxData },
        y: { display: false }
      }
    }
  });

  // 🔹 EIXO Y FIXO
  chartGanttY = new Chart(canvasY, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: labels.map(() => 0), backgroundColor: "transparent" }]
    },
    options: {
      responsive: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          ticks: {
            font: { weight: "bold" },
            backdropColor: "#fff",
            backdropPadding: 4
          },
          grid: { display: false }
        }
      }
    }
  });
}

// =======================
// GRÁFICO DE DURAÇÃO
// =======================

function montarGraficoDuracao(dados) {
  if (chartDuracao) chartDuracao.destroy();

  const acumulado = {};
  const emAndamento = {};
  const agora = new Date();

  dados.forEach(d => {
    if (!d.inicio) return;
    const horas = ((d.fim ? dataSemFuso(d.fim) : agora) - dataSemFuso(d.inicio)) / 36e5;
    acumulado[d.nome_etapa] = (acumulado[d.nome_etapa] || 0) + horas;
    emAndamento[d.nome_etapa] = !d.fim;
  });

  const etapas = Object.keys(acumulado);

  chartDuracao = new Chart(document.getElementById("graficoDuracao"), {
    type: "bar",
    data: {
      labels: etapas,
      datasets: [{
        data: etapas.map(e => acumulado[e].toFixed(2)),
        backgroundColor: etapas.map(e => emAndamento[e] ? "#f59e0b" : "#2563eb")
      }]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } }
    }
  });
}

// =======================
// AUTO BUSCA
// =======================

window.addEventListener("load", () => {
  const codigo = new URLSearchParams(window.location.search).get("codigo");
  if (codigo) {
    document.getElementById("codigo").value = codigo;
    buscar();
  }
});

// =======================
// QR CODE
// =======================

function gerarQRCode(codigo) {
  document.getElementById("qrcode").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    "https://testefabrica-roan.vercel.app/?codigo=" + codigo;
}
