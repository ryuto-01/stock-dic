const QUIZ_LENGTH = 5;
const CHOICE_COUNT = 4;

const loadStatus = document.querySelector("#quiz-load-status");
const startPanel = document.querySelector("#quiz-start-panel");
const questionPanel = document.querySelector("#quiz-question-panel");
const resultPanel = document.querySelector("#quiz-result-panel");
const termCount = document.querySelector("#quiz-term-count");
const startButton = document.querySelector("#start-quiz");
const progressText = document.querySelector("#quiz-progress-text");
const progressBar = document.querySelector("#quiz-progress-bar");
const scoreText = document.querySelector("#quiz-score");
const questionCategory = document.querySelector("#quiz-category");
const questionText = document.querySelector("#quiz-question");
const questionReading = document.querySelector("#quiz-reading");
const choicesContainer = document.querySelector("#quiz-choices");
const feedback = document.querySelector("#quiz-feedback");
const nextButton = document.querySelector("#next-question");
const resultScore = document.querySelector("#quiz-result-score");
const resultMessage = document.querySelector("#quiz-result-message");
const review = document.querySelector("#quiz-review");
const reviewList = document.querySelector("#quiz-review-list");
const restartButton = document.querySelector("#restart-quiz");

let allTerms = [];
let quizTerms = [];
let currentQuestionIndex = 0;
let score = 0;
let incorrectTerms = [];

function shuffle(items) {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[randomIndex]] = [
      shuffledItems[randomIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
}

function formatReading(term) {
  if (term.japaneseName && term.japaneseName !== term.name) {
    return `${term.reading}／${term.japaneseName}`;
  }

  return term.reading;
}

function getChoices(correctTerm) {
  const distractors = shuffle(
    allTerms.filter((term) => term.id !== correctTerm.id),
  ).slice(0, CHOICE_COUNT - 1);

  return shuffle([correctTerm, ...distractors]);
}

function createChoiceButton(choice, correctTerm) {
  const button = document.createElement("button");
  button.className = "quiz-choice";
  button.type = "button";
  button.dataset.termId = choice.id;
  button.textContent = choice.summary;
  button.addEventListener("click", () => {
    checkAnswer(button, choice.id, correctTerm);
  });

  return button;
}

function renderQuestion() {
  const currentTerm = quizTerms[currentQuestionIndex];
  const choices = getChoices(currentTerm);
  const choiceButtons = document.createDocumentFragment();

  choices.forEach((choice) => {
    choiceButtons.append(createChoiceButton(choice, currentTerm));
  });

  progressText.textContent = `第${currentQuestionIndex + 1}問／${QUIZ_LENGTH}問`;
  progressBar.style.width = `${((currentQuestionIndex + 1) / QUIZ_LENGTH) * 100}%`;
  scoreText.textContent = `正解 ${score}問`;
  questionCategory.textContent = currentTerm.category;
  questionText.textContent = currentTerm.name;
  questionReading.textContent = formatReading(currentTerm);
  choicesContainer.replaceChildren(choiceButtons);
  feedback.hidden = true;
  feedback.className = "quiz-feedback";
  nextButton.textContent =
    currentQuestionIndex === QUIZ_LENGTH - 1 ? "結果を見る" : "次の問題へ";
  nextButton.hidden = true;
}

function checkAnswer(selectedButton, selectedId, correctTerm) {
  const isCorrect = selectedId === correctTerm.id;
  const choiceButtons = choicesContainer.querySelectorAll(".quiz-choice");

  choiceButtons.forEach((button) => {
    button.disabled = true;

    if (button.dataset.termId === correctTerm.id) {
      button.classList.add("is-correct");
    }
  });

  if (isCorrect) {
    score += 1;
    feedback.textContent = "正解です！";
    feedback.classList.add("is-correct");
  } else {
    selectedButton.classList.add("is-incorrect");
    incorrectTerms.push(correctTerm);
    feedback.textContent = `不正解です。正解は「${correctTerm.summary}」です。`;
    feedback.classList.add("is-incorrect");
  }

  scoreText.textContent = `正解 ${score}問`;
  feedback.hidden = false;
  nextButton.hidden = false;
  nextButton.focus();
}

function getResultMessage() {
  if (score === QUIZ_LENGTH) {
    return "全問正解です。基本用語がしっかり身についています！";
  }

  if (score >= 3) {
    return "よくできました。間違えた用語を確認すると、さらに理解が深まります。";
  }

  return "ここからが学びどころです。復習用語の詳細を読んで、もう一度挑戦しましょう。";
}

function renderReviewLinks() {
  const reviewItems = document.createDocumentFragment();

  incorrectTerms.forEach((term) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `./detail.html?id=${encodeURIComponent(term.id)}`;
    link.textContent = `${term.name}：${term.summary}`;
    item.append(link);
    reviewItems.append(item);
  });

  reviewList.replaceChildren(reviewItems);
  review.hidden = incorrectTerms.length === 0;
}

function showResult() {
  questionPanel.hidden = true;
  resultScore.textContent = `${QUIZ_LENGTH}問中 ${score}問正解`;
  resultMessage.textContent = getResultMessage();
  renderReviewLinks();
  resultPanel.hidden = false;
  resultPanel.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startQuiz() {
  quizTerms = shuffle(allTerms).slice(0, QUIZ_LENGTH);
  currentQuestionIndex = 0;
  score = 0;
  incorrectTerms = [];
  startPanel.hidden = true;
  resultPanel.hidden = true;
  questionPanel.hidden = false;
  renderQuestion();
}

function showLoadError() {
  loadStatus.textContent =
    "クイズを読み込めませんでした。時間をおいて、もう一度お試しください。";
  loadStatus.classList.add("is-error");
  loadStatus.hidden = false;
}

async function loadTerms() {
  try {
    const response = await fetch("./data/terms.json");

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const terms = await response.json();

    if (!Array.isArray(terms) || terms.length < CHOICE_COUNT) {
      throw new TypeError("クイズに必要な用語データが不足しています。");
    }

    allTerms = terms;
    termCount.textContent = `全${allTerms.length}語からランダム出題`;
    startButton.disabled = false;
    loadStatus.hidden = true;
    startPanel.hidden = false;
  } catch (error) {
    console.error("クイズデータの読み込みに失敗しました。", error);
    showLoadError();
  }
}

startButton.addEventListener("click", startQuiz);
restartButton.addEventListener("click", startQuiz);

nextButton.addEventListener("click", () => {
  if (currentQuestionIndex === QUIZ_LENGTH - 1) {
    showResult();
    return;
  }

  currentQuestionIndex += 1;
  renderQuestion();
});

loadTerms();
