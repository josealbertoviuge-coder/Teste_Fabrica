function abrirRelatorio(){

  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("codigo");

  if (!codigo) {
    alert("Nenhuma OP carregada.");
    return;
  }

  if (!tagAtual) {
    alert("Nenhuma TAG selecionada.");
    return;
  }

  const url =
    "/relatorio.html?codigo=" +
    encodeURIComponent(codigo) +
    "&tag=" +
    encodeURIComponent(tagAtual);

  window.open(url, "_blank");
}

// =======================
// LOADING BAR
// =======================

function iniciarLoading() {
  const bar = document.getElementById("loadingBar");
  if (!bar) return;

  bar.style.opacity = "1";
  bar.style.width = "15%";

  setTimeout(() => bar.style.width = "55%", 150);
  setTimeout(() => bar.style.width = "80%", 400);
}

function finalizarLoading() {
  const bar = document.getElementById("loadingBar");
  if (!bar) return;

  bar.style.width = "100%";

  setTimeout(() => {
    bar.style.opacity = "0";
    bar.style.width = "0%";
  }, 300);
}

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
// PLUGIN: PISCAR ETAPAS EM ANDAMENTO
// =======================

const piscarAndamentoPlugin = {
  id: "piscarAndamento",

  beforeDatasetsDraw(chart) {

    const now = Date.now();

    chart.data.datasets.forEach((dataset, datasetIndex) => {

      const meta = chart.getDatasetMeta(datasetIndex);

      meta.data.forEach((bar, i) => {

        const raw = dataset.data[i];

        if (raw.backgroundColor !== "#f59e0b") return;

        const pulse = 0.65 + Math.sin(now / 300) * 0.25;

        bar.options.backgroundColor = `rgba(245,158,11,${pulse})`;

      });

    });

  }
};

Chart.register(ChartDataLabels);
Chart.register(turnoNoturnoPlugin);
Chart.register(piscarAndamentoPlugin);

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

async function buscar(codigoManual = null) {

  let codigo = codigoManual;

  if (!codigo) {
    const params = new URLSearchParams(window.location.search);
    codigo = params.get("codigo");
  }

  if (!codigo) return;

  iniciarLoading();

  try {

    const qr = document.getElementById("qrcode");
    if (qr) {
      qr.src =
        "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
        window.location.origin +
        "/?codigo=" + encodeURIComponent(codigo);
    }

    const res = await fetch("https://teste-fabrica.onrender.com/op/" + encodeURIComponent(codigo));

    if (!res.ok) throw new Error("Erro ao buscar dados");

    const resposta = await res.json();

    dadosOP = resposta.tags || {};

    document.getElementById("linhaInfo").innerText =
      `OP: ${resposta.op} | Cliente / Client: ${resposta.cliente_nome}`;

    montarAbasTags();

  } catch (erro) {
    console.error("Erro:", erro);
    alert("Erro ao carregar dados da OP.");
  } finally {
    finalizarLoading();
  }
}


window.buscar = buscar;

// =======================
// ABAS DE TAGS
// =======================

