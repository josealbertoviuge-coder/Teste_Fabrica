// =======================
// PLUGINS
// =======================
Chart.register(ChartDataLabels);

// =======================
// DATA SEM FUSO (exibe como digitado)
// =======================
function dataSemFuso(data) {
  if (!data) return null;
  return new Date(data.replace("Z", ""));
}

// =======================
// FORMATADOR PADRÃO (TABELA + TOOLTIP)
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

  if (!datas.length) return;

  const minData = new Date(Math.min(...datas));
  const maxData = new Date(Math.max(...datas));
  const margem = (maxData - minData) * 0.05;

  const eixoMin = new Date(minData.getTime() - margem);
  const eixoMax = new Date(maxData.getTime() + margem);

  const labels = [];
  const data = [];
  const cores = [];

  dados.forEach(d => {
    if (!d.inicio) return;

    const inicio = dataSemFuso(d.inicio);
    const fim = d.fim
      ? dataSemFuso(d.fim)
      : dataSemFuso(new Date().toISOString());

    labels.push(d.nome_etapa);
    data.push([inicio, fim]);
    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

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
        indexAxis: "y",
        plugins: {
          title: {
            display: true,
            text: "Timeline de Execução da Peça",
            font: { weight: "bold", size: 16 }
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const [inicio, fim] = ctx.raw;
                return `${formatarDataTabela(inicio)} → ${formatarDataTabela(fim)}`;
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
            ticks: {
              autoSkip: true,
              font: { weight: "bold" }
            },
            grid: {
              color: ctx => {
                const value = ctx.tick.value;
                const date = new Date(value);
          
                // início de um novo dia (00:00)
                if (date.getHours() === 7 && date.getMinutes() === 0) or (date.getHours() === 19 && date.getMinutes() === 0) {
                  return "rgba(0,0,0,0.35)"; // linha mais escura
                }
          
                return "rgba(0,0,0,0.08)"; // linhas normais
              },
              lineWidth: ctx => {
                const date = new Date(ctx.tick.value);
                return date.getHours() === 0 ? 1.5 : 0.5;
              }
            },
            title: {
              display: true,
              text: "Tempo",
              font: { weight: "bold" }
            }
          },
          y: {
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
    const fim = d.fim ? new Date(d.fim) : new Date();

    const horas = (fim - inicio) / (1000 * 60 * 60);
    const valor = Number(horas.toFixed(2));

    etapas.push(d.nome_etapa);
    duracoes.push(valor);
    tempoTotalHoras += valor;

    cores.push(d.fim ? "#2563eb" : "#f59e0b");
  });

  if (!duracoes.length) return;

  mostrarTempoTotal(tempoTotalHoras);

  const maxEixo = Math.max(...duracoes) * 1.1;

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
            text: "Duração do Processo",
            font: { weight: "bold", size: 16 }
          },
          legend: {
            labels: {
              font: { weight: "bold", size: 13 }
            }
          },
          datalabels: {
            color: "#000",
            formatter: v => `${v} h`,
            font: { weight: "bold" }
          }
        },
        scales: {
          x: {
            min: 0,
            max: maxEixo,
            title: {
              display: true,
              text: "Duração (horas)",
              font: { weight: "bold" }
            },
            ticks: {
              font: { weight: "bold" }
            }
          },
          y: {
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



