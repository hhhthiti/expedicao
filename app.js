const SUPABASE_URL = "https://qfjghplxbtogshfjkawx.supabase.co";
const SUPABASE_KEY = "sb_publishable_rIcKdaflOvJ0DLTJDcOrxA_bpTGG2hA";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STAR_PRODUCTS = [
  ["20104425", "PANO SCOTT DURAMAX 58X03X08 BRANCO"],
  ["20092384", "GUARDANAPO SCALA 22X20 - 3600 UN"],
  ["20104429", "GUARD. SCOTT GRANDHOTEL FD 9X9X50 P"],
  ["20104430", "GUARD. SCOTT GRANDHOTEL FD 8X9X50 G"],
  ["20104313", "PANO SCOTT DURAMAX 58X01X24 BRANCO"],
  ["20104426", "GUARD. SCOTT DIA A DIA FS 6X12X50 P"],
  ["20104309", "LENCO FAC KLEENEX BLS FT 10X04X72 L4P3"],
  ["20092383", "GUARDANAPO SCALA 22X20 - CX 4800 UN"],
  ["20104422", "LENCO FAC KLEENEX BX FD 100X40 L100P80"],
  ["20092388", "GUARDAPANO NAPS 33X30 - 1800 UN"],
  ["20104421", "LENCO FAC KLEENEX BX FD 50X60 L60P50"],
  ["20092386", "GUARDANAPO NAPS 23X21,5 - 3600 UN"],
  ["20110078", "PANO SCALA 50X01X24 BRANCO"],
  ["90004710", "LENÇO UMEDECIDO MIMMO 40x24"],
  ["90004853", "LENCO UMED. NEVE TOQ SEDA 48X24"],
  ["90005082", "LENCO UMED. NEVE ON THE GO 16X24"],
  ["90005191", "LENCO UMED. NEVE 48X4X6 L4P3"],
  ["20091836", "TOAX430 3R 120F 3X6 SCALA PLUS MEGA"],
  ["20091835", "TOAX430 2R 100F 2X12 SCALA PLUS MPICOTE"],
  ["20091834", "TOAX430 2R 60F 2X12 SCALA PLUS REG"],
  ["20111061", "TOAX430 2R 120F 3X6 SCALA WARM UP"]
];

const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");
const statusEl = document.getElementById("status");
const resumoImportacaoEl = document.getElementById("resumo-importacao");
const listaDtsEl = document.getElementById("lista-dts");

const STORAGE_KEY = "dts-store-v2";
let dtStore = loadStore();

function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dtStore));
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(target).classList.add("active");
  });
});

function formatDateFromSAP(value) {
  const clean = String(value || "").trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    const [dd, mm, yyyy] = clean.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }
  return clean;
}

async function buscarPadraoPorSku(sku) {
  const { data, error } = await supabaseClient
    .from("produtos")
    .select("sku, fardos_por_palete")
    .eq("sku", sku)
    .limit(1);

  if (error || !data?.length) return null;
  return Number(data[0].fardos_por_palete || 0);
}

async function parseSapLineToItem(line) {
  const cols = line.split("\t").map((v) => v.trim());
  if (cols.length < 14) return null;

  const material = cols[6];
  const qtd = Number(cols[5] || 0);
  const padraoSupabase = await buscarPadraoPorSku(material);
  const padrao = Number(padraoSupabase || cols[12] || 0);

  return {
    codCliente: cols[0],
    codTransportadora: cols[1],
    numeroTransporte: cols[2],
    infoAgenda: cols[3],
    nomeCliente: cols[4],
    setorAtividade: cols[7],
    clientePallet: cols[8],
    agrupamentoRegional: cols[9],
    qtdTeoricaConvertida: cols[10],
    numeroNfe: cols[11],
    qtdTeorica: cols[12],
    dataAgendamento: formatDateFromSAP(cols[13]),
    item: {
      sku: material,
      qtd,
      padrao,
      pltFechado: padrao > 0 ? Math.floor(qtd / padrao) : 0,
      fracao: padrao > 0 ? qtd % padrao : qtd
    }
  };
}

