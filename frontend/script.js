// =======================
// PLUGIN: TURNO NOTURNO
// =======================

const turnoNoturnoPlugin = {
  id: "turnoNoturno",

  beforeDatasetsDraw(chart) {
    if (chart.options.plugins?.turnoNoturno?.enabled === false) {
    return;
  }
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

    // 🔒 CLIP EXATO: SOMENTE ÁREA DO GRÁFICO (SEM EIXO Y)
    ctx.beginPath();
    ctx.rect(
      chartArea.left,        // 👈 começa DEPOIS dos rótulos
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

let componentesCache = {};
let componenteAtual = null;

function montarAbasComponentes(componentes) {
  const container = document.getElementById("abasComponentes");
  container.innerHTML = "";

  Object.keys(componentes).forEach((nome, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerText = nome;
    btn.className = "aba-componente";

    if (index === 0) {
      btn.classList.add("ativa");
      componenteAtual = nome;
    }

    btn.onclick = () => {
      document
        .querySelectorAll(".aba-componente")
        .forEach(b => b.classList.remove("ativa"));

      btn.classList.add("ativa");
      componenteAtual = nome;

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

  document.getElementById("titulo").innerText =
    "Tracking de Fabricação - Equipamentos";

  gerarQRCode(codigo);

  const res = await fetch(
    "https://teste-fabrica.onrender.com/tag/" + codigo
  );

  const resposta = await res.json();

  const { tag, op, cliente_nome, componentes } = resposta;

  componentesCache = componentes;

  // Linha de identificação
  document.getElementById("linhaInfo").innerText =
    `TAG: ${tag}` +
    (op ? ` | OP: ${op}` : "") +
    (cliente_nome ? ` | Cliente: ${cliente_nome}` : "");

  // 🔹 cria abas
  montarAbasComponentes(componentes);

  // 🔹 carrega o primeiro componente
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
  const maxData = new Date(Math.max(...datas));

  // =======================
  // TAMANHO HORIZONTAL (SCROLL)
  // =======================
  const larguraPorDia = 220; // px
  const diasVisiveis = 14;

  const diasTotais =
    (maxData - minData) / (1000 * 60 * 60 * 24);

  canvas.width = Math.max(
    diasTotais * larguraPorDia,
    diasVisiveis * larguraPorDia
  );

  // =======================
  // JANELA VISÍVEL
  // =======================
  const janelaInicialFim = new Date(minData);
  janelaInicialFim.setDate(janelaInicialFim.getDate() + diasVisiveis);

  // =======================
  // ETAPAS ÚNICAS (1 LINHA)
  // =======================

  const labels = [...new Set(dados.map(d => d.nome_etapa))];

  // =======================
  // AJUSTE DE ALTURA (SCROLL)
  // =======================

  const alturaPorEtapa = 100;
  const alturaMinima = 350;

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
        barThickness: 20
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
          text: "Timeline de Execução do Equipamento",
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
  min: minData,        // 🔒 limite real inferior
  max: maxData,        // 🔒 limite real superior
  // 🔓 permite navegar por TODOS os dados
  suggestedMin: minData,
  suggestedMax: janelaInicialFim,

  time: {
    unit: "hour",
    stepSize: 6
  },

  ticks: {
    autoSkip: false,
    major: { enabled: true },

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
    }
  },

  title: {
    display: true,
    text: "Tempo",
    font: { weight: "bold" }
  }
},
y: {
  ticks: {
    font: { weight: "bold" },

    // mantém fundo branco atrás do texto
    backdropColor: "#ffffff",
    backdropPadding: 4
  },

  grid: {
    drawOnChartArea: true,   // ✅ desenha linhas horizontais
    drawTicks: false,

    color: "rgba(0,0,0,0.15)", // cinza suave
    lineWidth: 1
  },

  title: {
    display: true,
    text: "Etapas",
    font: { weight: "bold" }
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
        label: "Tempo Total por Etapa de Fabricação do Equipamento (h)",
        data: duracoes,
        backgroundColor: cores,
        barThickness: 100
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

    // 🔹 LEGENDA
    legend: {
      display: false,
      labels: {
        font: { weight: "bold" }
      }
    },

    datalabels: {
      color: "#000", 
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
      categoryPercentage: 0.7, // ↓ espaço da categoria
      barPercentage: 0.9,      // ↓ ocupação da barra
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

















