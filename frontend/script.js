Chart.register(ChartDataLabels);

// =======================
// BUSCAR PEÇA
// =======================

async function buscar() {

  const codigo = document.getElementById("codigo").value;

  if (!codigo) {
    alert("Digite um código");
    return;
  }
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

function formatarDataBR(data) {
  if (!data) return "-";

  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
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
<td>${formatarDataBR(d.inicio)}</td>
<td>${d.fim ? formatarDataBR(d.fim) : "Em andamento"}</td>
      </tr>
    `;
  });

  document.getElementById("tabela").innerHTML = html;
}

// =======================
// GRÁFICO GANTT
// =======================

let chartGantt;

function montarGraficoGantt(dados) {

  if (chartGantt) chartGantt.destroy();

 const agora = new Date();

const datas = dados
  .flatMap(d => [
    d.inicio ? new Date(d.inicio) : null,
    d.fim ? new Date(d.fim) : agora
  ])
  .filter(Boolean);

const minData = new Date(Math.min(...datas));
const maxData = new Date(Math.max(...datas));

// margem visual (ex: 5% do intervalo)
const margem = (maxData - minData) * 0.05;

const eixoMin = new Date(minData.getTime() - margem);
const eixoMax = new Date(maxData.getTime() + margem);

  const labels = [];
  const data = [];
  const cores = [];

  dados.forEach(d => {
    if (!d.inicio) return;

    const inicio = new Date(d.inicio);
    const fim = d.fim ? new Date(d.fim) : agora;

    labels.push(d.nome_etapa);
    data.push([inicio, fim]);

    // cores por status
    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  chartGantt = new Chart(
    document.getElementById("grafico"),
    {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Linha do Tempo",
          data: data,
          backgroundColor: cores,
          borderRadius: 6,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: "y",
        plugins: {
          title: {
            display: true,
            text: "Gantt de Execução da Peça"
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const [ini, fim] = ctx.raw;
                return (
                  new Date(ini).toLocaleString() +
                  " → " +
                  new Date(fim).toLocaleString()
                );
              }
            }
          },
          datalabels: {
            display: false
          }
        },
scales: {
  x: {
    type: "time",
    min: eixoMin,
    max: eixoMax,
    time: {
      tooltipFormat: "dd/MM HH:mm"
    },
    ticks: {
      autoSkip: true,
      maxRotation: 0
    },
    title: {
      display: true,
      text: "Tempo"
    }
  },
  y: {
    title: {
      display: true,
      text: "Etapas"
    }
  }
}
      }
    }
  );
}
// =======================
// GRÁFICO DE DURAÇÃO
// =======================

let chartDuracao;

function montarGraficoDuracao(dados) {

  const etapas = [];
  const duracoes = [];
  const cores = [];

  let tempoTotalHoras = 0;

  dados.forEach(d => {

    if (!d.inicio) return;

    const inicio = new Date(d.inicio);
    const fim = d.fim ? new Date(d.fim) : new Date(); // agora se em andamento

    const duracaoHoras =
      (fim - inicio) / (1000 * 60 * 60);

    const duracaoFinal = Number(duracaoHoras.toFixed(2));

    etapas.push(d.nome_etapa);
    duracoes.push(duracaoFinal);

    tempoTotalHoras += duracaoFinal;

    // 🔴 etapa em andamento → laranja
    // 🔵 etapa concluída → azul
    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  if (duracoes.length === 0) return;

  // 🔹 mostra tempo total no topo
  mostrarTempoTotal(tempoTotalHoras);

  const maxDuracao = Math.max(...duracoes);
  const maxEixo = maxDuracao * 1.1;

  if (chartDuracao) chartDuracao.destroy();

  chartDuracao = new Chart(
    document.getElementById("graficoDuracao"),
    {
      type: "bar",
      data: {
        labels: etapas,
        datasets: [{
          label: "Duração por Etapa (h)",
          data: duracoes,
          backgroundColor: cores
        }]
      },
      options: {
        indexAxis: "y",
        plugins: {
          title: {
            display: true,
            text: "Duração por Etapa do Processo"
          },
          datalabels: {
            color: "red",
            anchor: "center",
            align: "center",
            formatter: value => `${value} h`,
            font: {
              weight: "bold"
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: maxEixo,
            title: {
              display: true,
              text: "Duração (horas)"
            }
          },
          y: {
            title: {
              display: true,
              text: "Etapas"
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

  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("codigo");

  if (codigo) {
    document.getElementById("codigo").value = codigo;
    buscar();
  }

});

// =======================
// QR CODE
// =======================

function gerarQRCode(codigo){
  document.getElementById("qrcode").src =
   "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
   "https://testefabrica-roan.vercel.app/?codigo=" + codigo;
}

function mostrarTempoTotal(horas) {

  const dias = Math.floor(horas / 24);
  const restoHoras = (horas % 24).toFixed(1);

  const texto =
    dias > 0
      ? `⏱ Tempo total da peça: ${dias}d ${restoHoras}h`
      : `⏱ Tempo total da peça: ${horas.toFixed(1)}h`;

  document.getElementById("tempoTotal").innerText = texto;
}








