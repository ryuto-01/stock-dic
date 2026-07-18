const RELATION_TYPE_DETAILS = {
  prerequisite: { label: "先に理解", symbol: "①" },
  "calculated-from": { label: "計算に使う", symbol: "÷" },
  "compare-with": { label: "比較する", symbol: "⇄" },
  "used-with": { label: "一緒に確認", symbol: "+" },
  process: { label: "流れで理解", symbol: "→" },
  affects: { label: "影響を考える", symbol: "△" },
  "part-of": { label: "含まれる概念", symbol: "⊂" },
  related: { label: "その他の関連", symbol: "・" },
};

const RELATION_TYPE_ORDER = [
  "prerequisite",
  "calculated-from",
  "process",
  "compare-with",
  "used-with",
  "affects",
  "part-of",
  "related",
];

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
const relatedStatus = document.querySelector("#related-status");
const currentRelationTerm = document.querySelector("#current-relation-term");
const learningPathSection = document.querySelector("#learning-path-section");
const prerequisitePath = document.querySelector("#prerequisite-path");
const nextPath = document.querySelector("#next-path");
const comparePath = document.querySelector("#compare-path");
const relatedTerms = document.querySelector("#related-terms");
const relatedClustersSection = document.querySelector("#related-clusters-section");
const relatedClusters = document.querySelector("#related-clusters");

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

function createTermLink(term, className = "") {
  const link = createElement("a", className, term.name);
  link.href = `./detail.html?id=${encodeURIComponent(term.id)}`;
  return link;
}

function validateRelationships(relationships, termMap) {
  if (
    !relationships ||
    !Array.isArray(relationships.clusters) ||
    !Array.isArray(relationships.edges)
  ) {
    throw new TypeError("用語関係データが正しくありません。");
  }

  const clusterIds = new Set();
  relationships.clusters.forEach((cluster) => {
    if (
      !cluster.id ||
      !cluster.title ||
      !Array.isArray(cluster.termIds) ||
      clusterIds.has(cluster.id)
    ) {
      throw new Error("クラスター情報が正しくありません。");
    }

    cluster.termIds.forEach((termId) => {
      if (!termMap.has(termId)) {
        throw new Error(`存在しない用語ID「${termId}」があります。`);
      }
    });
    clusterIds.add(cluster.id);
  });

  const seenDirections = new Set();
  const seenPairs = new Set();
  relationships.edges.forEach((edge) => {
    if (
      !edge.id ||
      !clusterIds.has(edge.clusterId) ||
      !termMap.has(edge.from) ||
      !termMap.has(edge.to) ||
      !RELATION_TYPE_DETAILS[edge.type] ||
      edge.from === edge.to
    ) {
      throw new Error(`関係データ「${edge.id || "ID未設定"}」が正しくありません。`);
    }

    const directionKey = `${edge.clusterId}:${edge.from}:${edge.to}`;
    const reverseKey = `${edge.clusterId}:${edge.to}:${edge.from}`;
    if (seenDirections.has(directionKey) || seenPairs.has(reverseKey)) {
      throw new Error(`関係「${directionKey}」が重複しています。`);
    }

    seenDirections.add(directionKey);
    seenPairs.add(directionKey);
  });

  return relationships;
}

function getRelationEntries(term, termMap, relationships) {
  const typedEntries = new Map();

  if (relationships) {
    relationships.edges
      .filter((edge) => edge.from === term.id || edge.to === term.id)
      .forEach((edge) => {
        const isFrom = edge.from === term.id;
        const relatedId = isFrom ? edge.to : edge.from;
        if (!typedEntries.has(relatedId)) {
          typedEntries.set(relatedId, {
            term: termMap.get(relatedId),
            type: edge.type,
            label: isFrom ? edge.labelFrom : edge.labelTo,
            description: edge.description,
            direction: isFrom ? "from" : "to",
          });
        }
      });
  }

  const fallbackEntries = (term.relatedTerms || [])
    .filter((termId) => !typedEntries.has(termId) && termMap.has(termId))
    .map((termId) => ({
      term: termMap.get(termId),
      type: "related",
      label: "既存の関連用語",
      description: "用語辞典で関連する用語として登録されています。",
      direction: "related",
    }));

  return [...typedEntries.values(), ...fallbackEntries];
}

function renderCurrentTerm(term) {
  const label = createElement("span", "current-relation-label", "現在の用語");
  const heading = createElement("h3", "", term.name);
  const reading = createElement("p", "reading", formatReading(term));
  const summary = createElement("p", "", term.summary);
  currentRelationTerm.replaceChildren(label, heading, reading, summary);
}

function createRelatedCard(entry) {
  const card = document.createElement("article");
  card.className = `typed-related-card relation-type-${entry.type}`;
  const heading = document.createElement("h5");
  heading.append(createTermLink(entry.term));
  const relationLabel = createElement("p", "typed-relation-label", entry.label);
  const description = createElement("p", "typed-relation-description", entry.description);
  const summary = createElement("p", "typed-related-summary", entry.term.summary);
  const detailLink = createElement("a", "related-detail-link", "詳しく学ぶ →");
  detailLink.href = `./detail.html?id=${encodeURIComponent(entry.term.id)}`;
  detailLink.setAttribute("aria-label", `${entry.term.name}を詳しく学ぶ`);
  card.append(heading, relationLabel, description, summary, detailLink);
  return card;
}

