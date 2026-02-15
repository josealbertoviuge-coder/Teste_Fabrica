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

window.addEventListener("load", carregarRelatorio);

//
// =======================================================
// GERADOR DE TICKS (12h alinhados)
// =======================================================
//

function gerarTicks12h(inicio, fim) {

  const ticks = [];

  const dia = new Date(inicio);
  dia.setHours(0, 0, 0, 0);

  const ultimo = new Date(fim);
  ultimo.setHours(0, 0, 0, 0);

  while (dia <= ultimo) {

    // meia-noite
    ticks.push(new Date(dia).getTime());

    // meio-dia garantido
    const meioDia = new Date(dia);
    meioDia.setHours(12, 0, 0, 0);
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
