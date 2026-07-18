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

const VISUAL_TYPE_LABELS = {
  "process-flow": "フロー図",
  "formula-flow": "計算関係図",
  "hierarchy-map": "階層・関係図",
  timeline: "タイムライン",
  "cycle-flow": "循環フロー",
  "comparison-flow": "比較フロー",
};

const loadStatus = document.querySelector("#relations-load-status");
const relationsContent = document.querySelector("#relations-content");
const relationsError = document.querySelector("#relations-error");
const relationsErrorMessage = document.querySelector("#relations-error-message");
const clusterCount = document.querySelector("#cluster-count");
const clusterNavigation = document.querySelector("#cluster-navigation");
const clusterParameterNotice = document.querySelector("#cluster-parameter-notice");
const clusterDetail = document.querySelector("#cluster-detail");
const clusterNumber = document.querySelector("#cluster-number");
const clusterTitle = document.querySelector("#cluster-title");
const clusterSummary = document.querySelector("#cluster-summary");
const clusterTermCount = document.querySelector("#cluster-term-count");
const clusterVisualTitle = document.querySelector("#cluster-visual-title");
const clusterVisualType = document.querySelector("#cluster-visual-type");
const clusterVisualDescription = document.querySelector("#cluster-visual-description");
const clusterVisual = document.querySelector("#cluster-visual");
const recommendedOrder = document.querySelector("#recommended-order");
const relationshipList = document.querySelector("#relationship-list");
const comparisonBody = document.querySelector("#comparison-body");
const taxNotice = document.querySelector("#tax-notice");
const relationshipLegendList = document.querySelector("#relationship-legend-list");

let termMap = new Map();
let clusterMap = new Map();
let edgesByCluster = new Map();

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createTermLink(term, className = "") {
  const link = createElement("a", className, term.name);
  link.href = `./detail.html?id=${encodeURIComponent(term.id)}`;
  return link;
}

function fetchJson(path) {
  return fetch(path).then((response) => {
    if (!response.ok) {
      throw new Error(`${path}を読み込めませんでした。`);
    }

    return response.json();
  });
}

function validateRelationships(relationships, terms) {
  if (!Array.isArray(terms)) {
    throw new TypeError("用語データが正しくありません。");
  }

  if (
    !relationships ||
    !Array.isArray(relationships.clusters) ||
    !Array.isArray(relationships.edges)
  ) {
    throw new TypeError("用語関係データが正しくありません。");
  }

  termMap = new Map(terms.map((term) => [term.id, term]));
  const seenClusterIds = new Set();
  const seenEdgeIds = new Set();
  const seenDirections = new Set();
  const seenPairs = new Set();

  relationships.clusters.forEach((cluster) => {
    if (
      !cluster.id ||
      !cluster.title ||
      !cluster.summary ||
      !Array.isArray(cluster.termIds) ||
      cluster.termIds.length === 0
    ) {
      throw new Error("タイトル・説明・用語がそろっていないクラスターがあります。");
    }

    if (seenClusterIds.has(cluster.id)) {
      throw new Error(`クラスターID「${cluster.id}」が重複しています。`);
    }

    seenClusterIds.add(cluster.id);
    const clusterTermIds = new Set(cluster.termIds);
    const referencedIds = [
      ...cluster.termIds,
      ...(cluster.recommendedOrder || []),
      ...(cluster.comparisonTermIds || []),
    ];

    referencedIds.forEach((termId) => {
      if (!termMap.has(termId)) {
        throw new Error(`用語データに存在しないID「${termId}」があります。`);
      }
    });

    [...(cluster.recommendedOrder || []), ...(cluster.comparisonTermIds || [])].forEach(
      (termId) => {
        if (!clusterTermIds.has(termId)) {
          throw new Error(
            `クラスター「${cluster.id}」の表示用ID「${termId}」が用語一覧に含まれていません。`,
          );
        }
      },
    );
  });

  clusterMap = new Map(relationships.clusters.map((cluster) => [cluster.id, cluster]));
  edgesByCluster = new Map(relationships.clusters.map((cluster) => [cluster.id, []]));

  relationships.edges.forEach((edge) => {
    if (!edge.id || !edge.clusterId || !edge.from || !edge.to || !edge.type) {
      throw new Error("必須項目が不足している関係データがあります。");
    }

    if (!RELATION_TYPE_DETAILS[edge.type]) {
      throw new Error(`未対応の関係タイプ「${edge.type}」があります。`);
    }

    if (seenEdgeIds.has(edge.id)) {
      throw new Error(`関係ID「${edge.id}」が重複しています。`);
    }

    if (edge.from === edge.to) {
      throw new Error(`用語「${edge.from}」が自分自身を参照しています。`);
    }

    const cluster = clusterMap.get(edge.clusterId);
    if (!cluster) {
      throw new Error(`存在しないクラスターID「${edge.clusterId}」があります。`);
    }

    if (!termMap.has(edge.from) || !termMap.has(edge.to)) {
      throw new Error(`関係「${edge.id}」に存在しない用語IDがあります。`);
    }

    if (!cluster.termIds.includes(edge.from) || !cluster.termIds.includes(edge.to)) {
      throw new Error(`関係「${edge.id}」の用語がクラスターに含まれていません。`);
    }

    const directionKey = `${edge.clusterId}:${edge.from}:${edge.to}`;
    const reverseKey = `${edge.clusterId}:${edge.to}:${edge.from}`;
    if (seenDirections.has(directionKey)) {
      throw new Error(`同じ向きの関係「${directionKey}」が重複しています。`);
    }

    if (seenPairs.has(reverseKey)) {
      throw new Error(`逆向きの関係「${directionKey}」が重複しています。`);
    }

    seenEdgeIds.add(edge.id);
    seenDirections.add(directionKey);
    seenPairs.add(directionKey);
    edgesByCluster.get(edge.clusterId).push(edge);
  });

  return [...relationships.clusters].sort(
    (firstCluster, secondCluster) => firstCluster.order - secondCluster.order,
  );
}

