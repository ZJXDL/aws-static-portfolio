"use strict";

const levels = {
  beginner: { rows: 9, columns: 9, mines: 10 },
  intermediate: { rows: 16, columns: 16, mines: 40 },
  expert: { rows: 16, columns: 30, mines: 99 }
};

const expeditionStages = [
  { rows: 8, columns: 8, mines: 10 },
  { rows: 10, columns: 10, mines: 18 },
  { rows: 12, columns: 12, mines: 26 }
];

const modeContent = {
  classic: {
    caption: "CLASSIC FIELD",
    title: "Take it one square at a time.",
    copy: "Numbers count nearby mines. Open every safe square to clear the field.",
    tip: "Tap an open number after its flags match to clear the remaining squares around it.",
    bestLabel: "BEST TIME"
  },
  daily: {
    caption: "TODAY’S SHARED FIELD",
    title: "A field for all of us.",
    copy: "One seeded puzzle, the same for everyone. Your opening patch is already clear.",
    tip: "Everyone gets the same arrangement today. Come back tomorrow for a fresh field.",
    bestLabel: "TODAY’S BEST"
  },
  expedition: {
    caption: "THE EXPEDITION",
    title: "Keep your nerve.",
    copy: "Three fields, growing harder. You have three lives for the whole journey.",
    tip: "A mine costs one heart. Clear a field to travel to the next stage.",
    bestLabel: "BEST FINISH"
  },
  blitz: {
    caption: "THE ONE-MINUTE BLITZ",
    title: "Every second counts.",
    copy: "Reveal safe squares for points. Three lives; each mine costs time.",
    tip: "Clear a field for a 25 point bonus. A mine costs a heart and eight seconds.",
    bestLabel: "HIGH SCORE"
  }
};

const boardElement = document.querySelector("#board");
const boardScroll = document.querySelector("#board-scroll");
const difficultyElement = document.querySelector("#difficulty");
const difficultyWrap = document.querySelector("#difficulty-wrap");
const leftLabel = document.querySelector("#left-label");
const leftValue = document.querySelector("#left-value");
const rightLabel = document.querySelector("#right-label");
const rightValue = document.querySelector("#right-value");
const modeCaption = document.querySelector("#mode-caption");
const gameMessage = document.querySelector("#game-message");
const statusLine = document.querySelector(".status-line");
const boardSize = document.querySelector("#board-size");
const flagToggle = document.querySelector("#flag-toggle");
const faceButton = document.querySelector("#face-button");
const newGameButton = document.querySelector("#new-game");
const livesWrap = document.querySelector("#lives-wrap");
const livesValue = document.querySelector("#lives-value");
const stageWrap = document.querySelector("#stage-wrap");
const stageValue = document.querySelector("#stage-value");
const bestLabel = document.querySelector("#best-label");
const bestValue = document.querySelector("#best-value");
const missionOverline = document.querySelector("#mission-overline");
const missionTitle = document.querySelector("#mission-title");
const missionCopy = document.querySelector("#mission-copy");
const modeTip = document.querySelector("#mode-tip");
const dailyNote = document.querySelector("#daily-note");
const dailyStamp = document.querySelector("#daily-stamp");
const resultOverlay = document.querySelector("#result-overlay");
const resultSymbol = document.querySelector("#result-symbol");
const resultKicker = document.querySelector("#result-kicker");
const resultTitle = document.querySelector("#result-title");
const resultCopy = document.querySelector("#result-copy");
const resultAgain = document.querySelector("#result-again");
const shareButton = document.querySelector("#share-result");
const confetti = document.querySelector("#confetti");
const helpDialog = document.querySelector("#help-dialog");
const soundToggle = document.querySelector("#sound-toggle");
const toast = document.querySelector("#toast");

