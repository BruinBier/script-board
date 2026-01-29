// ======= Storage & IDs =======
const STORAGE_KEY = "scriptboard:v1";
const uid = () => Math.random().toString(36).slice(2, 10);

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);

  // Default demo
  return {
    acts: [
      {
        id: "act1",
        title: "Acte 1",
        scenes: [
          { id: "s1", title: "Opening – Markt", text: "Aladdin probeert een brood te stelen..." },
          { id: "s2", title: "Jasmijn ontsnapt", text: "Jasmijn sluipt het paleis uit..." }
        ]
      },
      {
        id: "act2",
        title: "Acte 2",
        scenes: [{ id: "s3", title: "De grot", text: "De ingang sluit achter hem..." }]
      }
    ]
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// ======= DOM refs =======
const boardEl = document.getElementById("board");

const addActBtn = document.getElementById("addActBtn");
const addSceneBtn = document.getElementById("addSceneBtn");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const resetBtn = document.getElementById("resetBtn");

const selectedPathEl = document.getElementById("selectedPath");
const sceneTitleEl = document.getElementById("sceneTitle");
const sceneTextEl = document.getElementById("sceneText");
const deleteSceneBtn = document.getElementById("deleteSceneBtn");

let selected = { actId: null, sceneId: null };

// ======= Helpers =======
function findAct(actId) {
  return state.acts.find(a => a.id === actId) || null;
}
function findScene(actId, sceneId) {
  const act = findAct(actId);
  if (!act) return null;
  return act.scenes.find(s => s.id === sceneId) || null;
}
function actTitleOrDefault(n) {
  return `Acte ${n}`;
}

function setSelected(actId, sceneId) {
  selected = { actId, sceneId };

  const scene = actId && sceneId ? findScene(actId, sceneId) : null;
  const act = actId ? findAct(actId) : null;

  const hasSelection = !!scene;

  // enable scene add when we have at least one act; and prefer a selected act if present
  addSceneBtn.disabled = state.acts.length === 0;

  sceneTitleEl.disabled = !hasSelection;
  sceneTextEl.disabled = !hasSelection;
  deleteSceneBtn.disabled = !hasSelection;

  if (!hasSelection) {
    selectedPathEl.textContent = "Selecteer een scene…";
    sceneTitleEl.value = "";
    sceneTextEl.value = "";
    render(); // update highlight off
    return;
  }

  selectedPathEl.textContent = `${act?.title ?? "Acte"} → ${scene.title}`;
  sceneTitleEl.value = scene.title;
  sceneTextEl.value = scene.text;

  render(); // update highlight on
}

// ======= Drag & Drop state rebuild =======
function rebuildFromDOM() {
  // Map all scenes (id -> scene object) from current state
  const flat = new Map();
  state.acts.forEach(a => a.scenes.forEach(s => flat.set(s.id, s)));

  const nextActs = state.acts.map(a => ({ ...a, scenes: [] }));

  nextActs.forEach(a => {
    const col = document.getElementById(`scenes-${a.id}`);
    const ids = col ? [...col.querySelectorAll(".scene")].map(el => el.dataset.sceneId) : [];
    a.scenes = ids.map(id => flat.get(id)).filter(Boolean);
  });

  state.acts = nextActs;
  saveState();

  // If selected scene moved to another act, fix selection actId
  if (selected.sceneId) {
    const newAct = state.acts.find(a => a.scenes.some(s => s.id === selected.sceneId));
    if (newAct) selected.actId = newAct.id;
  }
}

// ======= Render =======
function render() {
  boardEl.innerHTML = "";

  state.acts.forEach(act => {
    const actEl = document.createElement("div");
    actEl.className = "act";
    actEl.dataset.actId = act.id;

    const head = document.createElement("div");
    head.className = "actHead";

    const title = document.createElement("div");
    title.className = "actTitle";
    title.textContent = act.title;

    const headBtns = document.createElement("div");
    headBtns.style.display = "flex";
    headBtns.style.gap = "6px";

    const renameBtn = document.createElement("button");
    renameBtn.textContent = "Hernoem";
    renameBtn.onclick = () => {
      const newTitle = prompt("Nieuwe titel voor acte:", act.title);
      if (newTitle && newTitle.trim()) {
        act.title = newTitle.trim();
        saveState();
        render();
        // update editor path text if needed
        if (selected.sceneId && selected.actId === act.id) {
          const sc = findScene(selected.actId, selected.sceneId);
          if (sc) selectedPathEl.textContent = `${act.title} → ${sc.title}`;
        }
      }
    };

    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "Verwijder";
    delBtn.onclick = () => {
      if (!confirm(`Acte verwijderen: "${act.title}"? (scenes gaan ook weg)`)) return;
      state.acts = state.acts.filter(a => a.id !== act.id);
      if (selected.actId === act.id) setSelected(null, null);
      saveState();
      render();
    };

    headBtns.append(renameBtn, delBtn);
    head.append(title, headBtns);

    const scenesEl = document.createElement("div");
    scenesEl.className = "scenes";
    scenesEl.id = `scenes-${act.id}`;

    act.scenes.forEach(scene => {
      const sceneEl = document.createElement("div");
      sceneEl.className = "scene";
      sceneEl.dataset.sceneId = scene.id;

      if (selected.actId === act.id && selected.sceneId === scene.id) {
        sceneEl.classList.add("selected");
      }

      const t = document.createElement("div");
      t.textContent = scene.title;

      const small = document.createElement("div");
      small.className = "small";
      small.textContent = (scene.text || "").replace(/\s+/g, " ").slice(0, 90);

      sceneEl.append(t, small);
      sceneEl.onclick = () => setSelected(act.id, scene.id);

      scenesEl.appendChild(sceneEl);
    });

    actEl.append(head, scenesEl);
    boardEl.appendChild(actEl);
  });

  // Attach Sortable AFTER DOM is built
  state.acts.forEach(act => {
    const col = document.getElementById(`scenes-${act.id}`);
    if (!col) return;

    // Prevent double init if render() called again
    if (col._sortable) col._sortable.destroy();

    col._sortable = new Sortable(col, {
      group: "scenes",
      animation: 150,
      onEnd: () => {
        rebuildFromDOM();
        render();
      }
    });
  });

  addSceneBtn.disabled = state.acts.length === 0;
}

// ======= Actions =======
addActBtn.onclick = () => {
  const actId = uid();
  const title = actTitleOrDefault(state.acts.length + 1);
  state.acts.push({ id: actId, title, scenes: [] });
  saveState();
  // select new act (so addScene goes there)
  selected.actId = actId;
  selected.sceneId = null;
  render();
};

addSceneBtn.onclick = () => {
  if (state.acts.length === 0) return;

  // Add scene to selected act if possible, else first act
  const actId = selected.actId && findAct(selected.actId) ? selected.actId : state.acts[0].id;
  const act = findAct(actId);

  const sceneId = uid();
  const scene = { id: sceneId, title: "Nieuwe scene", text: "" };
  act.scenes.push(scene);

  saveState();
  render();
  setSelected(actId, sceneId);
};

sceneTitleEl.addEventListener("input", () => {
  const scene = findScene(selected.actId, selected.sceneId);
  if (!scene) return;
  scene.title = sceneTitleEl.value;
  saveState();
  render();
});

sceneTextEl.addEventListener("input", () => {
  const scene = findScene(selected.actId, selected.sceneId);
  if (!scene) return;
  scene.text = sceneTextEl.value;
  saveState();
  render();
});

deleteSceneBtn.onclick = () => {
  const act = findAct(selected.actId);
  const scene = findScene(selected.actId, selected.sceneId);
  if (!act || !scene) return;

  if (!confirm(`Scene verwijderen: "${scene.title}"?`)) return;

  act.scenes = act.scenes.filter(s => s.id !== scene.id);
  saveState();
  setSelected(null, null);
  render();
};

exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scriptboard.json";
  a.click();
  URL.revokeObjectURL(url);
};

importInput.onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data || !Array.isArray(data.acts)) {
    alert("Ongeldig bestand: verwacht { acts: [...] }");
    return;
  }
  state = data;
  saveState();
  setSelected(null, null);
  render();
  importInput.value = "";
};

resetBtn.onclick = () => {
  if (!confirm("Alles wissen en opnieuw beginnen?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  setSelected(null, null);
  render();
};

// ======= Init =======
render();
if (state.acts.length) selected.actId = state.acts[0].id;
