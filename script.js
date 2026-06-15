const DATA_SOURCES = [
  { type: "phrase", label: "词组", url: "entries/phrases.md" },
  { type: "phrase", label: "词组", url: "entries/phrases-2026-06-15.md" },
  { type: "sentence", label: "好句", url: "entries/sentences.md" },
  { type: "sentence", label: "好句", url: "entries/sentences-2026-06-15.md" },
];

const FIELD_LABELS = {
  meaning: "中文理解",
  example: "来源句",
  usage: "使用场景",
  takeaway: "可借鉴表达",
  date: "日期",
};

const MASTERED_KEY = "english-review-mastered";
const PRIORITY_KEY = "english-review-priority";
const FILTER_KEY = "english-review-filter";

const state = {
  items: [],
  mastered: new Set(JSON.parse(localStorage.getItem(MASTERED_KEY) || "[]")),
  priority: new Set(JSON.parse(localStorage.getItem(PRIORITY_KEY) || "[]")),
  filter: sessionStorage.getItem(FILTER_KEY) || "all",
};

const elements = {
  phraseList: document.querySelector("#phrase-list"),
  sentenceList: document.querySelector("#sentence-list"),
  detailCard: document.querySelector("#detail-card"),
  phraseCount: document.querySelector("#phrase-count"),
  sentenceCount: document.querySelector("#sentence-count"),
  visibleCount: document.querySelector("#visible-count"),
  selectedPosition: document.querySelector("#selected-position"),
  totalCount: document.querySelector("#total-count"),
  masteredCount: document.querySelector("#mastered-count"),
  priorityCount: document.querySelector("#priority-count"),
  listHeading: document.querySelector("#list-heading"),
  empty: document.querySelector("#empty-state"),
  template: document.querySelector("#card-template"),
};

init();

async function init() {
  state.items = await loadEntries();
  if (elements.detailCard) {
    document.querySelector("#back-button")?.addEventListener("click", () => {
      if (history.length > 1) {
        history.back();
      } else {
        location.href = "index.html";
      }
    });
    renderDetailPage();
  } else {
    bindFilterButtons();
    renderListPage();
  }
}