function montarAbasTags() {
  const container = document.getElementById("abasTags");
  container.innerHTML = "";

  const conteudo = document.getElementById("conteudo-componente");

  let primeira = true;

  Object.keys(dadosOP).forEach(tag => {

    const btn = document.createElement("button");
    btn.className = "aba-tag";
    btn.innerText = tag;

    if (primeira) {
      btn.classList.add("ativa");
      carregarTag(tag);
      primeira = false;
    }

    btn.onclick = () => {

      if (btn.classList.contains("ativa")) return;

      document
        .querySelectorAll(".aba-tag")
        .forEach(b => b.classList.remove("ativa"));

      btn.classList.add("ativa");

      // animação suave
      conteudo.classList.add("is-hiding");

      requestAnimationFrame(() => {
        setTimeout(() => {
          carregarTag(tag);
          conteudo.classList.remove("is-hiding");
        }, 180);
      });
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

  const conteudo = document.getElementById("conteudo-componente");

  const ordemDesejada = [
    "Flange A",
    "Flange B",
    "Tambor",
    "Berco de Apoio",
    "Conjunto Montado"
  ];

  let primeiraAba = true;

  function criarAba(nome) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "aba-componente";
    btn.innerText = nome;

    // primeira aba abre sem animação
    if (primeiraAba) {
      btn.classList.add("ativa");
      carregarComponente(nome);
      primeiraAba = false;
    }

    btn.onclick = () => {

      if (btn.classList.contains("ativa")) return;

      document
        .querySelectorAll(".aba-componente")
        .forEach(b => b.classList.remove("ativa"));

      btn.classList.add("ativa");

      // animação
      conteudo.classList.add("is-hiding");

      requestAnimationFrame(() => {
        setTimeout(() => {

          carregarComponente(nome);

          conteudo.classList.remove("is-hiding");

        }, 180);
      });
    };

    container.appendChild(btn);
  }

  // ordem desejada
  ordemDesejada.forEach(nome => {
    if (componentes[nome]) criarAba(nome);
  });

  // restantes
  Object.keys(componentes).forEach(nome => {
    if (!ordemDesejada.includes(nome)) criarAba(nome);
  });
}

// =======================
// CARREGAR COMPONENTE
// =======================

function carregarComponente(nome) {
  const dados = componentesCache[nome];
  if (!dados || !dados.length) return;

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

  minData.setHours(0, 0, 0, 0);
  maxData.setHours(23, 59, 59, 999);

  // =======================
  // TAMANHO HORIZONTAL (SCROLL)
  // =======================
  const larguraPorDia = 120; // px
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

  const alturaPorEtapa = 65;
  const alturaMinima = 280;

  const alturaCanvas = labels.length * alturaPorEtapa;
  canvas.height = Math.max(alturaCanvas, alturaMinima);

  // =======================
// AJUSTE DA JANELA VISÍVEL
// =======================

const wrapper = canvas.parentElement;

const alturaMaxViewport = 800;   // limite visual agradável
const paddingVisual = 40;        // respiro interno

const alturaViewport = Math.min(
  canvas.height + paddingVisual,
  alturaMaxViewport
);

wrapper.style.height = `${alturaViewport}px`;

  // =======================
  // DATASET
  // =======================

  const data = [];
  const cores = [];

  // agrupa lançamentos por etapa
  const etapas = {};

  dados.forEach(d => {
    if (!d.inicio) return;

    if (!etapas[d.nome_etapa]) {
      etapas[d.nome_etapa] = [];
    }

    etapas[d.nome_etapa].push(d);
  });

Object.values(etapas).forEach(lista => {

  lista.sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  // ⭐ status REAL da etapa = último registro
  const ultimo = lista[lista.length - 1];
  const etapaConcluida =
    (ultimo.status || "").toLowerCase().includes("concl");

  lista.forEach(item => {

    if (!item.inicio) return;

    const inicio = dataSemFuso(item.inicio);
    const fim = item.fim
      ? dataSemFuso(item.fim)
      : inicio;

    data.push({
      x: [inicio, fim],
      y: item.nome_etapa,

      // ⭐ TODOS blocos seguem status da etapa
      backgroundColor: etapaConcluida
        ? "#2563eb"   // concluída
        : "#f59e0b"   // andamento
    });

  });

});


  function gerarTicks6h(inicio, fim) {
  const ticks = [];
  const cursor = new Date(inicio);

  // alinha para a hora cheia mais próxima
  cursor.setMinutes(0, 0, 0);

  // ajusta para múltiplo de 6
  cursor.setHours(Math.floor(cursor.getHours() / 6) * 6);

  while (cursor <= fim) {
    ticks.push(new Date(cursor));
    cursor.setHours(cursor.getHours() + 6);
  }

  return ticks;
}

const ticks6h = gerarTicks6h(minData, maxData);
  
  chartGantt = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Linha do Tempo / Timeline",
        data,
        backgroundColor: ctx => ctx.raw.backgroundColor,
        borderRadius: 5,
        barThickness: 16
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
        piscarAndamento: true,
        title: {
          display: true,
          text: "Linha do Tempo de Fabricação / Manufacturing Timeline",
          font: { weight: "bold", size: 16 }
        },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const [ini, fim] = ctx.raw.x;
              return `${formatarData(ini)} → ${formatarData(fim)}`;
            }
          }
        },
        datalabels: { display: false }
      },

      scales: {
x: {
  type: "time",
  min: minData,
  max: maxData,

  time: {
    unit: "hour",
    stepSize: 3   // 🔒 base horária estável
  },
afterBuildTicks: scale => {
  scale.ticks = ticks6h
    .filter(d => d >= scale.min && d <= scale.max)
    .map(d => ({ value: d }));
},

ticks: {
  autoSkip: false,
  font: { weight: "bold" },

  callback: (value, index, ticks) => {
    const d = new Date(ticks[index].value);

    if (isNaN(d)) return "";

    // meia-noite → data
    if (d.getHours() === 0) {
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short"
      });
    }

    // a cada 6h → hora
    if (d.getHours() % 6 === 0) {
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    // 3h sem label (linha existe)
    return "";
  }
},

grid: {
  drawTicks: true,

  color: ctx => {
    const d = new Date(ctx.tick.value);

    // dia
    if (d.getHours() === 0) return "rgba(0,0,0,0.35)";

    // 6h
    if (d.getHours() % 6 === 0) return "rgba(0,0,0,0.18)";

    // 3h (⚠️ nunca zero)
    if (d.getHours() % 3 === 0) return "rgba(0,0,0,0.08)";

    return "rgba(0,0,0,0.08)";
  },

  lineWidth: ctx => {
    const d = new Date(ctx.tick.value);
    if (d.getHours() === 0) return 2;
    if (d.getHours() % 6 === 0) return 1;
    return 0.6; // 🔒 nunca 0
  }
},

  title: {
    display: true,
    text: "Tempo / Time",
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
    drawOnChartArea: true,
    drawTicks: false,

    color: "rgba(0,0,0,0.15)",
    lineWidth: 1
  },

  title: {
    display: true,
    text: "Etapas / Steps",
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
  const statusEtapa = {};

  // agrupa lançamentos por etapa
  const etapasAgrupadas = {};

  dados.forEach(d => {
    if (!d.inicio) return;

    if (!etapasAgrupadas[d.nome_etapa]) {
      etapasAgrupadas[d.nome_etapa] = [];
    }

    etapasAgrupadas[d.nome_etapa].push(d);
  });

  // calcula duração e status final
  Object.entries(etapasAgrupadas).forEach(([etapa, lista]) => {

    // ordena por início
    lista.sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

    const ultimo = lista[lista.length - 1];

    let totalHoras = 0;

    lista.forEach(d => {
      const ini = dataSemFuso(d.inicio);
      const fim = d.fim
        ? dataSemFuso(d.fim)
        : ini;

      totalHoras += (fim - ini) / 36e5;
    });

    acumulado[etapa] = Number(totalHoras.toFixed(2));

    const statusUltimo = (ultimo.status || "").toLowerCase();
statusEtapa[etapa] = !statusUltimo.includes("concl");
  });

  const etapas = Object.keys(acumulado);
  const duracoes = etapas.map(e => acumulado[e]);

const cores = etapas.map(e =>
  statusEtapa[e] ? "#f59e0b" : "#2563eb"
);

  if (chartDuracao) chartDuracao.destroy();

  const canvasDuracao = document.getElementById("graficoDuracao");

  const alturaPorEtapa = 25;
  const alturaMinima = 180;
  const alturaMaxima = 800;

  const alturaCalculada =
    etapas.length * alturaPorEtapa;

  canvasDuracao.height = Math.min(
    Math.max(alturaCalculada, alturaMinima),
    alturaMaxima
  );
  
  chartDuracao = new Chart(canvasDuracao, {
    type: "bar",
    data: {
      labels: etapas,
datasets: [{
  label: "Tempo Total da Etapa / Total Step Time (h)",
  data: duracoes,

  backgroundColor: ctx => {

    const i = ctx.dataIndex;
    const etapa = etapas[i];

    const emAndamento = statusEtapa[etapa];

    if (!emAndamento) return "#2563eb";

    const pulse = 0.65 + Math.sin(Date.now() / 300) * 0.25;

    return `rgba(245,158,11,${pulse})`;
  }

}]
    },
    options: {
      indexAxis: "y",

      plugins: {
        piscarAndamento: true,
        title: {
          display: true,
          text: "Duração Total por Etapa / Total Time by Step",
          font: { weight: "bold", size: 16 }
        },

        legend: {
          display: false,
          labels: {
            font: { weight: "bold" }
          }
        },

datalabels: {
  color: ctx => {

    const i = ctx.dataIndex;
    const etapa = etapas[i];

    const emAndamento = statusEtapa[etapa];

    if (!emAndamento) {
      return "#facc15";   // amarelo para concluídas
    }

    return "#000";        // preto para andamento
  },

  formatter: v => `${v} h`,
  font: { weight: "bold" }
}
      },

      scales: {
        x: {
          title: {
            display: true,
            text: "Horas acumuladas / Cumulated Hours",
            font: { weight: "bold" }
          },
          ticks: {
            font: { weight: "bold" }
          }
        },

        y: {
          categoryPercentage: 0.6,
          barPercentage: 0.85,
          title: {
            display: true,
            text: "Etapas / Steps",
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
  buscar(); // busca automaticamente via URL
});

setInterval(() => {
  if (chartGantt) chartGantt.update();
  if (chartDuracao) chartDuracao.update();
}, 300);