async function importarLinhasSAP() {
  const raw = document.getElementById("sap-linhas").value.trim();
  if (!raw) {
    statusEl.textContent = "Cole uma ou mais linhas do SAP.";
    return;
  }

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  let importadas = 0;

  for (const line of lines) {
    const parsed = await parseSapLineToItem(line);
    if (!parsed?.numeroTransporte) continue;

    if (!dtStore[parsed.numeroTransporte]) {
      dtStore[parsed.numeroTransporte] = {
        codCliente: parsed.codCliente,
        codTransportadora: parsed.codTransportadora,
        numeroTransporte: parsed.numeroTransporte,
        infoAgenda: parsed.infoAgenda,
        nomeCliente: parsed.nomeCliente,
        setorAtividade: parsed.setorAtividade,
        clientePallet: parsed.clientePallet,
        agrupamentoRegional: parsed.agrupamentoRegional,
        qtdTeoricaConvertida: parsed.qtdTeoricaConvertida,
        numeroNfe: parsed.numeroNfe,
        qtdTeorica: parsed.qtdTeorica,
        dataAgendamento: parsed.dataAgendamento,
        itens: []
      };
    }

    dtStore[parsed.numeroTransporte].itens.push(parsed.item);
    importadas += 1;
  }

  saveStore();
  renderResumoImportacao();
  statusEl.textContent = `${importadas} linha(s) importada(s) e agrupada(s) por DT.`;
}

document.getElementById("importar-sap").addEventListener("click", importarLinhasSAP);

function renderResumoImportacao() {
  resumoImportacaoEl.innerHTML = "";
  const registros = Object.values(dtStore);

  if (!registros.length) {
    resumoImportacaoEl.innerHTML = '<tr><td colspan="4">Nenhuma DT importada ainda.</td></tr>';
    return;
  }

  registros.forEach((dt) => {
    const total = (dt.itens || []).reduce((acc, item) => acc + Number(item.qtd || 0), 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dt.numeroTransporte}</td>
      <td>${dt.nomeCliente || "-"}</td>
      <td>${dt.itens?.length || 0}</td>
      <td>${total}</td>
    `;
    resumoImportacaoEl.appendChild(tr);
  });
}

function pesquisarPorFinalDT() {
  const term = document.getElementById("busca-dt").value.trim();
  const allDts = Object.keys(dtStore);
  const matches = allDts.filter((dt) => !term || dt.endsWith(term));

  listaDtsEl.innerHTML = "";
  if (!matches.length) {
    listaDtsEl.innerHTML = '<option value="">Nenhuma DT encontrada</option>';
    return;
  }

  matches.forEach((dt) => {
    const option = document.createElement("option");
    option.value = dt;
    option.textContent = `${dt} - ${dtStore[dt].nomeCliente || "Sem cliente"}`;
    listaDtsEl.appendChild(option);
  });
}

document.getElementById("pesquisar-dt").addEventListener("click", pesquisarPorFinalDT);

function fillSheet(data) {
  document.getElementById("sheet-dt").textContent = `DT: ${data.numeroTransporte || "-"}`;
  document.getElementById("sheet-cliente").textContent = `Cliente: ${data.nomeCliente || "-"}`;
  document.getElementById("sheet-data").textContent = `Data agendamento: ${data.dataAgendamento || "-"}`;

  const tbody = document.getElementById("sheet-itens");
  tbody.innerHTML = "";
  let total = 0;

  (data.itens || []).forEach((item) => {
    total += Number(item.qtd || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.numeroTransporte || ""}</td>
      <td>${item.sku || ""}</td>
      <td>${item.qtd || 0}</td>
      <td>${item.padrao || 0}</td>
      <td>${item.pltFechado || 0}</td>
      <td>${item.fracao || 0}</td>
      <td>☐</td>
      <td>☐</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("sheet-total").textContent = total;
}

document.getElementById("carregar-dt").addEventListener("click", () => {
  const dt = listaDtsEl.value;
  if (!dt || !dtStore[dt]) {
    alert("Selecione uma DT válida.");
    return;
  }
  fillSheet(dtStore[dt]);
});

document.getElementById("imprimir").addEventListener("click", () => window.print());

function renderStarProducts() {
  const body = document.getElementById("produtos-estrela-body");
  STAR_PRODUCTS.forEach(([sku, descricao]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${sku}</td><td>${descricao}</td>`;
    body.appendChild(tr);
  });
}

renderResumoImportacao();
pesquisarPorFinalDT();
renderStarProducts();
 