function renderClusterNavigation(clusters, activeCluster) {
  const navigationItems = document.createDocumentFragment();

  clusters.forEach((cluster) => {
    const link = createElement("a", "cluster-navigation-link", cluster.title);
    link.href = `./relations.html?cluster=${encodeURIComponent(cluster.id)}`;
    if (cluster.id === activeCluster.id) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "true");
    }

    const count = createElement("span", "", `${cluster.termIds.length}語`);
    link.append(count);
    navigationItems.append(link);
  });

  clusterNavigation.replaceChildren(navigationItems);
  clusterCount.textContent = `全${clusters.length}クラスター`;
}

function getVisualEdges(cluster, edges) {
  const preferredTypes = {
    "process-flow": ["process", "prerequisite", "used-with"],
    "formula-flow": ["process", "calculated-from"],
    "hierarchy-map": ["part-of", "calculated-from", "compare-with"],
    timeline: ["process"],
    "cycle-flow": ["process", "part-of", "affects"],
    "comparison-flow": ["part-of", "compare-with", "affects"],
  }[cluster.visualType] || Object.keys(RELATION_TYPE_DETAILS);

  const preferredEdges = edges.filter((edge) => preferredTypes.includes(edge.type));
  return preferredEdges.length > 0 ? preferredEdges : edges;
}

function createVisualEdge(edge) {
  const item = document.createElement("li");
  item.className = `visual-edge relation-type-${edge.type}`;
  const from = createTermLink(termMap.get(edge.from), "visual-term-node");
  const connector = document.createElement("div");
  connector.className = "visual-connector";
  connector.append(
    createElement(
      "span",
      "relation-symbol",
      RELATION_TYPE_DETAILS[edge.type].symbol,
    ),
    createElement("strong", "", edge.labelFrom),
    createElement("small", "", RELATION_TYPE_DETAILS[edge.type].label),
  );
  const to = createTermLink(termMap.get(edge.to), "visual-term-node");
  item.append(from, connector, to);
  return item;
}

function renderVisual(cluster, edges) {
  const visualEdges = getVisualEdges(cluster, edges);
  const list = document.createElement("ol");
  list.className = `visual-edge-list visual-${cluster.visualType}`;
  visualEdges.forEach((edge) => list.append(createVisualEdge(edge)));

  clusterVisual.className = `cluster-visual visual-${cluster.visualType}`;
  clusterVisual.setAttribute(
    "aria-label",
    `${cluster.visualTitle}。${cluster.visualDescription}`,
  );
  clusterVisual.replaceChildren(list);
}

function renderRecommendedOrder(cluster) {
  const items = document.createDocumentFragment();
  cluster.recommendedOrder.forEach((termId, index) => {
    const term = termMap.get(termId);
    const item = document.createElement("li");
    const number = createElement("span", "recommended-order-number", String(index + 1));
    number.setAttribute("aria-hidden", "true");
    const content = document.createElement("div");
    content.append(
      createTermLink(term, "recommended-order-link"),
      createElement("p", "", term.summary),
    );
    item.append(number, content);
    items.append(item);
  });

  recommendedOrder.replaceChildren(items);
}

