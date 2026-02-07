// =======================
// PLUGIN — TURNO NOTURNO (19:00 → 07:00)
// =======================

const turnoNoturnoPlugin = {
  id: "turnoNoturno",

  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    const inicioVisivel = new Date(xScale.min);
    const fimVisivel = new Date(xScale.max);

    // normaliza para 19h
    const cursor = new Date(inicioVisivel);
    cursor.setHours(19, 0, 0, 0);
    if (cursor > inicioVisivel) cursor.setDate(cursor.getDate() - 1);

    ctx.save();
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";

    while (cursor < fimVisivel) {
      const ini = new Date(cursor);
      const fim = new Date(cursor);
      fim.setDate(fim.getDate() + 1);
      fim.setHours(7, 0, 0, 0);

      const xIni = xScale.getPixelForValue(ini);
      const xFim = xScale.getPixelForValue(fim);

      ctx.fillRect(
        xIni,
        chartArea.top,
        xFim - xIni,
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
// DATA SEM FUSO (IGUAL AO SUPABASE)
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
// GRÁFICO GANTT (AGRUPADO + SCROLL)
// =======================

let chartGantt;

function montarGraficoGantt(dados) {

  if (chartGantt) chartGantt.destroy();

  const agora = new Date();

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

  // =======================
  // JANELA FIXA DE 7 DIAS
  // =======================

  const eixoMin = new Date(minData);
  const eixoMax = new Date(minData);
  eixoMax.setDate(eixoMax.getDate() + 7);

  // =======================
  // ETAPAS ÚNICAS
  // =======================

  const labels = [...new Set(dados.map(d => d.nome_etapa))];

  // =======================
  // DATASET MULTI-PERÍODOS
  // =======================

  const data = [];
  const cores = [];

  dados.forEach(d => {
    if (!d.inicio) return;

    const ini = dataSemFuso(d.inicio);
    const fim = d.fim ? dataSemFuso(d.fim) : agora;

    data.push({
      x: [ini, fim],
      y: d.nome_etapa
    });

    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  // =======================
  // CHART
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
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",

        plugins: {
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

            time: {
              unit: "hour",
              stepSize: 6
            },

            ticks: {
              autoSkip: false,
              callback: value => {
                const d = new Date(value);
                if (d.getHours() === 0 && d.getMinutes() === 0) {
                  return d.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short"
                  });
                }
                return d.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit"
                });
              }
            },

            grid: {
              color: ctx => {
                const d = new Date(ctx.tick.value);
                return (d.getHours() === 0 && d.getMinutes() === 0)
                  ? "rgba(0,0,0,0.45)"
                  : "rgba(0,0,0,0.08)";
              },
              lineWidth: ctx => {
                const d = new Date(ctx.tick.value);
                return (d.getHours() === 0 && d.getMinutes() === 0) ? 2 : 0.5;
              }
            },

            title: {
              display: true,
              text: "Tempo",
              font: { weight: "bold" }
            }
          },

          y: {
            ticks: { font: { weight: "bold" } },
            title: {
              display: true,
              text: "Etapas",
              font: { weight: "bold" }
            }
          }
        }
      }
    }
  );
}

// =======================
// GRÁFICO DE DURAÇÃO (SOMA POR ETAPA)
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
    const horas = (fim - ini) / (1000 * 60 * 60);

    if (!acumulado[d.nome_etapa]) {
      acumulado[d.nome_etapa] = 0;
      emAndamento[d.nome_etapa] = false;
    }

    acumulado[d.nome_etapa] += horas;
    if (!d.fim) emAndamento[d.nome_etapa] = true;
  });

  const etapas = Object.keys(acumulado);
  if (!etapas.length) return;

  const duracoes = etapas.map(e =>
    Number(acumulado[e].toFixed(2))
  );

  const cores = etapas.map(e =>
    emAndamento[e] ? "#f59e0b" : "#2563eb"
  );

  mostrarTempoTotal(duracoes.reduce((a, b) => a + b, 0));

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
            text: "Duração Total por Etapa",
            font: { weight: "bold", size: 16 }
          },
          legend: { display: false },
          datalabels: {
            color: "#000",
            formatter: v => `${v} h`,
            font: { weight: "bold" }
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
