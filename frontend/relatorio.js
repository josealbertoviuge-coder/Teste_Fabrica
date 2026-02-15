// ============================
// LINHAS VERTICAIS 12H (GARANTIDAS)
// ============================

const linhas12hPlugin = {
  id: "linhas12h",

  afterDatasetsDraw(chart) {

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    let cursor = new Date(xScale.min);
    const fim = new Date(xScale.max);

    cursor.setMinutes(0,0,0);
    cursor.setHours(Math.floor(cursor.getHours()/12)*12);

    ctx.save();

    while (cursor <= fim) {

      const rawX = xScale.getPixelForValue(cursor);

      if (rawX >= chartArea.left && rawX <= chartArea.right) {

        const x = Math.round(rawX) + 0.5;
        const hora = cursor.getHours();

        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);

        if (hora === 12) {
          ctx.strokeStyle = "rgba(0,0,0,0.30)";
          ctx.lineWidth = 1.3;
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.08)";
          ctx.lineWidth = 0.6;
        }

        ctx.stroke();

        if (hora === 12) {
          ctx.fillStyle = "#000";
          ctx.font = "bold 10px Arial";
          ctx.textAlign = "center";
          ctx.fillText("12:00", x, chartArea.bottom + 14);
        }
      }

      cursor.setHours(cursor.getHours() + 12);
    }

    ctx.restore();
  }
};

Chart.register(linhas12hPlugin);


// ============================
// TURNO NOTURNO (19h → 07h)
// ============================

const turnoNoturnoPlugin = {
  id: "turnoNoturno",

  beforeDatasetsDraw(chart) {

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    const inicio = xScale.min;
    const fim = xScale.max;

    let cursor = new Date(inicio);
    cursor.setHours(19,0,0,0);

    if (cursor < inicio) cursor.setDate(cursor.getDate() + 1);

    ctx.save();
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";

    while (cursor < fim) {

      const inicioTurno = new Date(cursor);
      const fimTurno = new Date(cursor);
      fimTurno.setDate(fimTurno.getDate() + 1);
      fimTurno.setHours(7,0,0,0);

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

Chart.register(turnoNoturnoPlugin);


function dataBR() {
  return new Date().toLocaleString("pt-BR");
}

window.addEventListener("load", carregarRelatorio);


// ==============================
// CARREGAR RELATÓRIO
// ==============================

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

  let tagAtiva = "—";

  for (const [nomeTag, etapas] of Object.entries(dados.tags)) {
    const lista = Object.values(etapas).flat();
    if (lista.some(e => (e.status || "").toLowerCase().includes("andamento"))) {
      tagAtiva = nomeTag;
      break;
    }
  }

  const tagUsada = tagSelecionada || tagAtiva;
  const componentes = dados.tags[tagUsada];

  document.getElementById("infoOP").innerHTML =
    `<strong>OP:</strong> ${dados.op} &nbsp;&nbsp;
     <strong>Cliente / Client:</strong> ${dados.cliente_nome} &nbsp;&nbsp;
     <strong>TAG:</strong> ${tagUsada}`;

  document.getElementById("dataRelatorio").innerHTML =
    `<strong>Data:</strong> ${dataBR()}`;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

  montarSecoesComponentes(componentes);
}


// ==============================
// SEÇÕES POR COMPONENTE
// ==============================

function montarSecoesComponentes(componentes) {

  const container = document.getElementById("componentesRelatorio");
  container.innerHTML = "";

  Object.entries(componentes).forEach(([nomeComp, etapas], i) => {

    const bloco = document.createElement("section");
    bloco.className = "componente-bloco";

    bloco.innerHTML = `
      <h2>${nomeComp}</h2>
      <table id="tabela_${i}"></table>
      <canvas id="gantt_${i}"></canvas>
      <canvas id="duracao_${i}"></canvas>
    `;

    container.appendChild(bloco);

    montarTabela(etapas, `tabela_${i}`);
    montarGantt(etapas, `gantt_${i}`);
    montarDuracao(etapas, `duracao_${i}`);
  });
}


// ==============================
// TABELA
// ==============================

function montarTabela(etapas, id){

  let html = `
    <tr>
      <th>Etapa</th>
      <th>Status</th>
      <th>Início</th>
      <th>Fim</th>
    </tr>
  `;

  etapas.forEach(e => {
    html += `
      <tr>
        <td>${e.nome_etapa}</td>
        <td>${e.status}</td>
        <td>${e.inicio || "-"}</td>
        <td>${e.fim || "-"}</td>
      </tr>
    `;
  });

  document.getElementById(id).innerHTML = html;
}


// ==============================
// GANTT
// ==============================

const ganttCharts = {};

function montarGantt(etapas, canvasId){

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (ganttCharts[canvasId]) {
    ganttCharts[canvasId].destroy();
    delete ganttCharts[canvasId];
  }

  const agora = new Date();
  const labels = [];
  const dados = {};

  etapas.forEach(e=>{
    if(!e.inicio) return;

    if(!dados[e.nome_etapa]){
      dados[e.nome_etapa]=[];
      labels.push(e.nome_etapa);
    }

    const ini = new Date(e.inicio);
    const fim = e.fim ? new Date(e.fim) : agora;

    dados[e.nome_etapa].push({
      x:[ini,fim],
      y:e.nome_etapa
    });
  });

  const dataset = Object.values(dados).flat();

  if(!dataset.length) return;

  const datas = dataset.flatMap(d=>d.x);

  const minDate = new Date(Math.min(...datas));
  const maxDate = new Date(Math.max(...datas));

  minDate.setMinutes(0,0,0);
  minDate.setHours(Math.floor(minDate.getHours()/12)*12);

  maxDate.setMinutes(0,0,0);
  maxDate.setHours(Math.ceil(maxDate.getHours()/12)*12);

  canvas.height = Math.max(labels.length * 55, 280);

  ganttCharts[canvasId] = new Chart(canvas,{
    type:"bar",
    data:{
      labels,
      datasets:[{
        data:dataset,
        borderRadius:5,
        barThickness:16
      }]
    },
    options:{
      responsive:false,
      indexAxis:"y",

      plugins:{
        turnoNoturno:true,
        legend:{display:false}
      },

      scales:{
        x:{
          type:"time",
          min:minDate,
          max:maxDate,
          ticks:{ display:false },
          grid:{ display:false }
        },
        y:{
          ticks:{ font:{weight:"bold"} }
        }
      }
    }
  });
}


// ==============================
// GRÁFICO DE DURAÇÃO
// ==============================

const durCharts = {};

function montarDuracao(etapas, canvasId){

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const total = {};

  etapas.forEach(e=>{
    if(!e.inicio || !e.fim) return;

    const ini = new Date(e.inicio);
    const fim = new Date(e.fim);

    total[e.nome_etapa] = (total[e.nome_etapa] || 0) + (fim-ini)/36e5;
  });

  const labels = Object.keys(total);
  const valores = Object.values(total);

  if(!labels.length) return;

  canvas.height = Math.max(labels.length * 30, 180);

  durCharts[canvasId] = new Chart(canvas,{
    type:"bar",
    data:{
      labels,
      datasets:[{ data:valores }]
    },
    options:{
      indexAxis:"y",
      plugins:{ legend:{display:false} }
    }
  });
}
