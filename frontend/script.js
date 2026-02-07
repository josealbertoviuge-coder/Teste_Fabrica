
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
// GRÁFICO GANTT (AGRUPADO POR ETAPA)
// =======================

let chartGantt;

function montarGraficoGantt(dados) {

  // 🔁 Destroi o gráfico anterior (evita sobreposição)
  if (chartGantt) chartGantt.destroy();

  const agora = new Date();

  // =======================
  // CÁLCULO DO RANGE DO EIXO X
  // =======================

  const datas = dados
    .flatMap(d => [
      d.inicio ? dataSemFuso(d.inicio) : null,
      d.fim ? dataSemFuso(d.fim) : agora
    ])
    .filter(Boolean);

  if (!datas.length) return;

  const minData = new Date(Math.min(...datas));
  const maxData = new Date(Math.max(...datas));

  // margem visual (5%)
  const margem = (maxData - minData) * 0.05;

  const eixoMin = new Date(minData.getTime() - margem);
  const eixoMax = new Date(maxData.getTime() + margem);

  // =======================
  // LABELS ÚNICAS (1 LINHA POR ETAPA)
  // =======================

  const labels = [...new Set(dados.map(d => d.nome_etapa))];

  // =======================
  // DATASET COM MÚLTIPLOS PERÍODOS
  // =======================

  const data = [];
  const cores = [];

  dados.forEach(d => {

    if (!d.inicio) return;

    const inicio = dataSemFuso(d.inicio);
    const fim = d.fim
      ? dataSemFuso(d.fim)
      : dataSemFuso(new Date().toISOString());

    // 👉 Cada período vira uma barra,
    // mas aponta para a MESMA etapa (y)
    data.push({
      x: [inicio, fim],
      y: d.nome_etapa
    });

    // 🔵 concluída | 🟠 em andamento
    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  // =======================
  // CRIAÇÃO DO CHART
  // =======================

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

        // Gantt horizontal
        indexAxis: "y",

        // =======================
        // PLUGINS
        // =======================
        plugins: {

          // Título
          title: {
            display: true,
            text: "Timeline de Execução da Peça",
            font: { weight: "bold", size: 16 }
          },

          // Remove legenda (não necessária)
          legend: {
            display: false
          },

          // Tooltip com o MESMO formato da tabela
          tooltip: {
            callbacks: {
              label: ctx => {
                const [ini, fim] = ctx.raw.x;
                return `${formatarDataTabela(ini)} → ${formatarDataTabela(fim)}`;
              }
            }
          },

          // Sem labels sobre as barras
          datalabels: {
            display: false
          }
        },

        // =======================
        // EIXOS
        // =======================
        scales: {

          // -----------------------
          // EIXO X (HORAS)
          // -----------------------
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
              major: { enabled: true },
              font: ctx => ({
                weight: ctx.tick && ctx.tick.major ? "bold" : "normal"
              })
            },

            title: {
              display: true,
              text: "Horas",
              font: { weight: "bold" }
            }
          },

          // -----------------------
          // EIXO Y (ETAPAS)
          // -----------------------
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
// GRÁFICO DE DURAÇÃO (TOTAL POR ETAPA)
// =======================

let chartDuracao;

function montarGraficoDuracao(dados) {

  const acumuladoPorEtapa = {};
  const agora = new Date();

  // =======================
  // AGREGA TODOS OS PERÍODOS
  // =======================

  dados.forEach(d => {

    if (!d.inicio) return;

    const inicio = dataSemFuso(d.inicio);
    const fim = d.fim
      ? dataSemFuso(d.fim)
      : agora; // 🟠 em andamento

    const horas = (fim - inicio) / (1000 * 60 * 60);

    if (!acumuladoPorEtapa[d.nome_etapa]) {
      acumuladoPorEtapa[d.nome_etapa] = 0;
    }

    acumuladoPorEtapa[d.nome_etapa] += horas;
  });

  const etapas = Object.keys(acumuladoPorEtapa);
  if (!etapas.length) return;

  const duracoes = etapas.map(e =>
    Number(acumuladoPorEtapa[e].toFixed(2))
  );

  // =======================
  // TEMPO TOTAL DA PEÇA
  // =======================

  const tempoTotalHoras = duracoes.reduce((a, b) => a + b, 0);
  mostrarTempoTotal(tempoTotalHoras);

  // =======================
  // CORES (NEUTRAS / AZUL)
  // =======================

  const cores = etapas.map(() => "#2563eb");

  // =======================
  // GRÁFICO
  // =======================

  const maxEixo = Math.max(...duracoes) * 1.1;

  if (chartDuracao) chartDuracao.destroy();

  chartDuracao = new Chart(
    document.getElementById("graficoDuracao"),
    {
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
            text: "Duração Total por Etapa (Concluído + Em Andamento)",
            font: { weight: "bold", size: 16 }
          },
          legend: {
            display: false
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
              text: "Horas acumuladas",
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








