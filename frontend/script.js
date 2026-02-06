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

  gerarQRCode(codigo);

  const res = await fetch(
    "https://teste-fabrica.onrender.com/peca/" + codigo
  );

  const dados = await res.json();

  montarTabela(dados);
  montarGraficoFluxo(dados);
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
    html += `
      <tr>
        <td>${d.nome_etapa}</td>
        <td>${d.status}</td>
        <td>${d.inicio ? new Date(d.inicio).toLocaleString() : "-"}</td>
        <td>${d.fim ? new Date(d.fim).toLocaleString() : "Em andamento"}</td>
      </tr>
    `;
  });

  document.getElementById("tabela").innerHTML = html;
}

// =======================
// GRÁFICO DE FLUXO (TEMPO)
// =======================

let chartFluxo;

function montarGraficoFluxo(dados) {

  if (chartFluxo) chartFluxo.destroy();

  // cria um dataset por etapa
  const datasets = dados
    .filter(d => d.inicio && d.fim)
    .map(d => ({
      label: d.nome_etapa,
      data: [
        { x: new Date(d.inicio), y: d.nome_etapa },
        { x: new Date(d.fim),    y: d.nome_etapa }
      ],
      showLine: true,
      borderWidth: 6,
      pointRadius: 0
    }));

  if (datasets.length === 0) return;

  // limites do eixo X
  const datas = dados
    .flatMap(d => [d.inicio, d.fim])
    .filter(Boolean)
    .map(d => new Date(d));

  const inicioEixo = new Date(Math.min(...datas));
  const fimEixo = new Date(Math.max(...datas));

  inicioEixo.setDate(inicioEixo.getDate() - 1);
  fimEixo.setDate(fimEixo.getDate() + 1);

  chartFluxo = new Chart(
    document.getElementById("grafico"),
    {
      type: "scatter",
      data: { datasets },
      options: {
        plugins: {
          title: {
            display: true,
            text: "Linha do Tempo por Etapa"
          },
          legend: {
            display: false // opcional
          }
        },
        scales: {
          x: {
            type: "time",
            min: inicioEixo,
            max: fimEixo,
            time: {
              unit: "day",
              displayFormats: {
                day: "dd/MM"
              }
            },
            title: {
              display: true,
              text: "Tempo"
            }
          },
          y: {
            type: "category",
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

  dados.forEach(d => {

    if (!d.inicio || !d.fim) return;

    const inicio = new Date(d.inicio);
    const fim = new Date(d.fim);

    const duracaoHoras =
      (fim - inicio) / (1000 * 60 * 60);

    etapas.push(d.nome_etapa);
    duracoes.push(Number(duracaoHoras.toFixed(2)));
  });

  if (duracoes.length === 0) return;

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
  label: "Duração por Etapa",
  data: duracoes,
  backgroundColor: "#2563eb",
  datalabels: {
    color: "red",
    anchor: "center",
    align: "center",
    formatter: value => `${value} h`,
    font: {
      weight: "bold",
      size: 14
    }
  }
}]
      },
options: {
  indexAxis: "y",
  plugins: {
    datalabels: {
      display: true
    },
    title: {
      display: true,
      text: "Duração por Etapa do Processo"
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
   window.location.origin + "?codigo=" + codigo;
}


