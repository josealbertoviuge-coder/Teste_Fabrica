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

    if (cursor > inicio) cursor.setDate(cursor.getDate() - 1);

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

//
// =======================================================
// GERADOR DE TICKS (3h / 6h / dia)
// =======================================================
//

function gerarTicksTempo(inicio, fim) {

  const ticks = [];
  const cursor = new Date(inicio);

  cursor.setMinutes(0,0,0);
  cursor.setHours(Math.floor(cursor.getHours()/3)*3);

  while(cursor <= fim){
    ticks.push(new Date(cursor));
    cursor.setHours(cursor.getHours()+3);
  }

  return ticks;
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

  // TAG ATIVA
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

  // CABEÇALHO
  document.getElementById("infoOP").innerHTML =
    `<strong>OP:</strong> ${dados.op} &nbsp;&nbsp;
     <strong>Cliente / Client:</strong> ${dados.cliente_nome} &nbsp;&nbsp;
     <strong>TAG:</strong> ${tagUsada}`;

  document.getElementById("dataRelatorio").innerHTML =
    `<strong>Data de Emissão / Issued Date:</strong> ${dataBR()}`;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

  // STATUS FINAL GERAL
  const todasEtapas = Object.values(componentes).flat();

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

  montarSecoesComponentes(componentes);
}



//
// ==============================
// SEÇÕES POR COMPONENTE
// ==============================
//

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



//
// ==============================
// TABELA
// ==============================
//

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



//
// ==============================
// GANTT COM TICKS PROFISSIONAIS
// ==============================
//

const ganttCharts = {};

function montarGantt(etapas, canvasId){

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (ganttCharts[canvasId]) {
    ganttCharts[canvasId].destroy();
  }

  const agora = new Date();
  const agrupadas = {};
  const labels = [];
  const dados = [];

  etapas.forEach(e=>{
    if(!e.inicio) return;

    if(!agrupadas[e.nome_etapa]){
      agrupadas[e.nome_etapa]=[];
      labels.push(e.nome_etapa);
    }

    agrupadas[e.nome_etapa].push(e);
  });

  Object.values(agrupadas).forEach(lista=>{

    lista.sort((a,b)=> new Date(a.inicio)-new Date(b.inicio));

    const ultimo = lista[lista.length-1];
    const concluida = (ultimo.status || "").toLowerCase().includes("concl");

    lista.forEach(item=>{
      if(!item.inicio) return;

      const ini = new Date(item.inicio);
      if(isNaN(ini)) return;

      const fim = item.fim ? new Date(item.fim) : agora;

      dados.push({
        x:[ini.getTime(), fim.getTime()],
        y:item.nome_etapa,
        backgroundColor: concluida ? "#2563eb" : "#f59e0b"
      });
    });

  });

  if(!dados.length) return;

  const valores = dados.flatMap(d=>d.x);
let minTime = Math.min(...valores);
let maxTime = Math.max(...valores);

// ⭐ cria datas reais
const minDate = new Date(minTime);
const maxDate = new Date(maxTime);

// ⭐ força início do primeiro dia (00:00)
minDate.setHours(0, 0, 0, 0);

// ⭐ força final do último dia (23:59)
maxDate.setHours(23, 59, 59, 999);

// ⭐ volta para timestamp
minTime = minDate.getTime();
maxTime = maxDate.getTime();

  const ticksTempo = gerarTicksTempo(minTime, maxTime);

  canvas.height = Math.max(labels.length * 55, 280);

  ganttCharts[canvasId] = new Chart(canvas,{
    type:"bar",
    data:{
      labels,
      datasets:[{
        data:dados,
        backgroundColor:ctx=>ctx.raw.backgroundColor,
        borderRadius:5,
        barThickness:16
      }]
    },
    options:{
      responsive:false,
      maintainAspectRatio:false,
      indexAxis:"y",
      plugins:{
        legend:{display:false},
        title:{display:true,text:"Linha do Tempo de Fabricação / Manufacturing Timeline"},
        turnoNoturno: true,
      },
      scales:{
x: {
  type: "time",
  min: minTime,
  max: maxTime,

  time: {
    unit: "hour",
    stepSize: 3   // 🔒 força intervalos de 3h
  },

  ticks: {
    autoSkip: false,
    font: { weight: "bold" },

    callback: (value, index, ticks) => {

      const d = new Date(ticks[index].value);

      if (isNaN(d)) return "";

      // meia-noite → mostra data
      if (d.getHours() === 0) {
        return d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short"
        });
      }

      // múltiplos de 6h → mostra hora
      if (d.getHours() % 6 === 0) {
        return d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      // linhas intermediárias (3h) sem texto
      return "";
    }
  },

  grid: {
    drawTicks: true,

    color: ctx => {
      const d = new Date(ctx.tick.value);

      if (d.getHours() === 0) return "rgba(0,0,0,0.35)";
      if (d.getHours() % 6 === 0) return "rgba(0,0,0,0.18)";
      return "rgba(0,0,0,0.08)";
    },

    lineWidth: ctx => {
      const d = new Date(ctx.tick.value);
      if (d.getHours() === 0) return 2;
      if (d.getHours() % 6 === 0) return 1;
      return 0.6;
    }
  },

  title: {
    display: true,
    text: "Tempo / Time"
  }
},

        y:{
          ticks:{
            font:{weight:"bold"},
            backdropColor:"#fff",
            backdropPadding:4
          },
          grid:{ color:"rgba(0,0,0,0.15)" },
          title:{display:true,text:"Etapas / Steps"}
        }
      }
    }
  });
}