async function loadEntries() {
  const groups = await Promise.all(DATA_SOURCES.map(async (source) => {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Cannot load ${source.url}`);
    }
    const text = await response.text();
    return parseMarkdownEntries(text, source);
  }));

  return groups.flat();
}

function parseMarkdownEntries(markdown, source) {
  return markdown
    .split(/\n(?=##\s+)/)
    .map((block) => parseBlock(block, source))
    .filter(Boolean);
}

function parseBlock(block, source) {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const titleLine = lines.find((line) => line.startsWith("## "));
  if (!titleLine) return null;

  const item = {
    type: source.type,
    typeLabel: source.label,
    title: titleLine.replace(/^##\s+/, "").trim(),
    meaning: "",
    example: "",
    usage: "",
    takeaway: "",
    tags: [],
    date: "",
  };

  lines.forEach((line) => {
    const match = line.match(/^-\s*([^:：]+)[:：]\s*(.*)$/);
    if (!match) return;

    const key = normalizeKey(match[1]);
    const value = match[2].trim();
    if (key === "tags") {
      item.tags = value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
    } else if (key) {
      item[key] = value;
    }
  });

  item.id = `${item.type}:${slugify(item.title)}:${item.date || "undated"}`;
  item.searchText = [
    item.title,
    item.meaning,
    item.example,
    item.usage,
    item.takeaway,
    item.tags.join(" "),
    item.date,
  ].join(" ").toLowerCase();

  return item;
}

function normalizeKey(rawKey) {
  const key = rawKey.trim().toLowerCase();
  const aliases = {
    "中文理解": "meaning",
    meaning: "meaning",
    "来源句": "example",
    example: "example",
    "使用场景": "usage",
    usage: "usage",
    "可借鉴表达": "takeaway",
    takeaway: "takeaway",
    "标签": "tags",
    tags: "tags",
    "日期": "date",
    date: "date",
  };
  return aliases[key] || "";
}

function renderListPage() {
  const visibleItems = getVisibleItems();
  const phrases = visibleItems.filter((item) => item.type === "phrase");
  const sentences = visibleItems.filter((item) => item.type === "sentence");
  renderEntryList(elements.phraseList, phrases);
  renderEntryList(elements.sentenceList, sentences);

  elements.phraseCount.textContent = phrases.length;
  elements.sentenceCount.textContent = sentences.length;
  elements.visibleCount.textContent = visibleItems.length;
  elements.totalCount.textContent = state.items.length;
  elements.masteredCount.textContent = countExistingIds(state.mastered);
  elements.priorityCount.textContent = countExistingIds(state.priority);
  elements.listHeading.textContent = state.filter === "mastered"
    ? "已掌握"
    : state.filter === "priority"
      ? "重点"
      : "全部记录";
  elements.empty.textContent = state.filter === "all"
    ? "还没有记录。"
    : state.filter === "mastered"
      ? "还没有标记为已掌握的词条。"
      : "还没有标记为重点的词条。";
  elements.empty.hidden = visibleItems.length > 0;
  document.querySelectorAll(".stat-filter").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function renderEntryList(container, items) {
  container.innerHTML = "";
  container.closest(".entry-section").hidden = items.length === 0;

  items.forEach((item) => {
    const link = document.createElement("a");
    link.className = "entry-link";
    link.href = `detail.html?id=${encodeURIComponent(item.id)}`;

    const title = document.createElement("span");
    title.className = "entry-title";
    title.textContent = item.title;

    const meta = document.createElement("span");
    meta.className = "entry-meta";
    const statuses = [];
    if (state.priority.has(item.id)) statuses.push("重点");
    if (state.mastered.has(item.id)) statuses.push("已掌握");
    meta.textContent = statuses.join(" · ");
    meta.hidden = statuses.length === 0;

    link.append(title, meta);
    container.append(link);
  });
}

function renderDetailPage() {
  const id = new URLSearchParams(location.search).get("id");
  const item = state.items.find((entry) => entry.id === id);
  renderDetail(item);
}

function renderDetail(item) {
  elements.detailCard.innerHTML = "";

  if (!item) {
    elements.selectedPosition.textContent = "-";
    elements.empty.hidden = false;
    return;
  }

  elements.empty.hidden = true;
  document.title = `${item.title} - English Review`;
  document.querySelector("#detail-heading").textContent = item.typeLabel;

  const card = elements.template.content.firstElementChild.cloneNode(true);
  const isMastered = state.mastered.has(item.id);
  const isPriority = state.priority.has(item.id);
  const masteryButton = card.querySelector(".mastery-button");
  const priorityButton = card.querySelector(".priority-button");

  card.querySelector(".card-type").textContent = item.typeLabel;
  card.querySelector("h3").textContent = item.title;
  masteryButton.textContent = isMastered ? "已掌握" : "标记已掌握";
  masteryButton.classList.toggle("is-mastered", isMastered);
  masteryButton.addEventListener("click", () => toggleMastery(item.id));
  priorityButton.textContent = isPriority ? "重点" : "标记重点";
  priorityButton.classList.toggle("is-priority", isPriority);
  priorityButton.addEventListener("click", () => togglePriority(item.id));

  const details = card.querySelector("dl");
  getDetailRows(item).forEach(([label, value]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    details.append(dt, dd);
  });

  const selectedIndex = state.items.findIndex((visibleItem) => visibleItem.id === item.id);
  elements.selectedPosition.textContent = `${selectedIndex + 1}/${state.items.length}`;
  elements.detailCard.append(card);
}

function getDetailRows(item) {
  const keys = item.type === "phrase"
    ? ["meaning", "example", "usage", "date"]
    : ["meaning", "takeaway", "usage", "date"];

  return keys
    .filter((key) => item[key])
    .map((key) => [FIELD_LABELS[key], item[key]]);
}

function toggleMastery(id) {
  if (state.mastered.has(id)) {
    state.mastered.delete(id);
  } else {
    state.mastered.add(id);
  }

  localStorage.setItem(MASTERED_KEY, JSON.stringify([...state.mastered]));
  if (elements.detailCard) {
    renderDetail(state.items.find((entry) => entry.id === id));
  } else {
    renderListPage();
  }
}

function togglePriority(id) {
  if (state.priority.has(id)) {
    state.priority.delete(id);
  } else {
    state.priority.add(id);
  }

  localStorage.setItem(PRIORITY_KEY, JSON.stringify([...state.priority]));
  if (elements.detailCard) {
    renderDetail(state.items.find((entry) => entry.id === id));
  } else {
    renderListPage();
  }
}

function bindFilterButtons() {
  const allowedFilters = new Set(["all", "mastered", "priority"]);
  if (!allowedFilters.has(state.filter)) state.filter = "all";

  document.querySelectorAll(".stat-filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      sessionStorage.setItem(FILTER_KEY, state.filter);
      renderListPage();
    });
  });
}

function getVisibleItems() {
  if (state.filter === "mastered") {
    return state.items.filter((item) => state.mastered.has(item.id));
  }
  if (state.filter === "priority") {
    return state.items.filter((item) => state.priority.has(item.id));
  }
  return state.items;
}

function countExistingIds(idSet) {
  return state.items.reduce((count, item) => count + Number(idSet.has(item.id)), 0);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
