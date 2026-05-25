const DATA_SOURCES = [
  { type: "phrase", label: "词组", url: "entries/phrases.md" },
  { type: "sentence", label: "好句", url: "entries/sentences.md" },
];

const FIELD_LABELS = {
  meaning: "中文理解",
  example: "来源句",
  usage: "使用场景",
  takeaway: "可借鉴表达",
  date: "日期",
};

const state = {
  items: [],
  mastered: new Set(JSON.parse(localStorage.getItem("english-review-mastered") || "[]")),
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
  empty: document.querySelector("#empty-state"),
  template: document.querySelector("#card-template"),
};

init();

async function init() {
  state.items = await loadEntries();
  if (elements.detailCard) {
    renderDetailPage();
  } else {
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
  const phrases = state.items.filter((item) => item.type === "phrase");
  const sentences = state.items.filter((item) => item.type === "sentence");
  renderEntryList(elements.phraseList, phrases);
  renderEntryList(elements.sentenceList, sentences);

  elements.phraseCount.textContent = phrases.length;
  elements.sentenceCount.textContent = sentences.length;
  elements.visibleCount.textContent = state.items.length;
  elements.totalCount.textContent = state.items.length;
  elements.masteredCount.textContent = state.mastered.size;
  elements.empty.hidden = state.items.length > 0;
}

function renderEntryList(container, items) {
  container.innerHTML = "";

  items.forEach((item) => {
    const link = document.createElement("a");
    link.className = "entry-link";
    link.href = `detail.html?id=${encodeURIComponent(item.id)}`;

    const title = document.createElement("span");
    title.className = "entry-title";
    title.textContent = item.title;

    const meta = document.createElement("span");
    meta.className = "entry-meta";
    meta.textContent = item.typeLabel;

    link.append(title, meta);
    container.append(link);
  });
}

function renderDetailPage() {
  document.querySelector("#back-button")?.addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
    } else {
      location.href = "index.html";
    }
  });

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
  const button = card.querySelector(".mastery-button");

  card.querySelector(".card-type").textContent = item.typeLabel;
  card.querySelector("h3").textContent = item.title;
  button.textContent = isMastered ? "已掌握" : "待复习";
  button.classList.toggle("is-mastered", isMastered);
  button.addEventListener("click", () => toggleMastery(item.id));

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

  localStorage.setItem("english-review-mastered", JSON.stringify([...state.mastered]));
  if (elements.detailCard) {
    renderDetailPage();
  } else {
    renderListPage();
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
