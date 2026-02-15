function dataBR() {
  return new Date().toLocaleString("pt-BR");
}

async function carregarRelatorio(){

  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("codigo");

  const res = await fetch("https://teste-fabrica.onrender.com/op/" + codigo);
  const dados = await res.json();

  document.getElementById("infoOP").innerHTML =
    `<strong>OP:</strong> ${dados.op} &nbsp;&nbsp; 
     <strong>Cliente:</strong> ${dados.cliente_nome}`;

  document.getElementById("dataRelatorio").innerHTML =
    `<strong>Emitido em:</strong> ${dataBR()}`;

  document.getElementById("qrRelatorio").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    window.location.origin + "/?codigo=" + codigo;

  const todasEtapas = Object.values(dados.tags).flatMap(tag =>
    Object.values(tag).flat()
  );

  // status final
  const ultima = todasEtapas[todasEtapas.length - 1];
  document.getElementById("statusFinal").innerText =
    ultima.status;

  // tabela
  let html = `
    <tr>
      <th>Etapa</th>
      <th>Status</th>
      <th>Início</th>
      <th>Fim</th>
    </tr>
  `;

  todasEtapas.forEach(e => {
    html += `
      <tr>
        <td>${e.nome_etapa}</td>
        <td>${e.status}</td>
        <td>${e.inicio || "-"}</td>
        <td>${e.fim || "-"}</td>
      </tr>
    `;
  });

  document.getElementById("tabelaRelatorio").innerHTML = html;

}

carregarRelatorio();
