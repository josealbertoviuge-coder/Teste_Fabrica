// =======================
// PLUGIN: TURNO NOTURNO
// =======================

const turnoNoturnoPlugin = {
  id: "turnoNoturno",

  beforeDatasetsDraw(chart, args, options) {
    // ⛔ só executa se o plugin estiver habilitado
    if (!options || !options.enabled) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    const inicio = xScale.min;
    const fim = xScale.max;

    let cursor = new Date(inicio);
    cursor.setHours(19, 0, 0, 0);

    if (cursor > inicio) {
      cursor.setDate(cursor.getDate() - 1);
    }

    ctx.save();
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)"; // azul claro

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
// PLUGINS
// =======================

Chart.register(ChartDataLabels);
Chart.register(turnoNoturnoPlugin);

// =======================
// DATA SEM FUSO (exibe como digitado)
// =======================

function dataSemFuso(data) {
  if (!data) return null;
  return new Date(data.replace("Z", ""));
}

// =======================
// FORMATADOR PADRÃO
// =======================

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
// BUSCAR PEÇA
// =======================

async function buscar() {
  const codigo = document.getElementById("codigo").value;
  if (!codigo) return;

  document.getElementById("titulo").innerText =
    "Consulta de Peça — " + codigo;

  gerarQRCode(codigo);

  const res = await fetch(
    "https://teste-fabrica.onrender.com/peca/" + codigo
  );

  const dados = await res.json();

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
    const inicio = d.inicio
      ? formatarDataTabela(dataSemFuso(d.inicio))
      : "-";

    const fim = d.fim
      ? formatarDataTabela(dataSemFuso(d.fim))
      : "Em andamento";

    html += `
      <tr>
        <td>${d.nome_etapa}</td>
        <td>${d.status}</td>
        <td>${inicio}</td>
        <td>${fim}</td>
      </tr>
    `;
  });

  document.getElementById("tabela").innerHTML = html;
}

// =======================
// GRÁFICO GANTT (SCROLL + AGRUPADO)
// =======================

let chartGantt;

function montarGraficoGantt(dados) {
  if (chartGantt) chartGantt.destroy();

  const agora = new Date();
  const canvas = document.getElementById("grafico");

  // =======================
  // RANGE GLOBAL
  // =======================

  const datas = dados
    .flatMap(d => [
      d.inicio ? dataSemFuso(d.inicio) : null,
      d.fim ? dataSemFuso(d.fim) : agora
    ])
    .filter(Boolean);

  if (!datas.length) return;

  const minData = new Date(Math.min(...datas));

  const eixoMin = new Date(minData);
  const eixoMax = new Date(minData);
  eixoMax.setDate(eixoMax.getDate() + 14);

  // =======================
  // ETAPAS ÚNICAS (1 LINHA)
  // =======================

  const labels = [...new Set(dados.map(d => d.nome_etapa))];

  // =======================
  // AJUSTE DE ALTURA (SCROLL)
  // =======================

  const alturaPorEtapa = 75;
  const alturaMinima = 260;

  const alturaCanvas = labels.length * alturaPorEtapa;
  canvas.height = Math.max(alturaCanvas, alturaMinima);

  // =======================
  // DATASET
  // =======================

  const data = [];
  const cores = [];
  
  dados.forEach(d => {
    if (!d.inicio) return;

    const inicio = dataSemFuso(d.inicio);
    const fim = d.fim ? dataSemFuso(d.fim) : agora;

    data.push({ x: [inicio, fim], y: d.nome_etapa });
    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  chartGantt = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Linha do Tempo",
        data,
        backgroundColor: cores,
        borderRadius: 6,
        barThickness: 18
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      indexAxis: "y",

      plugins: {

        // ✅ ATIVA O TURNO NOTURNO SÓ AQUI
        turnoNoturno: {
          enabled: true
        },
        title: {
          display: true,
          text: "Timeline de Execução da Peça",
          font: { weight: "bold", size: 16 }
        },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const [ini, fim] = ctx.raw.x;
              return `${formatarDataTabela(ini)} → ${formatarDataTabela(fim)}`;
            }
          }
        },
        datalabels: { display: false }
      },

      scales: {
        x: {
          type: "time",
          min: eixoMin,
          max: eixoMax,
          time: { unit: "hour", stepSize: 6 },
          ticks: {
            autoSkip: false,
            major: { enabled: true }
          },
          grid: {
            color: ctx => {
              const d = new Date(ctx.tick.value);
              return (d.getHours() === 0 && d.getMinutes() === 0)
                ? "rgba(0,0,0,0.45)"
                : "rgba(0,0,0,0.08)";
            }
          }
        },
y: {
  ticks: {
    font: { weight: "bold" },

    // 🔒 força fundo branco atrás do texto
    backdropColor: "#ffffff",
    backdropPadding: 4
  },

  grid: {
    drawOnChartArea: false // 👈 impede grid atrás dos rótulos
  }
}
      }
    }
  });
}

