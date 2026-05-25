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
  visible: [],
  selectedId: "",
  query: "",
  type: "all",
  tag: "all",
  mastered: new Set(JSON.parse(localStorage.getItem("english-review-mastered") || "[]")),
};

const elements = {
  search: document.querySelector("#search-input"),
  tags: document.querySelector("#tag-filters"),
  entryList: document.querySelector("#entry-list"),
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
  bindEvents();
  state.items = await loadEntries();
  renderTagFilters();
  render();
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.type;
      document.querySelectorAll("[data-type]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });
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

function renderTagFilters() {
  const tags = ["all", ...new Set(state.items.flatMap((item) => item.tags))];
  elements.tags.innerHTML = "";

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${tag === state.tag ? " active" : ""}`;
    button.textContent = tag === "all" ? "全部标签" : tag;
    button.addEventListener("click", () => {
      state.tag = tag;
      elements.tags.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
    elements.tags.append(button);
  });
}

function render() {
  const visible = state.items.filter(matchesFilters);
  state.visible = visible;
  const phrases = visible.filter((item) => item.type === "phrase");
  const sentences = visible.filter((item) => item.type === "sentence");

  if (!visible.some((item) => item.id === state.selectedId)) {
    state.selectedId = visible[0]?.id || "";
  }

  renderEntryList(visible);
  renderDetail(visible.find((item) => item.id === state.selectedId));

  elements.phraseCount.textContent = phrases.length;
  elements.sentenceCount.textContent = sentences.length;
  elements.visibleCount.textContent = visible.length;
  elements.totalCount.textContent = state.items.length;
  elements.masteredCount.textContent = state.mastered.size;
  elements.empty.hidden = visible.length > 0;
}

function matchesFilters(item) {
  const typeMatches = state.type === "all" || item.type === state.type;
  const tagMatches = state.tag === "all" || item.tags.includes(state.tag);
  const queryMatches = !state.query || item.searchText.includes(state.query);
  return typeMatches && tagMatches && queryMatches;
}

function renderEntryList(items) {
  elements.entryList.innerHTML = "";

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `entry-button${item.id === state.selectedId ? " active" : ""}`;
    button.setAttribute("aria-pressed", item.id === state.selectedId ? "true" : "false");
    button.addEventListener("click", () => {
      state.selectedId = item.id;
      render();
    });

    const title = document.createElement("span");
    title.className = "entry-title";
    title.textContent = item.title;

    const meta = document.createElement("span");
    meta.className = "entry-meta";
    meta.textContent = `${item.typeLabel} · ${item.tags.slice(0, 2).join(", ") || "untagged"}`;

    button.append(title, meta);
    elements.entryList.append(button);
  });
}

function renderDetail(item) {
  elements.detailCard.innerHTML = "";

  if (!item) {
    elements.selectedPosition.textContent = "-";
    return;
  }

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

  const tagRow = card.querySelector(".tag-row");
  item.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tagRow.append(span);
  });

  const selectedIndex = state.visible.findIndex((visibleItem) => visibleItem.id === item.id);
  elements.selectedPosition.textContent = `${selectedIndex + 1}/${state.visible.length}`;
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
  render();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
