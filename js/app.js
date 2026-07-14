const termGrid = document.querySelector("#term-grid");
const termCount = document.querySelector("#term-count");
const totalCount = document.querySelector("#total-count");
const termsStatus = document.querySelector("#terms-status");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const resetFiltersButton = document.querySelector("#reset-filters");

let allTerms = [];

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function formatReading(term) {
  if (term.japaneseName && term.japaneseName !== term.name) {
    return `${term.reading}／${term.japaneseName}`;
  }

  return term.reading;
}

function createTermCard(term) {
  const card = document.createElement("article");
  card.className = "term-card";

  const link = document.createElement("a");
  link.className = "term-card-link";
  link.href = `./detail.html?id=${encodeURIComponent(term.id)}`;
  link.setAttribute("aria-label", `${term.name}の詳細を見る`);

  link.append(
    createElement("span", "category-badge", term.category),
    createElement("h3", "", term.name),
    createElement("p", "reading", formatReading(term)),
    createElement("p", "term-summary", term.summary),
  );

  if (term.formula) {
    link.append(createElement("p", "formula", term.formula));
  }

  link.append(createElement("span", "detail-link-label", "詳しく見る →"));
  card.append(link);

  return card;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP");
}

function createSearchText(term) {
  return normalizeText(
    [
      term.name,
      term.reading,
      term.japaneseName,
      term.category,
      term.summary,
      term.description,
    ].join(" "),
  );
}

function getFilteredTerms() {
  const keywords = normalizeText(searchInput.value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const selectedCategory = categoryFilter.value;

  return allTerms.filter((term) => {
    const matchesCategory =
      !selectedCategory || term.category === selectedCategory;
    const searchText = createSearchText(term);
    const matchesKeywords = keywords.every((keyword) =>
      searchText.includes(keyword),
    );

    return matchesCategory && matchesKeywords;
  });
}

function renderTerms(terms) {
  const cards = document.createDocumentFragment();

  terms.forEach((term) => {
    cards.append(createTermCard(term));
  });

  termGrid.replaceChildren(cards);
  termCount.textContent = String(terms.length);
  totalCount.textContent = `／全${allTerms.length}語`;
  termGrid.setAttribute("aria-busy", "false");
  termsStatus.classList.remove("is-error");

  if (terms.length === 0) {
    termsStatus.textContent =
      "条件に一致する用語がありません。キーワードやカテゴリーを変更してください。";
    termsStatus.hidden = false;
    return;
  }

  termsStatus.hidden = true;
}

function applyFilters() {
  renderTerms(getFilteredTerms());
}

function populateCategories(terms) {
  const categories = [...new Set(terms.map((term) => term.category))];

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  });
}

function showLoadError() {
  termCount.textContent = "0";
  totalCount.textContent = "";
  termGrid.setAttribute("aria-busy", "false");
  termsStatus.textContent =
    "用語を読み込めませんでした。時間をおいて、もう一度お試しください。";
  termsStatus.classList.add("is-error");
  termsStatus.hidden = false;
}

async function loadTerms() {
  try {
    const response = await fetch("./data/terms.json");

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const terms = await response.json();

    if (!Array.isArray(terms)) {
      throw new TypeError("用語データが配列ではありません。");
    }

    allTerms = terms;
    populateCategories(allTerms);
    renderTerms(allTerms);
  } catch (error) {
    console.error("用語データの読み込みに失敗しました。", error);
    showLoadError();
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyFilters();
});

searchInput.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

resetFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  applyFilters();
  searchInput.focus();
});

loadTerms();
