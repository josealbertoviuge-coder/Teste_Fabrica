// ============================
// LINHAS DE VIRADA DE DIA (PRECISAS)
// ============================

const linhasDiaPlugin = {
  id: "linhasDia",

  afterDatasetsDraw(chart) {

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    let dia = new Date(xScale.min);
    const fim = new Date(xScale.max);

    // começa exatamente na meia-noite visível
    dia.setHours(0,0,0,0);
    if (dia < xScale.min) dia.setDate(dia.getDate() + 1);

    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;

    while (dia <= fim) {

      const rawX = xScale.getPixelForValue(dia);

      // evita desenhar fora da área
      if (rawX >= chartArea.left && rawX <= chartArea.right) {

        // alinhamento perfeito de pixel
        const x = Math.round(rawX) + 0.5;

        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }

      dia.setDate(dia.getDate() + 1);
    }

    ctx.restore();
  }
};

Chart.register(linhasDiaPlugin);

// ============================
// TURNO NOTURNO (19h → 07h)
// ============================

const turnoNoturnoPlugin = {
  id: "turnoNoturno",

  beforeDatasetsDraw(chart) {

    const { ctx, chartArea, scales } = chart;
    const xScale = scales?.x;
    if (!xScale) return;

    const inicio = xScale.min;
    const fim = xScale.max;

    if (!inicio || !fim) return;

    let cursor = new Date(inicio);
    cursor.setHours(19,0,0,0);

    if (cursor < inicio) {
      cursor.setDate(cursor.getDate() + 1);
    }

    ctx.save();
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";

    while (cursor < fim) {

      const inicioTurno = new Date(cursor);
      const fimTurno = new Date(cursor);
      fimTurno.setDate(fimTurno.getDate() + 1);
      fimTurno.setHours(7,0,0,0);

      const drawStart = Math.max(inicioTurno, new Date(inicio));
      const drawEnd   = Math.min(fimTurno, new Date(fim));

      if (drawStart < drawEnd) {

        const xInicio = xScale.getPixelForValue(drawStart);
        const xFim = xScale.getPixelForValue(drawEnd);

        ctx.fillRect(
          xInicio,
          chartArea.top,
          xFim - xInicio,
          chartArea.bottom - chartArea.top
        );
      }

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
// GERADOR DE TICKS (12h alinhados)
// =======================================================
//

function gerarTicks12h(inicio, fim) {

  const ticks = [];

  const dia = new Date(inicio);
  dia.setHours(0,0,0,0);

  const ultimo = new Date(fim);
  ultimo.setHours(0,0,0,0);

  while (dia <= ultimo) {

    // meia-noite
    ticks.push(new Date(dia).getTime());

    // meio-dia garantido
    const meioDia = new Date(dia);
    meioDia.setHours(12,0,0,0);
    ticks.push(meioDia.getTime());

    dia.setDate(dia.getDate() + 1);
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

  document.getElementById("infoOP").innerHTML =
    `<strong>OP:</strong> ${dados.op} &nbsp;&nbsp;
     <strong>Cliente / Client:</strong> ${dados.cliente_nome} &nbsp;&nbsp;
     <strong>TAG:</strong> ${tagUsada}`;

  document.getElementById("dataRelatorio").innerHTML =
    `<strong>Data de Emissão / Issued Date:</strong> ${dataBR()}`;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

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
// GANTT PROFISSIONAL
// ==============================
//

const ganttCharts = {};

function montarGantt(etapas, canvasId){

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (ganttCharts[canvasId]) {
    ganttCharts[canvasId].destroy();
    delete ganttCharts[canvasId];
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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
      const ini = new Date(item.inicio);
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

  const minDate = new Date(Math.min(...valores));
  const maxDate = new Date(Math.max(...valores));

  minDate.setHours(0,0,0,0);
  maxDate.setHours(23,59,59,999);

  const ticks12h = gerarTicks12h(minDate, maxDate);

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
        turnoNoturno: true,
        legend:{display:false},
        title:{
          display:true,
          text:"Linha do Tempo de Fabricação / Manufacturing Timeline"
        }
      },

      scales:{
x:{
  type:"time",
  bounds:"data",
  min:minDate,
  max:maxDate,

  // 🔒 força linhas a cada 12h
  time:{
    unit:"hour",
    stepSize:12
  },

afterBuildTicks: scale => {
  scale.ticks = ticks12h
    .filter(t => t >= scale.min - 43200000 && t <= scale.max + 43200000)
    .map(t => ({ value: t }));
},

  ticks:{
    autoSkip:false,
    maxRotation:0,
    font:{ weight:"bold" },

    // 🎯 MOSTRA TEXTO SOMENTE ÀS 12:00
    callback:(value,index,ticks)=>{
      const d = new Date(ticks[index].value);

      if(d.getHours() === 12){
        return "12:00";
      }

      return "";
    }
  },

  grid:{
    drawTicks:true,

    color: ctx=>{
      const d = new Date(ctx.tick.value);

      // linha leve à meia-noite (plugin já destaca)
      if(d.getHours() === 0) return "rgba(0,0,0,0.10)";

      // linha visível às 12h
      if(d.getHours() === 12) return "rgba(0,0,0,0.22)";

      return "rgba(0,0,0,0.08)";
    },

    lineWidth: ctx=>{
      const d = new Date(ctx.tick.value);

      if(d.getHours() === 12) return 1.2;
      return 0.6;
    }
  },

  title:{
    display:true,
    text:"Tempo / Time"
  }
},
        y:{
          ticks:{ font:{weight:"bold"} },
          grid:{ color:"rgba(0,0,0,0.15)" },
          title:{
            display:true,
            text:"Etapas / Steps"
          }
        }
      }
    }
  });
}

//
// ==============================
// DURAÇÃO POR ETAPA
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
      const ini = new Date(d.inicio);
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
        title:{
          display:true,
          text:"Duração Total por Etapa / Total Time by Step"
        }
      },
      scales:{
        x:{
          grid:{ color:"rgba(0,0,0,0.15)" },
          title:{
            display:true,
            text:"Horas Acumuladas / Cumulated Hours"
          }
        },
        y:{
          ticks:{ font:{weight:"bold"} },
          title:{
            display:true,
            text:"Etapas / Steps"
          }
        }
      }
    }
  });
}