//
// ==============================
// DURAÇÃO
// ==============================
//

const durCharts = {};

function montarDuracao(etapas, canvasId){

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (durCharts[canvasId]) {
    durCharts[canvasId].destroy();
  }

  const total = {};
  const status = {};
  const agrupadas = {};

  etapas.forEach(e=>{
    if(!e.inicio) return;
    if(!agrupadas[e.nome_etapa]) agrupadas[e.nome_etapa]=[];
    agrupadas[e.nome_etapa].push(e);
  });

  Object.entries(agrupadas).forEach(([etapa,lista])=>{

    lista.sort((a,b)=> new Date(a.inicio)-new Date(b.inicio));
    const ultimo = lista[lista.length-1];

    let soma = 0;

    lista.forEach(d=>{
      if(!d.inicio) return;
      const ini = new Date(d.inicio);
      if(isNaN(ini)) return;
      const fim = d.fim ? new Date(d.fim) : ini;
      soma += (fim - ini) / 36e5;
    });

    total[etapa] = Number(soma.toFixed(2));
    status[etapa] = !(ultimo.status || "").toLowerCase().includes("concl");
  });

  const labels = Object.keys(total);
  const valores = Object.values(total);

  if(!labels.length) return;

  canvas.height = Math.max(labels.length * 30, 180);

  durCharts[canvasId] = new Chart(canvas,{
    type:"bar",
    data:{
      labels,
      datasets:[{
        data:valores,
        backgroundColor:ctx=>{
          const etapa = labels[ctx.dataIndex];
          return status[etapa] ? "#f59e0b" : "#2563eb";
        }
      }]
    },
    options:{
      responsive:false,
      maintainAspectRatio:false,
      indexAxis:"y",
      plugins:{
        legend:{display:false},
        title:{display:true,text:"Duração Total por Etapa / Total Time by Step"}
      },
      scales:{
        x:{
          grid:{ color:"rgba(0,0,0,0.15)" },
          title:{ display:true, text:"Horas Acumuladas / Cumulated Hours" }
        },
        y:{
          ticks:{ font:{weight:"bold"} },
          title:{ display:true, text:"Etapas / Steps" }
        }
      }
    }
  });
}
