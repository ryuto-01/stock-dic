const STORAGE_KEY = "stock-dic-roadmap-progress-v1";

const loadStatus = document.querySelector("#learn-load-status");
const learnContent = document.querySelector("#learn-content");
const learnError = document.querySelector("#learn-error");
const learnErrorMessage = document.querySelector("#learn-error-message");
const chapterCount = document.querySelector("#chapter-count");
const roadmapTermCount = document.querySelector("#roadmap-term-count");
const completedTermCount = document.querySelector("#completed-term-count");
const overallProgressText = document.querySelector("#overall-progress-text");
const overallProgress = document.querySelector("#overall-progress");
const overallProgressBar = document.querySelector("#overall-progress-bar");
const nextTermText = document.querySelector("#next-term-text");
const nextTermLink = document.querySelector("#next-term-link");
const completionMessage = document.querySelector("#completion-message");
const resetProgressButton = document.querySelector("#reset-progress");
const storageNotice = document.querySelector("#storage-notice");
const chaptersContainer = document.querySelector("#roadmap-chapters");
const progressAnnouncement = document.querySelector("#progress-announcement");

let roadmapData;
let termMap = new Map();
let orderedRoadmapTerms = [];
let completedTermIds = new Set();
let storageAvailable = true;
const termViews = new Map();
const chapterViews = new Map();

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

function getPercentage(completed, total) {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function showStorageWarning(message) {
  storageAvailable = false;
  storageNotice.textContent = message;
  storageNotice.hidden = false;
}

function loadSavedProgress(validTermIds) {
  try {
    const savedProgress = localStorage.getItem(STORAGE_KEY);

    if (!savedProgress) {
      return new Set();
    }

    const parsedProgress = JSON.parse(savedProgress);

    if (!Array.isArray(parsedProgress)) {
      throw new TypeError("保存された進捗データの形式が正しくありません。");
    }

    return new Set(
      parsedProgress.filter(
        (termId) => typeof termId === "string" && validTermIds.has(termId),
      ),
    );
  } catch (error) {
    console.warn("学習進捗を読み込めませんでした。", error);
    showStorageWarning(
      "このブラウザでは学習進捗を保存できません。ページの閲覧と詳細ページへの移動は引き続き利用できます。",
    );
    return new Set();
  }
}

function saveProgress() {
  if (!storageAvailable) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedTermIds]));
  } catch (error) {
    console.warn("学習進捗を保存できませんでした。", error);
    showStorageWarning(
      "学習進捗を保存できませんでした。このページ内では操作できますが、再読み込み後は保持されない場合があります。",
    );
  }
}

function createTermItem(term, order) {
  const item = document.createElement("li");
  item.className = "roadmap-term-item";

  const card = document.createElement("article");
  card.className = "roadmap-term-card";
  card.dataset.termId = term.id;

  const orderNumber = createElement("span", "roadmap-term-order", String(order));
  orderNumber.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "roadmap-term-content";
  const headingRow = document.createElement("div");
  headingRow.className = "roadmap-term-heading";
  const heading = createElement("h3", "", term.name);
  const state = createElement("span", "learning-state", "未学習");
  headingRow.append(heading, state);
  content.append(
    createElement("span", "category-badge", term.category),
    headingRow,
    createElement("p", "reading", formatReading(term)),
    createElement("p", "roadmap-term-summary", term.summary),
  );

  const actions = document.createElement("div");
  actions.className = "roadmap-term-actions";
  const detailLink = createElement("a", "roadmap-detail-link", "詳しく学ぶ →");
  detailLink.href = `./detail.html?id=${encodeURIComponent(term.id)}`;
  const toggleButton = createElement("button", "learning-toggle", "学習済みにする");
  toggleButton.type = "button";
  toggleButton.setAttribute("aria-pressed", "false");
  toggleButton.setAttribute("aria-label", `${term.name}を学習済みにする`);
  toggleButton.addEventListener("click", () => toggleTermProgress(term));
  actions.append(detailLink, toggleButton);

  card.append(orderNumber, content, actions);
  item.append(card);
  termViews.set(term.id, { card, state, toggleButton });

  return item;
}

