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

const STATUS_OPTIONS = [
  "EXPEDIDO",
  "CARREGANDO",
  "AG CHEGADA",
  "NO SHOW",
  "VEICULO RECUSADO",
  "SEPARANDO",
  "EM FATURAMENTO",
  "PATIO",
  "DT EXCLUDA",
  "FOI EMBORA"
];

const STATUS_COLORS = {
  EXPEDIDO: "#2e7d32",
  CARREGANDO: "#1565c0",
  "AG CHEGADA": "#f9a825",
  "NO SHOW": "#6d4c41",
  "VEICULO RECUSADO": "#c62828",
  SEPARANDO: "#5e35b1",
  "EM FATURAMENTO": "#00897b",
  PATIO: "#ef6c00",
  "DT EXCLUDA": "#546e7a",
  "FOI EMBORA": "#37474f"
};

const STATUS_BASE = {
  VENDA: { planejado: 59, realizado: 30 },
  TNF: { planejado: 0, realizado: 8 },
  MOGI: { planejado: 53, realizado: 37 },
  "Pré Fat Amazon": { planejado: 0, realizado: 0 },
  "TRANSFERÊNCIA": { planejado: 26, realizado: 26 },
  DESCARGA: { planejado: 0, realizado: 0 },
  DEVOLUÇÃO: { planejado: 0, realizado: 0 },
  GRADE: { planejado: 69, realizado: 69 }
};

const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");
const statusEl = document.getElementById("status");
const statusLocaisEl = document.getElementById("status-locais");
const resumoImportacaoEl = document.getElementById("resumo-importacao");
const listaDtsEl = document.getElementById("lista-dts");
const gradeBody = document.getElementById("grade-body");
const dashboardBody = document.getElementById("dashboard-body");

const STORAGE_KEY = "dts-store-v3";
let store = loadStore();

function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  return {
    dts: parsed.dts || {},
    grade: parsed.grade || [],
    dashboard: parsed.dashboard || []
  };
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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

function parseSheetFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function buscarPadraoPorSku(sku) {
  const { data, error } = await supabaseClient.from("produtos").select("sku, fardos_por_palete").eq("sku", sku).limit(1);
  if (error || !data?.length) return null;
  return Number(data[0].fardos_por_palete || 0);
}

