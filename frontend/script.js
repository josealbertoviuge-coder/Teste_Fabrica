async function buscar(){

 const codigo = document.getElementById("codigo").value;
 const res = await fetch(`/peca/${codigo}`);
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