function createChapter(chapter) {
  const section = document.createElement("section");
  section.className = "roadmap-chapter";
  section.setAttribute("aria-labelledby", `${chapter.id}-heading`);

  const header = document.createElement("header");
  header.className = "roadmap-chapter-header";
  const headingRow = document.createElement("div");
  headingRow.className = "roadmap-chapter-heading-row";
  const headingGroup = document.createElement("div");
  headingGroup.append(
    createElement("p", "chapter-number", `第${chapter.order}章`),
  );
  const heading = createElement("h2", "", chapter.title);
  heading.id = `${chapter.id}-heading`;
  headingGroup.append(heading);
  const progressText = createElement(
    "p",
    "chapter-progress-text",
    `0／${chapter.termIds.length}語`,
  );
  progressText.id = `${chapter.id}-progress-label`;
  headingRow.append(headingGroup, progressText);

  const description = createElement("p", "chapter-description", chapter.description);
  const outcome = document.createElement("div");
  outcome.className = "chapter-outcome";
  outcome.append(
    createElement("strong", "", "この章で分かるようになること"),
    createElement("p", "", chapter.outcome),
  );

  const progressTrack = document.createElement("div");
  progressTrack.className = "roadmap-progress-track chapter-progress-track";
  progressTrack.setAttribute("role", "progressbar");
  progressTrack.setAttribute("aria-label", `${chapter.title}の学習進捗`);
  progressTrack.setAttribute("aria-valuemin", "0");
  progressTrack.setAttribute("aria-valuemax", String(chapter.termIds.length));
  progressTrack.setAttribute("aria-valuenow", "0");
  const progressBar = document.createElement("span");
  progressTrack.append(progressBar);

  header.append(headingRow, description, outcome, progressTrack);

  const termList = document.createElement("ol");
  termList.className = "roadmap-term-list";
  chapter.termIds.forEach((termId, index) => {
    termList.append(createTermItem(termMap.get(termId), index + 1));
  });

  section.append(header, termList);
  chapterViews.set(chapter.id, {
    section,
    progressText,
    progressTrack,
    progressBar,
    termIds: chapter.termIds,
  });

  return section;
}

function renderRoadmap() {
  const chapters = document.createDocumentFragment();

  roadmapData.chapters.forEach((chapter) => {
    chapters.append(createChapter(chapter));
  });

  chaptersContainer.replaceChildren(chapters);
  chapterCount.textContent = `${roadmapData.chapters.length}章`;
  roadmapTermCount.textContent = `${orderedRoadmapTerms.length}語`;
  updateProgressDisplay();
}

function updateTermView(termId) {
  const view = termViews.get(termId);
  const term = termMap.get(termId);
  const isCompleted = completedTermIds.has(termId);

  view.card.classList.toggle("is-complete", isCompleted);
  view.state.textContent = isCompleted ? "✓ 学習済み" : "未学習";
  view.toggleButton.textContent = isCompleted
    ? "未学習に戻す"
    : "学習済みにする";
  view.toggleButton.setAttribute("aria-pressed", String(isCompleted));
  view.toggleButton.setAttribute(
    "aria-label",
    isCompleted
      ? `${term.name}を未学習に戻す`
      : `${term.name}を学習済みにする`,
  );
}

function updateChapterView(chapter) {
  const view = chapterViews.get(chapter.id);
  const completed = chapter.termIds.filter((termId) =>
    completedTermIds.has(termId),
  ).length;
  const percentage = getPercentage(completed, chapter.termIds.length);

  view.progressText.textContent = `${completed}／${chapter.termIds.length}語`;
  view.progressTrack.setAttribute("aria-valuenow", String(completed));
  view.progressBar.style.width = `${percentage}%`;
  view.section.classList.toggle(
    "is-complete",
    completed === chapter.termIds.length,
  );
}

function updateNextTerm(completedCount) {
  const nextTerm = orderedRoadmapTerms.find(
    (term) => !completedTermIds.has(term.id),
  );

  if (nextTerm) {
    nextTermText.textContent = `次は「${nextTerm.name}」を学びましょう。`;
    nextTermLink.textContent = "次の未学習用語から始める";
    nextTermLink.href = `./detail.html?id=${encodeURIComponent(nextTerm.id)}`;
    nextTermLink.setAttribute(
      "aria-label",
      `次の未学習用語「${nextTerm.name}」から始める`,
    );
    completionMessage.hidden = true;
    return;
  }

  const firstTerm = orderedRoadmapTerms[0];
  nextTermText.textContent = `全${completedCount}語の学習が完了しました。いつでも最初から復習できます。`;
  nextTermLink.textContent = "最初の用語を復習する";
  nextTermLink.href = `./detail.html?id=${encodeURIComponent(firstTerm.id)}`;
  nextTermLink.setAttribute(
    "aria-label",
    `最初の用語「${firstTerm.name}」を復習する`,
  );
  completionMessage.hidden = false;
}

