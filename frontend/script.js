async function buscar(){

 const codigo = document.getElementById("codigo").value;
 const res = await fetch("https://teste-fabrica.onrender.com/peca/" + codigo);
 const dados = await res.json();

 montarTabela(dados);
 montarGrafico(dados);
}

function montarTabela(dados){

 let html = "<tr><th>Etapa</th><th>Status</th><th>Data</th></tr>";

 dados.forEach(d=>{
   html += `<tr>
     <td>${d.nome_etapa}</td>
     <td>${d.status}</td>
     <td>${new Date(d.data).toLocaleString()}</td>
   </tr>`;
 });

 document.getElementById("tabela").innerHTML = html;
}

let chart;

function montarGrafico(dados){

 const etapas = dados.map(d=>d.nome_etapa);
 const ordem = dados.map((d,i)=>i+1);

 if(chart) chart.destroy();

 chart = new Chart(document.getElementById("grafico"),{
   type:"line",
   data:{
     labels:etapas,
     datasets:[{
       label:"Fluxo da Peça",
       data:ordem,
       borderColor:"blue"
     }]
   }
 });
}

window.onload = ()=>{
 const params = new URLSearchParams(window.location.search);
 const codigo = params.get("codigo");
 if(codigo){
   document.getElementById("codigo").value = codigo;
   buscar();
 }
}

async function buscar() {
  const codigo = document.getElementById("codigo").value;

  const resposta = await fetch(
    "https://https://teste-fabrica.onrender.com/peca/" + codigo
  );

  const dados = await resposta.json();

  console.log(dados);
}
window.buscar = buscar;