// =======================
// GRÁFICO DE DURAÇÃO
// =======================

let chartDuracao;

function montarGraficoDuracao(dados) {
  const acumulado = {};
  const emAndamento = {};
  const agora = new Date();

  dados.forEach(d => {
    if (!d.inicio) return;

    const ini = dataSemFuso(d.inicio);
    const fim = d.fim ? dataSemFuso(d.fim) : agora;
    const horas = (fim - ini) / 36e5;

    if (!acumulado[d.nome_etapa]) {
      acumulado[d.nome_etapa] = 0;
      emAndamento[d.nome_etapa] = false;
    }

    acumulado[d.nome_etapa] += horas;
    if (!d.fim) emAndamento[d.nome_etapa] = true;
  });

  const etapas = Object.keys(acumulado);
  const duracoes = etapas.map(e => Number(acumulado[e].toFixed(2)));
  const cores = etapas.map(e => emAndamento[e] ? "#f59e0b" : "#2563eb");

  if (chartDuracao) chartDuracao.destroy();

  chartDuracao = new Chart(document.getElementById("graficoDuracao"), {
    type: "bar",
    data: {
      labels: etapas,
      datasets: [{
        label: "Tempo Total por Etapa (h)",
        data: duracoes,
        backgroundColor: cores
      }]
    },
options: {
  indexAxis: "y",

  plugins: {
    title: {
      display: true,
      text: "Duração Total por Etapa",
      font: { weight: "bold", size: 16 }
    },

    // 🔹 LEGENDA (agora aparece)
    legend: {
      display: true,
      labels: {
        font: { weight: "bold" }
      }
    },

    datalabels: {
      formatter: v => `${v} h`,
      font: { weight: "bold" }
    }
  },

  scales: {
    // 🔹 EIXO X (HORAS)
    x: {
      title: {
        display: true,
        text: "Horas acumuladas",
        font: { weight: "bold" }
      },
      ticks: {
        font: { weight: "bold" }
      }
    },

    // 🔹 EIXO Y (ETAPAS)
    y: {
      title: {
        display: true,
        text: "Etapas",
        font: { weight: "bold" }
      },
      ticks: {
        font: { weight: "bold" }
      }
    }
  }
}
  });
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

// =======================
// QR CODE
// =======================

function gerarQRCode(codigo) {
  document.getElementById("qrcode").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    "https://testefabrica-roan.vercel.app/?codigo=" + codigo;
}

// =======================
// TEMPO TOTAL
// =======================

function mostrarTempoTotal(horas) {
  const dias = Math.floor(horas / 24);
  const resto = (horas % 24).toFixed(1);

  document.getElementById("tempoTotal").innerText =
    dias > 0
      ? `⏱ Tempo total da peça: ${dias}d ${resto}h`
      : `⏱ Tempo total da peça: ${horas.toFixed(1)}h`;
}