async function parseSapColsToItem(cols) {
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

async function importSAPRows(rows) {
  let importadas = 0;
  for (const row of rows) {
    const parsed = await parseSapColsToItem(row.map((v) => String(v || "").trim()));
    if (!parsed?.numeroTransporte) continue;

    if (!store.dts[parsed.numeroTransporte]) {
      store.dts[parsed.numeroTransporte] = {
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

    store.dts[parsed.numeroTransporte].itens.push(parsed.item);
    importadas += 1;
  }
  return importadas;
}

async function importarMateriais() {
  const text = document.getElementById("sap-linhas").value.trim();
  const file = document.getElementById("sap-file").files[0];
  let rows = [];

  if (text) {
    rows = text.split("\n").map((line) => line.split("\t").map((v) => v.trim())).filter((c) => c.length >= 14);
  } else if (file) {
    const fileRows = await parseSheetFromFile(file);
    rows = fileRows.filter((r) => r.filter(Boolean).length).map((r) => r.map((v) => String(v || "").trim()));
  } else {
    statusEl.textContent = "Cole linhas SAP ou envie uma planilha.";
    return;
  }

  const total = await importSAPRows(rows);
  saveStore();
  renderResumoImportacao();
  pesquisarPorFinalDT();
  statusEl.textContent = `${total} linha(s) de materiais importada(s).`;
}

document.getElementById("importar-sap").addEventListener("click", () => importarMateriais().catch((e) => (statusEl.textContent = `Erro: ${e.message}`)));

function parseLocaisByPosition(row) {
  return {
    dt: String(row[2] || "").trim(),
    local: String(row[4] || "").trim(),
    cidadeDestino: String(row[7] || "").trim(),
    peso: Number(String(row[9] || "0").replace(",", ".")) || 0,
    transportadora: String(row[12] || "").trim(),
    motorista: String(row[14] || "").trim(),
    placaVeiculo: String(row[16] || "").trim(),
    placaComp1: String(row[17] || "").trim(),
    placaComp2: String(row[18] || "").trim(),
    agenda: String(row[20] || "").trim(),
    fimAgenda: String(row[22] || "").trim()
  };
}

function ensureGradeRow(item) {
  const idx = store.grade.findIndex((g) => g.dt === item.dt);
  const base = {
    dt: item.dt,
    transportadora: item.transportadora,
    gradeCarregamento: item.agenda,
    fimCarregamento: item.fimAgenda,
    horaChegada: "",
    status: "AG CHEGADA",
    tipo: item.local,
    toneladas: item.peso,
    agenda: item.agenda,
    placa: item.placaVeiculo || item.placaComp1 || item.placaComp2,
    cidadeDestino: item.cidadeDestino,
    motorista: item.motorista,
    peso: item.peso
  };

  if (idx === -1) {
    store.grade.push(base);
  } else {
    store.grade[idx] = { ...store.grade[idx], ...base, status: store.grade[idx].status || "AG CHEGADA", horaChegada: store.grade[idx].horaChegada || "" };
  }
}

async function importarLocais() {
  const file = document.getElementById("locais-file").files[0];
  if (!file) {
    statusLocaisEl.textContent = "Selecione a planilha de shipment.";
    return;
  }

  const rows = await parseSheetFromFile(file);
  let count = 0;
  rows.slice(1).forEach((row) => {
    const item = parseLocaisByPosition(row);
    if (!item.dt) return;
    ensureGradeRow(item);
    count += 1;
  });

  saveStore();
  renderGrade();
  renderStatusPage();
  statusLocaisEl.textContent = `${count} registro(s) importado(s) para a grade.`;
}

document.getElementById("importar-locais").addEventListener("click", () => importarLocais().catch((e) => (statusLocaisEl.textContent = `Erro: ${e.message}`)));

function upsertDashboardFromPatio(gradeItem) {
  const idx = store.dashboard.findIndex((d) => d.dt === gradeItem.dt);
  const now = new Date();
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = now.toLocaleDateString("pt-BR");

  if (idx === -1) {
    store.dashboard.push({
      dt: gradeItem.dt,
      hora,
      data,
      placa: gradeItem.placa || "",
      transportadora: gradeItem.transportadora || "",
      status: gradeItem.status,
      mapa: gradeItem.cidadeDestino || "",
      grade: gradeItem.gradeCarregamento || "",
      tipo: gradeItem.tipo || "",
      peso: gradeItem.peso || 0
    });
  } else {
    store.dashboard[idx] = {
      ...store.dashboard[idx],
      dt: gradeItem.dt,
      placa: gradeItem.placa || store.dashboard[idx].placa,
      transportadora: gradeItem.transportadora || store.dashboard[idx].transportadora,
      status: gradeItem.status,
      mapa: gradeItem.cidadeDestino || store.dashboard[idx].mapa,
      grade: gradeItem.gradeCarregamento || store.dashboard[idx].grade,
      tipo: gradeItem.tipo || store.dashboard[idx].tipo,
      peso: gradeItem.peso || store.dashboard[idx].peso
    };
  }
}

function renderGrade() {
  gradeBody.innerHTML = "";

  if (!store.grade.length) {
    gradeBody.innerHTML = '<tr><td colspan="9">Nenhuma linha importada.</td></tr>';
    return;
  }

  store.grade.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.dt || "-"}</td>
      <td>${row.transportadora || "-"}</td>
      <td>${row.gradeCarregamento || "-"}</td>
      <td>${row.fimCarregamento || "-"}</td>
      <td><input class="inline-input" type="time" value="${row.horaChegada || ""}" data-grade-time="${index}" /></td>
      <td>
        <select class="status-select" data-grade-status="${index}" style="background:${STATUS_COLORS[row.status] || "#eceff1"}">
          ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === row.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td>${row.tipo || "-"}</td>
      <td>${Number(row.toneladas || 0).toFixed(2)}</td>
      <td>${row.agenda || "-"}</td>
    `;
    gradeBody.appendChild(tr);
  });

  document.querySelectorAll("[data-grade-time]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.gradeTime);
      store.grade[idx].horaChegada = e.target.value;
      saveStore();
    });
  });

  document.querySelectorAll("[data-grade-status]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.gradeStatus);
      store.grade[idx].status = e.target.value;
      e.target.style.background = STATUS_COLORS[e.target.value] || "#eceff1";

      if (e.target.value === "PATIO") {
        upsertDashboardFromPatio(store.grade[idx]);
      }

      saveStore();
      renderDashboard();
      renderStatusPage();
    });
  });
}

function renderDashboard() {
  dashboardBody.innerHTML = "";

  if (!store.dashboard.length) {
    dashboardBody.innerHTML = '<tr><td colspan="10">Nenhum veículo em pátio.</td></tr>';
    return;
  }

  store.dashboard.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.dt || "-"}</td>
      <td><input class="inline-input" type="time" data-dash-hora="${index}" value="${row.hora || ""}" /></td>
      <td><input class="inline-input" type="date" data-dash-data="${index}" value="${toIsoDate(row.data)}" /></td>
      <td>${row.placa || "-"}</td>
      <td>${row.transportadora || "-"}</td>
      <td><span class="status-chip" style="background:${STATUS_COLORS[row.status] || "#eceff1"}">${row.status}</span></td>
      <td>${row.mapa || "-"}</td>
      <td>${row.grade || "-"}</td>
      <td>${row.tipo || "-"}</td>
      <td>${Number(row.peso || 0).toFixed(2)}</td>
    `;
    dashboardBody.appendChild(tr);
  });

  document.querySelectorAll("[data-dash-hora]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.dashHora);
      store.dashboard[idx].hora = e.target.value;
      saveStore();
    });
  });

  document.querySelectorAll("[data-dash-data]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.dashData);
      store.dashboard[idx].data = fromIsoDate(e.target.value);
      saveStore();
    });
  });
}