function createRelationshipCard(edge) {
  const card = document.createElement("article");
  card.className = `relationship-card relation-type-${edge.type}`;
  const type = RELATION_TYPE_DETAILS[edge.type];
  const badge = createElement("span", "relationship-type-badge", `${type.symbol} ${type.label}`);
  const relationship = document.createElement("p");
  relationship.className = "relationship-pair";
  relationship.append(
    createTermLink(termMap.get(edge.from)),
    createElement("span", "relationship-arrow", "→"),
    createElement("strong", "", edge.labelFrom),
    createElement("span", "relationship-arrow", "→"),
    createTermLink(termMap.get(edge.to)),
  );
  card.append(badge, relationship, createElement("p", "relationship-description", edge.description));
  return card;
}

function renderRelationshipList(edges) {
  if (edges.length === 0) {
    relationshipList.replaceChildren(
      createElement("p", "relations-empty", "このクラスターには関係説明が登録されていません。"),
    );
    return;
  }

  const cards = document.createDocumentFragment();
  edges.forEach((edge) => cards.append(createRelationshipCard(edge)));
  relationshipList.replaceChildren(cards);
}

function createComparisonCell(label, text) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = text;
  return cell;
}

function renderComparison(cluster) {
  const rows = document.createDocumentFragment();
  cluster.comparisonTermIds.forEach((termId) => {
    const term = termMap.get(termId);
    const row = document.createElement("tr");
    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.dataset.label = "用語名";
    nameCell.append(createTermLink(term));
    row.append(
      nameCell,
      createComparisonCell("何を見るか", term.summary),
      createComparisonCell("計算式", term.formula || "固有の計算式はありません"),
      createComparisonCell("初心者が注意したいこと", term.caution),
    );
    rows.append(row);
  });

  comparisonBody.replaceChildren(rows);
}

function renderLegend() {
  const items = document.createDocumentFragment();
  Object.entries(RELATION_TYPE_DETAILS).forEach(([type, details]) => {
    const item = document.createElement("li");
    item.className = `relation-type-${type}`;
    item.append(
      createElement("span", "relation-symbol", details.symbol),
      createElement("strong", "", details.label),
    );
    items.append(item);
  });
  relationshipLegendList.replaceChildren(items);
}

function renderCluster(cluster) {
  const edges = edgesByCluster.get(cluster.id) || [];
  document.title = `${cluster.title}｜株式用語つながりマップ`;
  clusterNumber.textContent = `CLUSTER ${cluster.order}`;
  clusterTitle.textContent = cluster.title;
  clusterSummary.textContent = cluster.summary;
  clusterTermCount.textContent = `${cluster.termIds.length}語・${edges.length}個の関係`;
  clusterVisualTitle.textContent = cluster.visualTitle;
  clusterVisualType.textContent = VISUAL_TYPE_LABELS[cluster.visualType] || "関係図";
  clusterVisualDescription.textContent = cluster.visualDescription;
  taxNotice.hidden = cluster.id !== "accounts-tax";
  renderVisual(cluster, edges);
  renderRecommendedOrder(cluster);
  renderRelationshipList(edges);
  renderComparison(cluster);
  clusterDetail.dataset.clusterId = cluster.id;
}

function showLoadError(error) {
  console.error("用語マップの読み込みに失敗しました。", error);
  loadStatus.hidden = true;
  relationsContent.hidden = true;
  relationsErrorMessage.textContent =
    error instanceof Error
      ? error.message
      : "データを読み込めませんでした。時間をおいて、もう一度お試しください。";
  relationsError.hidden = false;
}

async function loadRelationships() {
  try {
    const [relationships, terms] = await Promise.all([
      fetchJson("./data/relationships.json"),
      fetchJson("./data/terms.json"),
    ]);
    const clusters = validateRelationships(relationships, terms);
    if (clusters.length === 0) {
      throw new Error("表示できる用語クラスターがありません。");
    }

    const requestedClusterId = new URLSearchParams(window.location.search).get("cluster");
    const activeCluster = clusterMap.get(requestedClusterId) || clusters[0];
    if (requestedClusterId && !clusterMap.has(requestedClusterId)) {
      clusterParameterNotice.textContent =
        "指定されたクラスターが見つからないため、最初のクラスターを表示しています。";
      clusterParameterNotice.hidden = false;
    }

    renderClusterNavigation(clusters, activeCluster);
    renderCluster(activeCluster);
    renderLegend();
    loadStatus.hidden = true;
    relationsContent.hidden = false;
  } catch (error) {
    showLoadError(error);
  }
}

loadRelationships();
