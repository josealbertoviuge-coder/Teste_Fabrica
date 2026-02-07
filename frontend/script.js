
const turnoNoturnoPlugin = {
  id: "turnoNoturno",

  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;

    if (!xScale) return;

    const inicio = xScale.min;
    const fim = xScale.max;

    let cursor = new Date(inicio);
    cursor.setHours(19, 0, 0, 0);

    // garante que começa antes do range visível
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
// FORMATADOR PADRÃO (TABELA + TOOLTIP)
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
// GRÁFICO GANTT
// =======================
let chartGantt;

function montarGraficoGantt(dados) {

  if (chartGantt) chartGantt.destroy();

  const agora = new Date();

  const datas = dados
    .flatMap(d => [
      d.inicio ? dataSemFuso(d.inicio) : null,
      d.fim ? dataSemFuso(d.fim) : agora
    ])
    .filter(Boolean);

  if (!datas.length) return;

  const minData = new Date(Math.min(...datas));
  const maxData = new Date(Math.max(...datas));
  const margem = (maxData - minData) * 0.05;

  const eixoMin = new Date(minData.getTime() - margem);
  const eixoMax = new Date(maxData.getTime() + margem);

  const labels = [];
  const data = [];
  const cores = [];

  dados.forEach(d => {
    if (!d.inicio) return;

    const inicio = dataSemFuso(d.inicio);
    const fim = d.fim
      ? dataSemFuso(d.fim)
      : dataSemFuso(new Date().toISOString());

    labels.push(d.nome_etapa);
    data.push([inicio, fim]);
    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  chartGantt = new Chart(
    document.getElementById("grafico"),
    {
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
        indexAxis: "y",
        plugins: {
          title: {
            display: true,
            text: "Timeline de Execução da Peça",
            font: { weight: "bold", size: 16 }
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const [inicio, fim] = ctx.raw;
                return `${formatarDataTabela(inicio)} → ${formatarDataTabela(fim)}`;
              }
            }
          },
          datalabels: {
            display: false
          }
        },
scales: {
  // ======================
  // EIXO X INFERIOR (HORAS)
  // ======================
  x: {
    type: "time",
    position: "bottom",
    min: eixoMin,
    max: eixoMax,
    time: {
      unit: "hour",
      displayFormats: {
        hour: "HH:mm"
      }
    },
    ticks: {
      autoSkip: true,
      font: { weight: "bold" }
    },
    grid: {
      color: ctx => {
        const date = new Date(ctx.tick.value);

        if (
          (date.getHours() === 7 && date.getMinutes() === 0) ||
          (date.getHours() === 19 && date.getMinutes() === 0)
        ) {
          return "rgba(0,0,0,0.45)";
        }
        return "rgba(0,0,0,0.08)";
      },
      lineWidth: ctx => {
        const date = new Date(ctx.tick.value);
        return (
          (date.getHours() === 7 && date.getMinutes() === 0) ||
          (date.getHours() === 19 && date.getMinutes() === 0)
        )
          ? 2
          : 0.5;
      }
    },
    title: {
      display: true,
      text: "Horas",
      font: { weight: "bold" }
    }
  },

  // ======================
  // EIXO X SUPERIOR (DIAS)
  // ======================
  xDias: {
    type: "time",
    position: "top",
    min: eixoMin,
    max: eixoMax,
    time: {
      unit: "day",
      displayFormats: {
        day: "dd/MM"
      }
    },
    ticks: {
      font: { weight: "bold" }
    },
    grid: {
      drawOnChartArea: false // 👈 NÃO desenha linhas verticais
    },
    title: {
      display: true,
      text: "Dias",
      font: { weight: "bold" }
    }
  },

  // ======================
  // EIXO Y
  // ======================
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
    }
  );
}

// =======================
// GRÁFICO DE DURAÇÃO
// =======================
let chartDuracao;

function montarGraficoDuracao(dados) {

  const etapas = [];
  const duracoes = [];
  const cores = [];

  let tempoTotalHoras = 0;

  dados.forEach(d => {
    if (!d.inicio) return;

    const inicio = dataSemFuso(d.inicio);
    const fim = d.fim ? dataSemFuso(d.fim) : new Date();

    const horas = (fim - inicio) / (1000 * 60 * 60);
    const valor = Number(horas.toFixed(2));

    etapas.push(d.nome_etapa);
    duracoes.push(valor);
    tempoTotalHoras += valor;

    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  if (!duracoes.length) return;

  mostrarTempoTotal(tempoTotalHoras);

  const maxEixo = Math.max(...duracoes) * 1.1;

  if (chartDuracao) chartDuracao.destroy();

  chartDuracao = new Chart(
    document.getElementById("graficoDuracao"),
    {
      type: "bar",
      data: {
        labels: etapas,
        datasets: [{
          label: "Duração por Etapa (h)",
          data: duracoes,
          backgroundColor: cores
        }]
      },
      options: {
        indexAxis: "y",
        plugins: {
          title: {
            display: true,
            text: "Duração do Processo",
            font: { weight: "bold", size: 16 }
          },
          legend: {
            labels: {
              font: { weight: "bold", size: 13 }
            }
          },
          datalabels: {
            color: "#000",
            formatter: v => `${v} h`,
            font: { weight: "bold" }
          }
        },
        scales: {
          x: {
            min: 0,
            max: maxEixo,
            title: {
              display: true,
              text: "Duração (horas)",
              font: { weight: "bold" }
            },
            ticks: {
              font: { weight: "bold" }
            }
          },
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



