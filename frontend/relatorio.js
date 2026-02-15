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
  const cursor = new Date(inicio);

  // zera minutos e segundos
  cursor.setMinutes(0,0,0);

  // força múltiplos de 12h (00 ou 12)
  cursor.setHours(Math.floor(cursor.getHours()/12)*12);

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
          bounds:"ticks",
          min:minDate,
          max:maxDate,

          afterBuildTicks: scale => {
            scale.ticks = ticks12h
              .filter(t => t >= scale.min && t <= scale.max)
              .map(t => ({ value: t }));
          },

          ticks:{
            autoSkip:false,
            maxRotation:0,
            font:{ weight:"bold" },

            callback:(value,index,ticks)=>{
              const d = new Date(ticks[index].value);

              if(d.getHours() === 0 && d.getMinutes() === 0){
                return (
                  d.toLocaleDateString("pt-BR", {
                    day:"2-digit",
                    month:"short"
                  }) + "\n00:00"
                );
              }

              if(d.getHours() === 12) return "12:00";

              return "";
            }
          },

          grid:{
            drawTicks:true,

            color: ctx=>{
              const d = new Date(ctx.tick.value);

              if(d.getHours() === 0 && d.getMinutes() === 0) return "rgba(0,0,0,0.45)";
              if(d.getHours() === 12) return "rgba(0,0,0,0.18)";
              return "rgba(0,0,0,0.08)";
            },

            lineWidth: ctx=>{
              const d = new Date(ctx.tick.value);

              if(d.getHours() === 0 && d.getMinutes() === 0) return 2.6;
              if(d.getHours() === 12) return 1;
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