let game;
let audioContext;
let toastTimer;
let soundEnabled = false;
try { soundEnabled = localStorage.getItem("minefield:sound") === "on"; } catch { /* Sound preference is optional. */ }

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createNewGame(mode) {
  if (game?.timerId) window.clearInterval(game.timerId);
  const selectedMode = mode || "classic";
  const gameData = {
    mode: selectedMode,
    cells: [],
    rows: 9,
    columns: 9,
    mines: 10,
    opened: 0,
    flags: 0,
    lives: selectedMode === "expedition" || selectedMode === "blitz" ? 3 : 0,
    stage: 1,
    score: 0,
    seconds: 0,
    timeLeft: 60,
    timerId: null,
    started: false,
    firstMove: true,
    over: false,
    flagMode: false,
    date: todayKey(),
    rng: null,
    resultText: ""
  };

  if (selectedMode === "classic") {
    Object.assign(gameData, levels[difficultyElement.value] || levels.beginner);
  } else if (selectedMode === "daily") {
    Object.assign(gameData, { rows: 12, columns: 12, mines: 22 });
    gameData.rng = seededRandom(hashText("minefield-" + gameData.date));
  } else if (selectedMode === "expedition") {
    Object.assign(gameData, expeditionStages[0]);
  } else if (selectedMode === "blitz") {
    Object.assign(gameData, { rows: 12, columns: 12, mines: 22 });
  }

  game = gameData;
  updateModeInterface();
  buildBoard();
  updateHud();
  updateBest();
  resultOverlay.hidden = true;
  confetti.replaceChildren();
  setFlagMode(false, false);
  faceButton.textContent = "☺";
  faceButton.classList.remove("is-sad", "is-happy");
  faceButton.setAttribute("aria-label", "Start a new field");
  statusLine.classList.remove("is-danger");
  if (selectedMode === "daily") {
    startDailyField();
    gameMessage.textContent = "Today’s field is ready. Find a path through it.";
  } else {
    gameMessage.textContent = selectedMode === "blitz" ? "60 seconds. Three lives. Go find your rhythm." : "The first move is always safe.";
  }
}

function updateModeInterface() {
  document.querySelectorAll(".mode-tab").forEach((button) => {
    const selected = button.dataset.mode === game.mode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  const content = modeContent[game.mode];
  const isClassic = game.mode === "classic";
  const isDaily = game.mode === "daily";
  const isExpedition = game.mode === "expedition";
  const isBlitz = game.mode === "blitz";
  difficultyWrap.hidden = !isClassic;
  modeCaption.textContent = content.caption;
  missionOverline.textContent = game.mode === "daily" ? "THE DAILY FIELD" : (game.mode === "expedition" ? "YOUR JOURNEY" : (game.mode === "blitz" ? "SPEED ROUND" : "YOUR FIELD"));
  missionTitle.textContent = content.title;
  missionCopy.textContent = content.copy;
  modeTip.textContent = content.tip;
  bestLabel.textContent = content.bestLabel;
  livesWrap.hidden = !(isExpedition || isBlitz);
  stageWrap.hidden = !isExpedition;
  dailyNote.hidden = !isDaily;
  dailyStamp.hidden = !isDaily;
  leftLabel.textContent = isBlitz ? "SCORE" : (isExpedition ? "STAGE" : "MINES");
  rightLabel.textContent = isBlitz ? "SECONDS" : "TIME";
}

function buildBoard() {
  boardElement.replaceChildren();
  boardElement.style.gridTemplateColumns = "repeat(" + game.columns + ", var(--tile))";
  boardElement.setAttribute("aria-label", game.rows + " rows by " + game.columns + " columns");
  boardSize.textContent = game.columns + " × " + game.rows;
  game.cells = [];
  game.opened = 0;
  game.flags = 0;
  game.firstMove = true;

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const index = row * game.columns + column;
      const cell = { row, column, mine: false, adjacent: 0, opened: false, flagged: false, exploded: false, wrong: false };
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.index = String(index);
      button.tabIndex = index === 0 ? 0 : -1;
      button.setAttribute("aria-label", "Row " + (row + 1) + ", column " + (column + 1) + ", covered square");
      cell.element = button;
      game.cells.push(cell);
      boardElement.append(button);
    }
  }

  if (game.mode === "daily") {
    const center = Math.floor(game.rows / 2) * game.columns + Math.floor(game.columns / 2);
    plantMines(center);
    game.firstMove = false;
    floodReveal(center);
  }
  updateHud();
}

function neighborsOf(index) {
  const cell = game.cells[index];
  const result = [];
  for (let row = Math.max(0, cell.row - 1); row <= Math.min(game.rows - 1, cell.row + 1); row += 1) {
    for (let column = Math.max(0, cell.column - 1); column <= Math.min(game.columns - 1, cell.column + 1); column += 1) {
      const neighborIndex = row * game.columns + column;
      if (neighborIndex !== index) result.push(neighborIndex);
    }
  }
  return result;
}

