// =======================
// BUSCAR PEÇA
// =======================

async function buscar() {

  const codigo = document.getElementById("codigo").value;

  if (!codigo) {
    alert("Digite um código");
    return;
  }

  gerarQRCode(codigo);

  const res = await fetch(
    "https://teste-fabrica.onrender.com/peca/" + codigo
  );

  const dados = await res.json();

  montarTabela(dados);
  montarGrafico(dados);
  montarGraficoDuracao(dados);
}

window.buscar = buscar;

// =======================
// TABELA
// =======================

function montarTabela(dados) {

  let html = "<tr><th>Etapa</th><th>Status</th><th>Data</th></tr>";

  dados.forEach(d => {
    html += `
      <tr>
        <td>${d.nome_etapa}</td>
        <td>${d.status}</td>
        <td>${new Date(d.data).toLocaleString()}</td>
      </tr>
    `;
  });

  document.getElementById("tabela").innerHTML = html;
}

// =======================
// GRÁFICO
// =======================

let chart;

function montarGrafico(dados) {

  if (chart) chart.destroy();

  const datas = dados.map(d => new Date(d.data));

  const inicio = new Date(Math.min(...datas));
  const fim = new Date(Math.max(...datas));

  // margem de 1 dia
  inicio.setDate(inicio.getDate() - 1);
  fim.setDate(fim.getDate() + 1);

  chart = new Chart(
    document.getElementById("grafico"),
    {
      type: "scatter",
      data: {
        datasets: [{
          label: "Fluxo da Peça",
          data: dados.map(d => ({
            x: new Date(d.data),
            y: d.nome_etapa
          })),
          showLine: true,
          borderColor: "blue"
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: "Fluxo da Peça no Tempo"
          }
        },
        scales: {
          x: {
            type: "time",
            min: inicio,
            max: fim,
            time: {
              unit: "day",
              displayFormats: {
                day: "dd/MM"
              }
            },
            title: {
              display: true,
              text: "Data"
            }
          },
          y: {
            type: "category",
            title: {
              display: true,
              text: "Etapas do Processo"
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

function gerarQRCode(codigo){
  document.getElementById("qrcode").src =
   "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
   window.location.origin + "?codigo=" + codigo;
}


function calcularDuracaoHoras(inicio, fim) {
  const inicioDate = new Date(inicio);
  const fimDate = new Date(fim);

  const diffMs = fimDate - inicioDate;
  const diffHoras = diffMs / (1000 * 60 * 60);

  return Number(diffHoras.toFixed(2));
}

let chartDuracao;

function montarGraficoDuracao(dados) {

  const etapas = [];
  const duracoes = [];

  dados.forEach(d => {

    // só considera etapas finalizadas
    if (!d.inicio || !d.fim) return;

    etapas.push(d.nome_etapa);

    duracoes.push(
      calcularDuracaoHoras(d.inicio, d.fim)
    );
  });

  if (chartDuracao) chartDuracao.destroy();

  chartDuracao = new Chart(
    document.getElementById("graficoDuracao"),
    {
      type: "bar",
      data: {
        labels: etapas,
        datasets: [{
          label: "Duração por Etapa (horas)",
          data: duracoes,
          backgroundColor: "#2563eb"
        }]
      },
      options: {
        indexAxis: "y", // barras horizontais
        plugins: {
          title: {
            display: true,
            text: "Duração da Peça por Etapa"
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.raw} h`
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Horas"
            }
          }
        }
      }
    }
  );
}




