Chart.defaults.devicePixelRatio = window.devicePixelRatio * 2;
Chart.defaults.font.family = "Arial, sans-serif";

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
    dia.setHours(0, 0, 0, 0);
    if (dia < xScale.min) dia.setDate(dia.getDate() + 1);

    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;

    while (dia <= fim) {

      const rawX = xScale.getPixelForValue(dia);

      // evita desenhar fora da área
      if (rawX >= chartArea.left && rawX <= chartArea.right) {

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
    cursor.setHours(19, 0, 0, 0);

    if (cursor < inicio) {
      cursor.setDate(cursor.getDate() + 1);
    }

    ctx.save();
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";

    while (cursor < fim) {

      const inicioTurno = new Date(cursor);
      const fimTurno = new Date(cursor);
      fimTurno.setDate(fimTurno.getDate() + 1);
      fimTurno.setHours(7, 0, 0, 0);

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

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";

  // remove o Z para evitar conversão de fuso
  const d = new Date(dataISO.replace("Z", ""));

  if (isNaN(d)) return "-";

  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
window.addEventListener("load", carregarRelatorio);

//
// =======================================================
// GERADOR DE TICKS (12h alinhados)
// =======================================================
//

function gerarTicks12h(inicio, fim) {
  const ticks = [];
  let cursor = new Date(inicio);

  while (cursor <= fim) {
    ticks.push(cursor.getTime());
    cursor.setHours(cursor.getHours() + 12);
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

  document.getElementById("infoOP").innerHTML = `
    <strong>OP:</strong> ${dados.op} &nbsp;&nbsp;
    <strong>Cliente / Client:</strong> ${dados.cliente_nome} &nbsp;&nbsp;
    <strong>TAG:</strong> ${tagUsada}
  `;

  document.getElementById("dataRelatorio").innerHTML = `
    <strong>Data de Emissão / Issued Date:</strong> ${dataBR()}
  `;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

  let existeEtapaEmAndamento = false;

Object.values(componentes).forEach(lista => {

  // agrupa por nome da etapa
  const etapasAgrupadas = {};

  lista.forEach(e => {
    if (!etapasAgrupadas[e.nome_etapa]) {
      etapasAgrupadas[e.nome_etapa] = [];
    }
    etapasAgrupadas[e.nome_etapa].push(e);
  });

  Object.values(etapasAgrupadas).forEach(registros => {
    const ultimo = registros[registros.length - 1];
    const status = (ultimo.status || "").toLowerCase();

    if (status.includes("andamento")) {
      existeEtapaEmAndamento = true;
    }
  });

});

const statusFinal = existeEtapaEmAndamento
  ? "Em Andamento / In Progress"
  : "Concluído / Concluded";

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

  // 🎯 ordem desejada para impressão
  const ordemPreferida = [
    "Flange A",
    "Flange B",
    "Tambor",
    "Berco de Apoio",
    "Conjunto Montado"
  ];

  // 🔽 ordenar componentes
  const componentesOrdenados = Object.entries(componentes)
    .sort(([nomeA], [nomeB]) => {

      const posA = ordemPreferida.indexOf(nomeA);
      const posB = ordemPreferida.indexOf(nomeB);

      // ambos estão na lista preferida
      if (posA !== -1 && posB !== -1) return posA - posB;

      // apenas A está
      if (posA !== -1) return -1;

      // apenas B está
      if (posB !== -1) return 1;

      // nenhum está → ordem alfabética (ignora acentos)
      return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
    });

  // 🔽 renderização
  componentesOrdenados.forEach(([nomeComp, etapas], i) => {

    const bloco = document.createElement("section");
    bloco.className = "componente-bloco";

bloco.innerHTML = `
  <h2>${nomeComp}</h2>
  <table id="tabela_${i}"></table>
  <canvas id="gantt_${i}"></canvas>
  <canvas id="duracao_${i}"></canvas>

  <div class="footer-page">
    Carbogas Ltda. • MTS v1.0 • Manufacturing Tracking System
  </div>
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
<td>${formatarDataBR(e.inicio)}</td>
<td>${formatarDataBR(e.fim)}</td>
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

  function alinhar12h(date, paraCima=false){
  const d = new Date(date);
  d.setMinutes(0,0,0);

  const h = d.getHours();
  const resto = h % 12;

  if(resto !== 0){
    d.setHours(h + (paraCima ? (12-resto) : -resto));
  }

  return d;
}
  
const minDate = alinhar12h(new Date(Math.min(...valores)));
const ultimoValor = new Date(Math.max(...valores));

// vai para 00:00 do dia seguinte
const maxDate = new Date(ultimoValor);
maxDate.setHours(24, 0, 0, 0);
  
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
      layout: {
  padding: 0
},

  plugins:{
  turnoNoturno: true,
  legend:{display:false},

  title:{
    display:true,
    text:"Linha do Tempo de Fabricação / Manufacturing Timeline"
  },
  tooltip: { enabled: false },   // ⭐ remove hint
  datalabels: false   // ⭐ desativa textos sobre as barras
},

      scales:{
x:{
  type:"time",
  bounds:"data",
  min:minDate,
  max:maxDate,

  time:{
    unit:"hour",
    stepSize:12,
    displayFormats:{
      hour:"HH:mm"
    }
  },

  afterBuildTicks: scale => {
    scale.ticks = ticks12h.map(t => ({ value: t }));
  },

ticks:{
  source:'data',
  autoSkip:false,
  padding:8,

  callback:(value)=>{
    const d = new Date(value);
    const h = d.getHours();

    // 12:00 → hora (normal)
    if(h === 12){
      return "12:00";
    }

    // 00:00 → data (negrito)
    if(h === 0){
      const dia = String(d.getDate()).padStart(2,'0');
      const mes = String(d.getMonth()+1).padStart(2,'0');
      return `${dia}/${mes}`;
    }

    return "";
  },

  font: ctx => {
    const h = new Date(ctx.tick.value).getHours();

    return {
      size: 11,
      weight: h === 0 ? 'bold' : 'normal',   // ⭐ data em negrito
      family: 'sans-serif'
    };
  },

  minRotation: 45,
  maxRotation: 45
},


  grid:{
    drawTicks:true,
    color: ctx=>{
      const h = new Date(ctx.tick.value).getHours();
      if(h === 12) return "rgba(0,0,0,0.28)";
      if(h === 0) return "rgba(0,0,0,0.12)";
      return "rgba(0,0,0,0.08)";
    },
    lineWidth: ctx=>{
      const h = new Date(ctx.tick.value).getHours();
      if(h === 12) return 1.2;
      if(h === 0) return 0.8;
      return 0.6;
    }
  },

  title:{
    display:true,
    text:"Tempo / Time",
  font:{
    weight:"bold",
    size:13
  }
  }
},
        y:{
          ticks:{ font:{weight:"bold"} },
          grid:{ color:"rgba(0,0,0,0.15)" },
          title:{
            display:true,
            text:"Etapas / Steps",
  font:{
    weight:"bold",
    size:13
  }
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
      layout: {
  padding: 0
},
plugins:{
  legend:{display:false},
  tooltip: { enabled: false },   // ⭐ remove hint
  title:{
    display:true,
    text:"Duração Total por Etapa / Total Time by Step"
  },

  datalabels:{
    anchor:'center',
    align:'center',
    clamp:true,

    formatter: v => `${v} h`,

    font:{
      weight:'bold',
      size:11
    },

    color: ctx => {
      const etapa = labels[ctx.dataIndex];

      // concluída (barra azul)
      if(!status[etapa]){
        return "#facc15";   // amarelo
      }

      // em andamento (barra laranja)
      return "#000";        // preto
    }
  }
},
      scales:{
        x:{
          grid:{ color:"rgba(0,0,0,0.15)" },
          title:{
            display:true,
            text:"Horas Acumuladas / Cumulated Hours",
  font:{
    weight:"bold",
    size:13
  }
          }
        },
        y:{
          ticks:{ font:{weight:"bold"} },
          title:{
            display:true,
            text:"Etapas / Steps",
  font:{
    weight:"bold",
    size:13
  }
          }
        }
      }
    }
  });
}

// ===============================
// AJUSTE AUTOMÁTICO DO HEADER NA IMPRESSÃO
// ===============================

function ajustarEspacoHeader() {

  const header = document.getElementById("printHeader");
  if (!header) return;

  const altura = header.offsetHeight;

  document.documentElement.style.setProperty(
    "--altura-header",
    altura + "px"
  );
}

// calcula ao carregar
window.addEventListener("load", ajustarEspacoHeader);

// recalcula antes de imprimir
window.addEventListener("beforeprint", ajustarEspacoHeader);

// recalcula se redimensionar
window.addEventListener("resize", ajustarEspacoHeader);
