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
const itensBody = document.querySelector("#itens-table tbody");
const totalFardosEl = document.getElementById("total-fardos");
const statusEl = document.getElementById("status");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(target).classList.add("active");
  });
});

function recalcRow(row) {
  const qtd = Number(row.querySelector(".qtd")?.value || 0);
  const padrao = Number(row.querySelector(".padrao")?.value || 0);
  const fechado = padrao > 0 ? Math.floor(qtd / padrao) : 0;
  const fracao = padrao > 0 ? qtd % padrao : qtd;
  row.querySelector(".fechado").textContent = fechado;
  row.querySelector(".fracao").textContent = fracao;
}

function recalcTotal() {
  const total = [...itensBody.querySelectorAll(".qtd")].reduce((acc, input) => {
    return acc + Number(input.value || 0);
  }, 0);
  totalFardosEl.textContent = total;
}

async function buscarPadraoPorSku(sku) {
  if (!sku) return null;
  const { data, error } = await supabaseClient
    .from("produtos")
    .select("sku, fardos_por_palete, tipo")
    .eq("sku", sku)
    .limit(1);
  if (error) {
    console.warn("Erro ao buscar no Supabase", error.message);
    return null;
  }
  return data?.[0] || null;
}

function buildItemRow(item = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="sku" value="${item.sku || ""}" placeholder="Ex.: 20104418" /></td>
    <td><input class="qtd" type="number" min="0" step="1" value="${item.qtd || 0}" /></td>
    <td><input class="padrao" type="number" min="0" step="1" value="${item.padrao || 0}" /></td>
    <td class="fechado">0</td>
    <td class="fracao">0</td>
    <td><button class="remove" type="button">Remover</button></td>
  `;

  const skuInput = tr.querySelector(".sku");
  const qtdInput = tr.querySelector(".qtd");
  const padraoInput = tr.querySelector(".padrao");

  [qtdInput, padraoInput].forEach((input) => {
    input.addEventListener("input", () => {
      recalcRow(tr);
      recalcTotal();
    });
  });

  skuInput.addEventListener("blur", async () => {
    const sku = skuInput.value.trim();
    const found = await buscarPadraoPorSku(sku);
    if (found?.fardos_por_palete) {
      padraoInput.value = Number(found.fardos_por_palete);
      recalcRow(tr);
      recalcTotal();
    }
  });

  tr.querySelector(".remove").addEventListener("click", () => {
    tr.remove();
    recalcTotal();
  });

  itensBody.appendChild(tr);
  recalcRow(tr);
  recalcTotal();
}

document.getElementById("add-item").addEventListener("click", () => buildItemRow());

function getFormData() {
  const form = document.getElementById("zles-form");
  const raw = new FormData(form);
  const header = Object.fromEntries(raw.entries());
  const itens = [...itensBody.querySelectorAll("tr")].map((tr) => {
    const sku = tr.querySelector(".sku").value.trim();
    const qtd = Number(tr.querySelector(".qtd").value || 0);
    const padrao = Number(tr.querySelector(".padrao").value || 0);
    return {
      sku,
      qtd,
      padrao,
      pltFechado: padrao > 0 ? Math.floor(qtd / padrao) : 0,
      fracao: padrao > 0 ? qtd % padrao : qtd
    };
  });
  return { ...header, itens };
}

function saveCurrentData() {
  const payload = getFormData();
  if (!payload.numeroTransporte) {
    statusEl.textContent = "Informe o Nº transporte para salvar.";
    return;
  }
  localStorage.setItem(`dt-${payload.numeroTransporte}`, JSON.stringify(payload));
  statusEl.textContent = `DT ${payload.numeroTransporte} salva com sucesso.`;
}

document.getElementById("salvar-dados").addEventListener("click", saveCurrentData);

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
  const dt = document.getElementById("busca-dt").value.trim();
  if (!dt) return;
  const raw = localStorage.getItem(`dt-${dt}`);
  if (!raw) {
    alert("DT não encontrada no navegador. Salve primeiro na aba ZLES002.");
    return;
  }
  fillSheet(JSON.parse(raw));
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

buildItemRow({ sku: "20104418", qtd: 560, padrao: 28 });
renderStarProducts();