function toIsoDate(brDate) {
  const parts = String(brDate || "").split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

function fromIsoDate(iso) {
  if (!iso) return "";
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function renderStatusPage() {
  const body = document.getElementById("status-body");
  const charts = document.getElementById("charts");
  body.innerHTML = "";
  charts.innerHTML = "";

  const gradeRealizado = store.grade.filter((g) => ["EXPEDIDO", "PATIO", "CARREGANDO"].includes(g.status)).length;
  const merged = JSON.parse(JSON.stringify(STATUS_BASE));
  merged.GRADE.realizado = gradeRealizado;

  Object.entries(merged).forEach(([label, values]) => {
    const pend = Number(values.planejado) - Number(values.realizado);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td>${values.planejado}</td><td>${values.realizado}</td><td>${pend}</td>`;
    body.appendChild(tr);

    const max = Math.max(values.planejado, values.realizado, Math.abs(pend), 1);
    const card = document.createElement("div");
    card.className = "chart-card";
    card.innerHTML = `
      <h4>${label}</h4>
      <div class="bar-row"><span>Planejado</span><div class="bar"><i style="width:${(values.planejado / max) * 100}%"></i></div><b>${values.planejado}</b></div>
      <div class="bar-row"><span>Realizado</span><div class="bar done"><i style="width:${(values.realizado / max) * 100}%"></i></div><b>${values.realizado}</b></div>
      <div class="bar-row"><span>Pend</span><div class="bar pend"><i style="width:${(Math.abs(pend) / max) * 100}%"></i></div><b>${pend}</b></div>
    `;
    charts.appendChild(card);
  });
}

function renderResumoImportacao() {
  resumoImportacaoEl.innerHTML = "";
  const registros = Object.values(store.dts);

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
  const allDts = Object.keys(store.dts);
  const matches = allDts.filter((dt) => !term || dt.endsWith(term));

  listaDtsEl.innerHTML = "";
  if (!matches.length) {
    listaDtsEl.innerHTML = '<option value="">Nenhuma DT encontrada</option>';
    return;
  }

  matches.forEach((dt) => {
    const option = document.createElement("option");
    option.value = dt;
    option.textContent = `${dt} - ${store.dts[dt].nomeCliente || "Sem cliente"}`;
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
  if (!dt || !store.dts[dt]) {
    alert("Selecione uma DT válida.");
    return;
  }
  fillSheet(store.dts[dt]);
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
renderGrade();
renderDashboard();
renderStatusPage();