function randomValue() {
  return game.rng ? game.rng() : Math.random();
}

function plantMines(safeIndex) {
  const safeArea = new Set([safeIndex, ...neighborsOf(safeIndex)]);
  const candidates = game.cells.map((cell, index) => index).filter((index) => !safeArea.has(index));

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomValue() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  candidates.slice(0, game.mines).forEach((index) => {
    game.cells[index].mine = true;
  });
  game.cells.forEach((cell, index) => {
    if (!cell.mine) cell.adjacent = neighborsOf(index).filter((neighbor) => game.cells[neighbor].mine).length;
  });
}

function startTimer() {
  if (game.started || game.over) return;
  game.started = true;
  game.timerId = window.setInterval(() => {
    if (game.mode === "blitz") {
      game.timeLeft = Math.max(0, game.timeLeft - 1);
      if (game.timeLeft === 0) {
        updateHud();
        finishGame(false, "time");
        return;
      }
    } else {
      game.seconds = Math.min(9999, game.seconds + 1);
    }
    updateHud();
  }, 1000);
}

function formatCounter(value) {
  const number = Math.trunc(value);
  return number < 0 ? "-" + String(Math.abs(number)).padStart(2, "0") : String(number).padStart(3, "0");
}

function formatTime(value) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function updateHud() {
  if (!game) return;
  if (game.mode === "blitz") {
    leftValue.textContent = formatCounter(game.score);
    rightValue.textContent = formatCounter(game.timeLeft);
  } else if (game.mode === "expedition") {
    leftValue.textContent = String(game.stage).padStart(2, "0") + "/03";
    rightValue.textContent = formatCounter(game.seconds);
    stageValue.innerHTML = String(game.stage).padStart(2, "0") + " <i>/ 03</i>";
  } else {
    leftValue.textContent = formatCounter(game.mines - game.flags);
    rightValue.textContent = formatCounter(game.seconds);
  }

  if (game.mode === "expedition" || game.mode === "blitz") {
    const hearts = Array.from({ length: 3 }, (_, index) => index < game.lives ? "♥" : "♡").join(" ");
    livesValue.textContent = hearts;
    livesValue.setAttribute("aria-label", game.lives + (game.lives === 1 ? " life remaining" : " lives remaining"));
  }
  updateBest();
}

function dailyDateText() {
  const date = new Date(game.date + "T12:00:00Z");
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date).toUpperCase();
}

function startDailyField() {
  dailyStamp.textContent = "FIELD " + dailyDateText();
}

function renderCell(cell) {
  const button = cell.element;
  button.classList.toggle("is-open", cell.opened);
  button.classList.toggle("is-flagged", cell.flagged);
  button.classList.toggle("is-mine", cell.opened && cell.mine);
  button.classList.toggle("is-exploded", cell.exploded);
  button.classList.toggle("is-wrong", cell.wrong);
  button.dataset.number = cell.opened && cell.adjacent ? String(cell.adjacent) : "";
  button.textContent = cell.flagged ? "⚑" : (cell.opened && cell.mine ? "✹" : (cell.opened && cell.adjacent ? String(cell.adjacent) : ""));
  button.setAttribute("aria-label", cellLabel(cell));
}

function cellLabel(cell) {
  const position = "Row " + (cell.row + 1) + ", column " + (cell.column + 1);
  if (cell.wrong) return position + ", incorrect flag";
  if (cell.flagged) return position + ", flagged as a mine";
  if (!cell.opened) return position + ", covered square";
  if (cell.mine) return position + ", mine";
  if (cell.adjacent === 0) return position + ", empty";
  return position + ", " + cell.adjacent + (cell.adjacent === 1 ? " mine nearby" : " mines nearby");
}

function updateMineCount() {
  if (game.mode !== "blitz" && game.mode !== "expedition") leftValue.textContent = formatCounter(game.mines - game.flags);
}

function toggleFlag(index) {
  const cell = game.cells[index];
  if (game.over || cell.opened) return;
  cell.flagged = !cell.flagged;
  game.flags += cell.flagged ? 1 : -1;
  renderCell(cell);
  updateMineCount();
  playSound(cell.flagged ? "flag" : "unflag");
}