function renderTypedRelations(entries) {
  const groups = document.createDocumentFragment();

  RELATION_TYPE_ORDER.forEach((type) => {
    const typeEntries = entries.filter((entry) => entry.type === type);
    if (typeEntries.length === 0) {
      return;
    }

    const typeDetails = RELATION_TYPE_DETAILS[type];
    const group = document.createElement("section");
    group.className = `typed-related-group relation-type-${type}`;
    const heading = createElement(
      "h4",
      "typed-related-group-heading",
      `${typeDetails.symbol} ${typeDetails.label}`,
    );
    const grid = document.createElement("div");
    grid.className = "typed-related-grid";
    typeEntries.forEach((entry) => grid.append(createRelatedCard(entry)));
    group.append(heading, grid);
    groups.append(group);
  });

  relatedTerms.replaceChildren(groups);
}

function setLearningPath(card, entries) {
  const uniqueTerms = [...new Map(entries.map((entry) => [entry.term.id, entry.term])).values()];
  if (uniqueTerms.length === 0) {
    card.hidden = true;
    return false;
  }

  const list = card.querySelector("ul");
  const items = document.createDocumentFragment();
  uniqueTerms.forEach((term) => {
    const item = document.createElement("li");
    item.append(createTermLink(term));
    items.append(item);
  });
  list.replaceChildren(items);
  card.hidden = false;
  return true;
}

function renderLearningPaths(entries) {
  const prerequisiteEntries = entries.filter(
    (entry) =>
      entry.direction === "to" &&
      ["prerequisite", "calculated-from", "process", "part-of"].includes(entry.type),
  );
  const nextEntries = entries.filter(
    (entry) =>
      entry.direction === "from" &&
      ["prerequisite", "calculated-from", "process", "part-of", "affects"].includes(
        entry.type,
      ),
  );
  const compareEntries = entries.filter((entry) => entry.type === "compare-with");

  const hasPaths = [
    setLearningPath(prerequisitePath, prerequisiteEntries),
    setLearningPath(nextPath, nextEntries),
    setLearningPath(comparePath, compareEntries),
  ].some(Boolean);
  learningPathSection.hidden = !hasPaths;
}

function renderRelatedClusters(term, relationships) {
  if (!relationships) {
    relatedClustersSection.hidden = true;
    return;
  }

  const clusters = relationships.clusters.filter((cluster) =>
    cluster.termIds.includes(term.id),
  );
  if (clusters.length === 0) {
    relatedClustersSection.hidden = true;
    return;
  }

  const links = document.createDocumentFragment();
  clusters.forEach((cluster) => {
    const link = createElement("a", "related-cluster-link", cluster.title);
    link.href = `./relations.html?cluster=${encodeURIComponent(cluster.id)}`;
    link.append(createElement("span", "", `${cluster.termIds.length}語のつながりを見る →`));
    links.append(link);
  });
  relatedClusters.replaceChildren(links);
  relatedClustersSection.hidden = false;
}

function renderRelatedTerms(term, allTerms, relationships, relationshipLoadFailed) {
  const termMap = new Map(allTerms.map((candidate) => [candidate.id, candidate]));
  const entries = getRelationEntries(term, termMap, relationships);

  if (entries.length === 0) {
    relatedSection.hidden = true;
    return;
  }

  renderCurrentTerm(term);
  renderLearningPaths(entries);
  renderTypedRelations(entries);
  renderRelatedClusters(term, relationships);

  if (relationshipLoadFailed) {
    relatedStatus.textContent =
      "詳しい関係データを読み込めなかったため、既存の関連用語を表示しています。";
    relatedStatus.hidden = false;
  } else {
    relatedStatus.hidden = true;
  }

  relatedSection.hidden = false;
}

function renderTerm(term, allTerms, relationships, relationshipLoadFailed) {
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

  renderRelatedTerms(term, allTerms, relationships, relationshipLoadFailed);
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

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path}を読み込めませんでした。`);
  }

  return response.json();
}

async function loadOptionalRelationships(termMap) {
  try {
    const relationships = await fetchJson("./data/relationships.json");
    return {
      relationships: validateRelationships(relationships, termMap),
      failed: false,
    };
  } catch (error) {
    console.warn("詳しい用語関係データを利用できません。", error);
    return { relationships: null, failed: true };
  }
}

async function loadTerm() {
  const termId = new URLSearchParams(window.location.search).get("id");

  if (!termId) {
    showDetailError("表示する用語が指定されていません。用語一覧から選び直してください。");
    return;
  }

  try {
    const terms = await fetchJson("./data/terms.json");
    if (!Array.isArray(terms)) {
      throw new TypeError("用語データが配列ではありません。");
    }

    const term = terms.find((candidate) => candidate.id === termId);
    if (!term) {
      showDetailError("指定された用語が見つかりません。用語一覧から選び直してください。");
      return;
    }

    const termMap = new Map(terms.map((candidate) => [candidate.id, candidate]));
    const relationshipResult = await loadOptionalRelationships(termMap);
    renderTerm(
      term,
      terms,
      relationshipResult.relationships,
      relationshipResult.failed,
    );
  } catch (error) {
    console.error("用語データの読み込みに失敗しました。", error);
    showDetailError(
      "用語を読み込めませんでした。時間をおいて、もう一度お試しください。",
    );
  }
}

loadTerm();
