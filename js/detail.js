const detailStatus = document.querySelector("#detail-status");
const termDetail = document.querySelector("#term-detail");
const breadcrumbCurrent = document.querySelector("#breadcrumb-current");
const detailCategory = document.querySelector("#detail-category");
const detailName = document.querySelector("#detail-name");
const detailReading = document.querySelector("#detail-reading");
const detailSummary = document.querySelector("#detail-summary");
const detailDescription = document.querySelector("#detail-description");
const formulaSection = document.querySelector("#formula-section");
const detailFormula = document.querySelector("#detail-formula");
const detailExample = document.querySelector("#detail-example");
const detailCaution = document.querySelector("#detail-caution");
const relatedSection = document.querySelector("#related-section");
const relatedTerms = document.querySelector("#related-terms");

function formatReading(term) {
  if (term.japaneseName && term.japaneseName !== term.name) {
    return `${term.reading}／${term.japaneseName}`;
  }

  return term.reading;
}

function createRelatedLink(term) {
  const link = document.createElement("a");
  link.className = "related-card";
  link.href = `./detail.html?id=${encodeURIComponent(term.id)}`;

  const name = document.createElement("strong");
  name.textContent = term.name;

  const summary = document.createElement("span");
  summary.textContent = term.summary;

  link.append(name, summary);
  return link;
}

function renderRelatedTerms(term, allTerms) {
  const related = term.relatedTerms
    .map((id) => allTerms.find((candidate) => candidate.id === id))
    .filter(Boolean);

  if (related.length === 0) {
    relatedSection.hidden = true;
    return;
  }

  const links = document.createDocumentFragment();
  related.forEach((relatedTerm) => {
    links.append(createRelatedLink(relatedTerm));
  });

  relatedTerms.replaceChildren(links);
  relatedSection.hidden = false;
}

function renderTerm(term, allTerms) {
  document.title = `${term.name}とは？｜はじめての株式投資辞典`;
  breadcrumbCurrent.textContent = term.name;
  detailCategory.textContent = term.category;
  detailName.textContent = term.name;
  detailReading.textContent = formatReading(term);
  detailSummary.textContent = term.summary;
  detailDescription.textContent = term.description;
  detailExample.textContent = term.example;
  detailCaution.textContent = term.caution;

  if (term.formula) {
    detailFormula.textContent = term.formula;
    formulaSection.hidden = false;
  } else {
    formulaSection.hidden = true;
  }

  renderRelatedTerms(term, allTerms);
  detailStatus.hidden = true;
  termDetail.hidden = false;
}

function showDetailError(message) {
  document.title = "用語が見つかりません｜はじめての株式投資辞典";
  detailStatus.textContent = message;
  detailStatus.classList.add("is-error");
  detailStatus.hidden = false;
  termDetail.hidden = true;
  relatedSection.hidden = true;
}

async function loadTerm() {
  const termId = new URLSearchParams(window.location.search).get("id");

  if (!termId) {
    showDetailError("表示する用語が指定されていません。用語一覧から選び直してください。");
    return;
  }

  try {
    const response = await fetch("./data/terms.json");

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const terms = await response.json();

    if (!Array.isArray(terms)) {
      throw new TypeError("用語データが配列ではありません。");
    }

    const term = terms.find((candidate) => candidate.id === termId);

    if (!term) {
      showDetailError("指定された用語が見つかりません。用語一覧から選び直してください。");
      return;
    }

    renderTerm(term, terms);
  } catch (error) {
    console.error("用語データの読み込みに失敗しました。", error);
    showDetailError(
      "用語を読み込めませんでした。時間をおいて、もう一度お試しください。",
    );
  }
}

loadTerm();