function openCell(index) {
  if (game.over) return;
  const cell = game.cells[index];
  if (cell.flagged) return;
  if (cell.opened) {
    startTimer();
    chordCell(index);
    return;
  }

  if (game.firstMove) {
    plantMines(index);
    game.firstMove = false;
  }
  startTimer();
  playSound("open");

  if (cell.mine) {
    hitMine(cell);
    return;
  }

  floodReveal(index);
  checkFieldClear();
}

function floodReveal(startIndex) {
  const pending = [startIndex];
  const visited = new Set();

  while (pending.length) {
    const index = pending.pop();
    if (visited.has(index)) continue;
    visited.add(index);

    const cell = game.cells[index];
    if (cell.opened || cell.flagged || cell.mine) continue;
    cell.opened = true;
    game.opened += 1;
    if (game.mode === "blitz") game.score += 1;
    renderCell(cell);
    if (cell.adjacent === 0) pending.push(...neighborsOf(index));
  }
  updateHud();
}

function chordCell(index) {
  const cell = game.cells[index];
  if (!cell.opened || !cell.adjacent || game.over) return;
  const neighbors = neighborsOf(index);
  const flags = neighbors.filter((neighbor) => game.cells[neighbor].flagged).length;
  if (flags !== cell.adjacent) return;
  neighbors.filter((neighbor) => !game.cells[neighbor].opened && !game.cells[neighbor].flagged).forEach((neighbor) => openCell(neighbor));
}

function hitMine(cell) {
  cell.opened = true;
  cell.exploded = true;
  renderCell(cell);
  playSound("mine");

  if (game.mode === "classic" || game.mode === "daily") {
    finishGame(false, "mine");
    return;
  }

  game.lives -= 1;
  if (game.mode === "blitz") game.timeLeft = Math.max(0, game.timeLeft - 8);
  updateHud();
  statusLine.classList.add("is-danger");

  if (game.lives <= 0) {
    finishGame(false, "lives");
  } else if (game.mode === "blitz" && game.timeLeft <= 0) {
    finishGame(false, "time");
  } else {
    gameMessage.textContent = game.mode === "blitz" ? "Mine! Heart down, eight seconds off. Keep moving." : "Mine! One heart gone. Steady now.";
    window.setTimeout(() => statusLine.classList.remove("is-danger"), 900);
  }
}

function checkFieldClear() {
  if (game.opened !== game.cells.length - game.mines || game.over) return;

  if (game.mode === "expedition" && game.stage < expeditionStages.length) {
    game.stage += 1;
    Object.assign(game, expeditionStages[game.stage - 1]);
    buildBoard();
    gameMessage.textContent = "Stage " + String(game.stage).padStart(2, "0") + ". New ground ahead.";
    statusLine.classList.remove("is-danger");
    playSound("stage");
    return;
  }

  if (game.mode === "blitz") {
    game.score += 25;
    Object.assign(game, { rows: 12, columns: 12, mines: 22 });
    buildBoard();
    gameMessage.textContent = "Field cleared · 25 point bonus. Next field!";
    statusLine.classList.remove("is-danger");
    playSound("stage");
    updateHud();
    return;
  }

  finishGame(true, "clear");
}

function revealMines() {
  game.cells.forEach((cell) => {
    if (cell.mine) {
      cell.opened = true;
    } else if (cell.flagged) {
      cell.wrong = true;
    }
    renderCell(cell);
  });
}