function updateProgressDisplay() {
  orderedRoadmapTerms.forEach((term) => updateTermView(term.id));
  roadmapData.chapters.forEach(updateChapterView);

  const completedCount = orderedRoadmapTerms.filter((term) =>
    completedTermIds.has(term.id),
  ).length;
  const percentage = getPercentage(completedCount, orderedRoadmapTerms.length);

  completedTermCount.textContent = `${completedCount}語`;
  overallProgressText.textContent = `${completedCount}／${orderedRoadmapTerms.length}語（${percentage}%）`;
  overallProgress.setAttribute("aria-valuemax", String(orderedRoadmapTerms.length));
  overallProgress.setAttribute("aria-valuenow", String(completedCount));
  overallProgressBar.style.width = `${percentage}%`;
  resetProgressButton.disabled = completedCount === 0;
  updateNextTerm(completedCount);
}

function toggleTermProgress(term) {
  const wasCompleted = completedTermIds.has(term.id);

  if (wasCompleted) {
    completedTermIds.delete(term.id);
  } else {
    completedTermIds.add(term.id);
  }

  saveProgress();
  updateProgressDisplay();

  const completedCount = orderedRoadmapTerms.filter((roadmapTerm) =>
    completedTermIds.has(roadmapTerm.id),
  ).length;
  progressAnnouncement.textContent = wasCompleted
    ? `${term.name}を未学習に戻しました。全体の進捗は${completedCount}／${orderedRoadmapTerms.length}語です。`
    : `${term.name}を学習済みにしました。全体の進捗は${completedCount}／${orderedRoadmapTerms.length}語です。`;
}

function validateData(roadmap, terms) {
  if (!roadmap || !Array.isArray(roadmap.chapters)) {
    throw new TypeError("ロードマップの章データが正しくありません。");
  }

  if (!Array.isArray(terms)) {
    throw new TypeError("用語データが正しくありません。");
  }

  termMap = new Map(terms.map((term) => [term.id, term]));
  const seenTermIds = new Set();
  const invalidTermIds = [];

  roadmap.chapters.forEach((chapter) => {
    if (!Array.isArray(chapter.termIds)) {
      throw new TypeError(`${chapter.title || "名称未設定の章"}の用語IDが正しくありません。`);
    }

    chapter.termIds.forEach((termId) => {
      if (!termMap.has(termId)) {
        invalidTermIds.push(termId);
      }

      if (seenTermIds.has(termId)) {
        throw new Error(`ロードマップ内で用語ID「${termId}」が重複しています。`);
      }

      seenTermIds.add(termId);
    });
  });

  if (invalidTermIds.length > 0) {
    throw new Error(
      `用語データに存在しないIDが含まれています：${invalidTermIds.join(", ")}`,
    );
  }

  const sortedChapters = [...roadmap.chapters].sort(
    (firstChapter, secondChapter) => firstChapter.order - secondChapter.order,
  );
  const termsInOrder = sortedChapters.flatMap((chapter) =>
    chapter.termIds.map((termId) => termMap.get(termId)),
  );

  if (termsInOrder.length === 0) {
    throw new Error("学習対象の用語が登録されていません。");
  }

  return {
    roadmap: { ...roadmap, chapters: sortedChapters },
    termsInOrder,
    validTermIds: new Set(termsInOrder.map((term) => term.id)),
  };
}

function showLoadError(error) {
  console.error("学習ロードマップの読み込みに失敗しました。", error);
  loadStatus.hidden = true;
  learnContent.hidden = true;
  learnErrorMessage.textContent =
    error instanceof Error
      ? error.message
      : "データを読み込めませんでした。時間をおいて、もう一度お試しください。";
  learnError.hidden = false;
}

async function fetchJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`${path}を読み込めませんでした。`);
  }

  return response.json();
}

async function loadRoadmap() {
  try {
    const [roadmap, terms] = await Promise.all([
      fetchJson("./data/roadmap.json"),
      fetchJson("./data/terms.json"),
    ]);
    const validatedData = validateData(roadmap, terms);

    roadmapData = validatedData.roadmap;
    orderedRoadmapTerms = validatedData.termsInOrder;
    completedTermIds = loadSavedProgress(validatedData.validTermIds);
    renderRoadmap();
    loadStatus.hidden = true;
    learnContent.hidden = false;
  } catch (error) {
    showLoadError(error);
  }
}

resetProgressButton.addEventListener("click", () => {
  if (completedTermIds.size === 0) {
    return;
  }

  const shouldReset = window.confirm(
    "学習進捗をすべてリセットしますか？この操作は元に戻せません。",
  );

  if (!shouldReset) {
    return;
  }

  completedTermIds.clear();
  saveProgress();
  updateProgressDisplay();
  progressAnnouncement.textContent = "学習進捗をすべてリセットしました。";
  nextTermLink.focus();
});

loadRoadmap();