function finishGame(won, reason) {
  if (game.over) return;
  game.over = true;
  game.won = won;
  if (game.timerId) window.clearInterval(game.timerId);
  game.flagMode = false;
  flagToggle.setAttribute("aria-pressed", "false");
  statusLine.classList.toggle("is-danger", !won);
  if (!won) revealMines();

  let title;
  let copy;
  if (won && game.mode === "expedition") {
    title = "All the way through.";
    copy = "Three fields, three lives, one fine expedition. " + formatTime(game.seconds) + ".";
  } else if (won && game.mode === "blitz") {
    title = "Time to breathe.";
    copy = game.score + " points. You kept your head in the field.";
  } else if (won && game.mode === "daily") {
    title = "Today, you found a way.";
    copy = "Daily field cleared in " + formatTime(game.seconds) + ".";
  } else if (won) {
    title = "Field cleared.";
    copy = "A clean run in " + formatTime(game.seconds) + ".";
  } else if (reason === "time") {
    title = "Time, beautifully spent.";
    copy = game.score + " points · every second counts.";
  } else if (reason === "lives" && game.mode === "expedition") {
    title = "The trail ends here.";
    copy = "You reached stage " + String(game.stage).padStart(2, "0") + " of 03. The field will be here.";
  } else if (reason === "lives") {
    title = "Three strikes.";
    copy = game.score + " points. You were moving fast.";
  } else {
    title = "One hidden in the grass.";
    copy = game.mode === "daily" ? "Today’s field got the better of you. There’s always tomorrow." : "A new field is one click away.";
  }

  resultTitle.textContent = title;
  resultCopy.textContent = copy;
  resultKicker.textContent = won ? "FIELD CLEARED" : (reason === "time" ? "TIME IS UP" : "RUN COMPLETE");
  resultSymbol.textContent = won ? "✳" : (reason === "time" ? "◷" : "✕");
  faceButton.textContent = won ? "★" : "×";
  faceButton.classList.toggle("is-happy", won);
  faceButton.classList.toggle("is-sad", !won);
  faceButton.setAttribute("aria-label", "Start a new field");
  resultOverlay.hidden = false;
  updateRecord(won);
  updateHud();
  if (won) {
    playSound("win");
    launchConfetti();
  }
  window.requestAnimationFrame(() => resultAgain.focus());
}

function recordKey() {
  if (game.mode === "classic") return "minefield:best:classic:" + difficultyElement.value;
  if (game.mode === "daily") return "minefield:best:daily:" + game.date;
  if (game.mode === "blitz") return "minefield:best:blitz";
  return "minefield:best:expedition";
}

function readRecord(key) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

function updateRecord(won) {
  let candidate = null;
  let improve = false;
  if (game.mode === "blitz") {
    candidate = game.score;
    improve = candidate > (readRecord(recordKey()) ?? -1);
  } else if (game.mode === "expedition") {
    if (won) {
      candidate = game.seconds;
      improve = candidate < (readRecord(recordKey()) ?? Infinity);
    }
  } else if (won) {
    candidate = game.seconds;
    improve = candidate < (readRecord(recordKey()) ?? Infinity);
  }
  if (improve && candidate !== null) {
    try { localStorage.setItem(recordKey(), String(candidate)); } catch { /* Storage can be unavailable in private browsing. */ }
  }
}

function updateBest() {
  if (!game) return;
  const best = readRecord(recordKey());
  if (best === null || !Number.isFinite(best)) {
    bestValue.textContent = "— — : — —";
    return;
  }
  bestValue.textContent = game.mode === "blitz" ? formatCounter(best) + " pts" : formatTime(best);
}

function setFlagMode(enabled, announce) {
  if (!game || game.over) return;
  game.flagMode = enabled;
  flagToggle.setAttribute("aria-pressed", String(enabled));
  if (announce !== false) gameMessage.textContent = enabled ? "Flag mode on. Tap a square to mark it." : "Flag mode off. Tap a square to reveal it.";
}

function launchConfetti() {
  confetti.replaceChildren();
  const colors = ["#D89151", "#77906E", "#F0C893", "#A8B99F", "#A44138", "#F4EADB"];
  for (let index = 0; index < 32; index += 1) {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", Math.floor(Math.random() * 100) + "%");
    piece.style.setProperty("--c", colors[index % colors.length]);
    piece.style.setProperty("--delay", (Math.random() * .6) + "s");
    piece.style.setProperty("--dur", (1.5 + Math.random() * 1.2) + "s");
    piece.style.setProperty("--rot", Math.floor(Math.random() * 160) + "deg");
    confetti.append(piece);
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => { toast.hidden = true; }, 220);
  }, 1900);
}

function resultShareText() {
  const modeName = game.mode.charAt(0).toUpperCase() + game.mode.slice(1);
  if (game.mode === "blitz") return "Minefield " + modeName + " · " + game.score + " points · " + formatTime(60 - game.timeLeft);
  if (game.mode === "expedition") return "Minefield Expedition · " + (game.won ? "complete" : "stage " + game.stage + "/3") + " · " + formatTime(game.seconds);
  if (game.mode === "daily") return "Minefield Daily · " + game.date + " · " + (game.won ? formatTime(game.seconds) : "not cleared yet");
  return "Minefield Classic · " + game.rows + "×" + game.columns + " · " + (game.won ? formatTime(game.seconds) : "not cleared yet");
}

async function shareResult() {
  const text = resultShareText();
  try {
    if (navigator.share) {
      await navigator.share({ title: "Minefield", text });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showToast("Result copied. Send it to a friend.");
    } else {
      showToast(text);
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast(text);
  }
}

function playSound(kind) {
  if (!soundEnabled) return;
  try {
    audioContext ||= new window.AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();
    const sounds = {
      open: [430, .055, "sine"],
      flag: [570, .07, "triangle"],
      unflag: [350, .06, "sine"],
      mine: [115, .22, "triangle"],
      stage: [620, .16, "sine"],
      win: [760, .3, "sine"]
    };
    const [frequency, duration, wave] = sounds[kind];
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    if (kind === "win" || kind === "stage") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, audioContext.currentTime + duration);
    gain.gain.setValueAtTime(.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === "mine" ? .045 : .025, audioContext.currentTime + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration + .02);
  } catch {
    soundEnabled = false;
    soundToggle.setAttribute("aria-pressed", "false");
  }
}

boardElement.addEventListener("click", (event) => {
  const button = event.target.closest(".cell");
  if (!button || !boardElement.contains(button)) return;
  const index = Number(button.dataset.index);
  if (game.flagMode) toggleFlag(index);
  else openCell(index);
});

boardElement.addEventListener("contextmenu", (event) => {
  const button = event.target.closest(".cell");
  if (!button || !boardElement.contains(button)) return;
  event.preventDefault();
  toggleFlag(Number(button.dataset.index));
});

boardElement.addEventListener("dblclick", (event) => {
  const button = event.target.closest(".cell");
  if (!button || !boardElement.contains(button)) return;
  chordCell(Number(button.dataset.index));
});

boardElement.addEventListener("keydown", (event) => {
  const button = event.target.closest(".cell");
  if (!button) return;
  const index = Number(button.dataset.index);
  const offsets = { ArrowUp: -game.columns, ArrowDown: game.columns, ArrowLeft: -1, ArrowRight: 1 };
  if (!(event.key in offsets)) return;
  if (event.key === "ArrowLeft" && game.cells[index].column === 0) return;
  if (event.key === "ArrowRight" && game.cells[index].column === game.columns - 1) return;
  const nextIndex = index + offsets[event.key];
  if (nextIndex < 0 || nextIndex >= game.cells.length) return;
  event.preventDefault();
  game.cells[index].element.tabIndex = -1;
  game.cells[nextIndex].element.tabIndex = 0;
  game.cells[nextIndex].element.focus();
});

document.querySelectorAll(".mode-tab").forEach((button) => {
  button.addEventListener("click", () => createNewGame(button.dataset.mode));
});
difficultyElement.addEventListener("change", () => createNewGame("classic"));
newGameButton.addEventListener("click", () => createNewGame(game.mode));
faceButton.addEventListener("click", () => createNewGame(game.mode));
resultAgain.addEventListener("click", () => createNewGame(game.mode));
shareButton.addEventListener("click", shareResult);
flagToggle.addEventListener("click", () => setFlagMode(!game.flagMode));
document.querySelector("#help-open").addEventListener("click", () => helpDialog.showModal());
document.querySelector(".dialog-close").addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) helpDialog.close();
});
soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
  try { localStorage.setItem("minefield:sound", soundEnabled ? "on" : "off"); } catch { /* Sound still works for this page. */ }
  if (soundEnabled) playSound("open");
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key.toLowerCase() === "f" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement) && !game.over) {
    setFlagMode(!game.flagMode);
  } else if (event.key === "?" && !helpDialog.open) {
    helpDialog.showModal();
  } else if (/^[1-4]$/.test(event.key) && !helpDialog.open && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) {
    const shortcutMode = ["classic", "daily", "expedition", "blitz"][Number(event.key) - 1];
    createNewGame(shortcutMode);
  }
});

soundToggle.setAttribute("aria-pressed", String(soundEnabled));
soundToggle.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
createNewGame("classic");
