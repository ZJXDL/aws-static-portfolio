"use strict";

const levels = {
  beginner: { rows: 9, columns: 9, mines: 10, label: "Small" },
  intermediate: { rows: 16, columns: 16, mines: 40, label: "Medium" },
  expert: { rows: 16, columns: 30, mines: 99, label: "Large" },
  daily: { rows: 12, columns: 12, mines: 24, label: "Daily" }
};

const survivalLevels = [
  { rows: 9, columns: 9, mines: 10, label: "Small" },
  { rows: 12, columns: 12, mines: 22, label: "Medium" },
  { rows: 16, columns: 16, mines: 40, label: "Large" }
];

const modes = {
  classic: {
    title: "The classic",
    description: "Find every safe square. Take all the time you need.",
    rule: "Your first square and its neighbors are clear.",
    label: "CLASSIC"
  },
  daily: {
    title: "Today's field",
    description: "One shared layout, refreshed every day.",
    rule: "The center starts clear. The rest is the same for everyone today.",
    label: "DAILY"
  },
  blitz: {
    title: "Beat the clock",
    description: "Clear the field before time runs out.",
    rule: "Your clock starts with your first reveal.",
    label: "BLITZ"
  },
  "no-flags": {
    title: "Trust the numbers",
    description: "No markers. No shortcuts. Just your logic.",
    rule: "Every safe square must be solved from the clues.",
    label: "NO FLAGS"
  },
  survival: {
    title: "Three fields. One life.",
    description: "Clear three growing boards without hitting a hazard.",
    rule: "One mistake ends the whole run.",
    label: "SURVIVAL"
  }
};

const themes = {
  paprika: { name: "Paprika", note: "A little warm, a little wild.", meta: "#f7eee2" },
  midnight: { name: "Midnight", note: "Quiet skies. Bright signals.", meta: "#151b2b" },
  matcha: { name: "Matcha", note: "Fresh air for a busy brain.", meta: "#e8ecda" },
  peach: { name: "Peach arcade", note: "Soft colors, big energy.", meta: "#f6e1d4" }
};

const hazardStyles = {
  classic: { name: "Classic mines", hazard: "✹", marker: "⚑", hazardWord: "mine", hazardPlural: "mines", markerWord: "flag" },
  cosmos: { name: "Cosmic signals", hazard: "✦", marker: "◇", hazardWord: "signal", hazardPlural: "signals", markerWord: "beacon" },
  garden: { name: "Garden prickles", hazard: "✿", marker: "❀", hazardWord: "prickle", hazardPlural: "prickles", markerWord: "flower marker" },
  ocean: { name: "Ocean jellyfish", hazard: "◉", marker: "⌁", hazardWord: "jellyfish", hazardPlural: "jellyfish", markerWord: "buoy" }
};

const boardElement = document.querySelector("#board");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const timeLabelElement = document.querySelector("#time-label");
const hazardLabelElement = document.querySelector("#hazard-label");
const messageElement = document.querySelector("#game-message");
const flagToggle = document.querySelector("#flag-toggle");
const faceButton = document.querySelector("#face-button");
const newGameButton = document.querySelector("#new-game");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];
const themeButtons = [...document.querySelectorAll("[data-theme-choice]")];
const skinSelect = document.querySelector("#skin-select");
const customPanel = document.querySelector("#custom-panel");
const difficultyWrap = document.querySelector("#difficulty-wrap");

let game = null;
let currentMode = "classic";
let selectedDifficulty = "beginner";
let survivalStage = 1;
let survivalTotalSeconds = 0;
let nextStageTimeout = null;
let currentSkin = "classic";

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The game remains playable when browser storage is unavailable.
  }
}

const storedPreferences = readStorage("minefieldPreferences", {});
const savedPreferences = storedPreferences && typeof storedPreferences === "object" ? storedPreferences : {};
const savedTheme = Object.hasOwn(themes, savedPreferences.theme) ? savedPreferences.theme : "paprika";
currentSkin = Object.hasOwn(hazardStyles, savedPreferences.skin) ? savedPreferences.skin : "classic";
document.documentElement.dataset.theme = savedTheme;
document.documentElement.dataset.skin = currentSkin;
skinSelect.value = currentSkin;
updateThemeControls(savedTheme);

function savePreferences() {
  writeStorage("minefieldPreferences", {
    theme: document.documentElement.dataset.theme,
    skin: currentSkin
  });
}

function utcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return function nextRandom() {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function customLevel() {
  const rows = Number(document.querySelector("#custom-rows").value);
  const columns = Number(document.querySelector("#custom-columns").value);
  const density = Number(document.querySelector("#custom-density").value);
  const mines = Math.max(1, Math.min(rows * columns - 9, Math.round(rows * columns * density / 100)));
  return { rows, columns, mines, label: "Custom" };
}

function getCurrentLevel() {
  if (currentMode === "daily") return levels.daily;
  if (currentMode === "survival") return survivalLevels[survivalStage - 1];
  if (selectedDifficulty === "custom") return customLevel();
  return levels[selectedDifficulty] || levels.beginner;
}

function formatCounter(value) {
  return String(Math.max(0, Math.min(999, value))).padStart(3, "0");
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return Math.floor(safeSeconds / 60) + ":" + String(safeSeconds % 60).padStart(2, "0");
}

function getBlitzLimit(level) {
  return Math.max(120, Math.round(level.rows * level.columns * 0.3));
}

function currentRecordKey() {
  if (game.mode === "survival") return "survival";
  if (game.mode === "daily") return "daily-" + utcDateKey();
  if (game.difficulty === "custom") return "custom-" + game.rows + "x" + game.columns + "-" + game.mines;
  return game.mode + "-" + game.difficulty;
}

function updateThemeControls(themeName) {
  const theme = themes[themeName] || themes.paprika;
  document.documentElement.dataset.theme = themeName in themes ? themeName : "paprika";
  document.querySelector("#theme-name").textContent = theme.name;
  document.querySelector("#style-note").textContent = theme.note;
  document.querySelector('meta[name="theme-color"]').content = theme.meta;
  themeButtons.forEach((button) => {
    const active = button.dataset.themeChoice === themeName;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateCustomSummary() {
  const rows = Number(document.querySelector("#custom-rows").value);
  const columns = Number(document.querySelector("#custom-columns").value);
  const density = Number(document.querySelector("#custom-density").value);
  const mines = Math.max(1, Math.min(rows * columns - 9, Math.round(rows * columns * density / 100)));
  document.querySelector("#rows-value").value = rows;
  document.querySelector("#rows-value").textContent = rows;
  document.querySelector("#columns-value").value = columns;
  document.querySelector("#columns-value").textContent = columns;
  document.querySelector("#density-value").value = density + "%";
  document.querySelector("#density-value").textContent = density + "%";
  document.querySelector("#custom-total").textContent = mines + (mines === 1 ? " hazard" : " hazards");
}

function updateSetupControls() {
  const fixedMode = currentMode === "daily" || currentMode === "survival";
  difficultyWrap.hidden = fixedMode;
  customPanel.hidden = fixedMode || selectedDifficulty !== "custom";

  modeButtons.forEach((button) => {
    const active = button.dataset.mode === currentMode;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(active));
  });

  difficultyButtons.forEach((button) => {
    const active = button.dataset.difficulty === selectedDifficulty;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const flagsDisabled = currentMode === "no-flags";
  flagToggle.disabled = flagsDisabled;
  flagToggle.hidden = flagsDisabled;
  flagToggle.setAttribute("aria-pressed", "false");
  if (flagsDisabled && game) game.flagMode = false;
  updateSurvivalProgress();
}

function updateModeCopy() {
  const mode = modes[currentMode];
  const level = getCurrentLevel();
  const levelName = currentMode === "daily" ? "DAILY FIELD" : currentMode === "survival" ? "BOARD " + survivalStage + " OF 3" : level.label.toUpperCase() + " FIELD";
  document.querySelector("#round-label").textContent = mode.label + " · " + levelName;
  document.querySelector("#mission-title").textContent = mode.title;
  document.querySelector("#mission-description").textContent = currentMode === "blitz"
    ? "Clear this field in " + formatTime(getBlitzLimit(level)) + " or less."
    : mode.description;
  document.querySelector("#mission-rule").textContent = mode.rule;
  document.querySelector("#daily-date").hidden = currentMode !== "daily";
  if (currentMode === "daily") {
    const date = new Date(utcDateKey() + "T00:00:00Z");
    document.querySelector("#daily-date").textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeZone: "UTC" }).format(date).toUpperCase();
  }
  document.querySelector("#survival-progress").hidden = currentMode !== "survival";
  hazardLabelElement.textContent = currentMode === "no-flags" ? "HAZARDS TO FIND" : "HAZARDS LEFT";
  timeLabelElement.textContent = currentMode === "blitz" ? "TIME LEFT" : currentMode === "survival" ? "RUN TIME" : "YOUR TIME";
}

function updateSurvivalProgress() {
  const steps = [...document.querySelectorAll(".progress-step")];
  steps.forEach((step) => {
    const number = Number(step.dataset.step);
    step.classList.toggle("is-current", currentMode === "survival" && number === survivalStage);
    step.classList.toggle("is-done", currentMode === "survival" && number < survivalStage);
  });
}

function neighborsOf(index) {
  const cell = game.cells[index];
  const neighbors = [];
  for (let row = Math.max(0, cell.row - 1); row <= Math.min(game.rows - 1, cell.row + 1); row += 1) {
    for (let column = Math.max(0, cell.column - 1); column <= Math.min(game.columns - 1, cell.column + 1); column += 1) {
      const neighborIndex = row * game.columns + column;
      if (neighborIndex !== index) neighbors.push(neighborIndex);
    }
  }
  return neighbors;
}

function placeMines(safeIndex, random = Math.random) {
  const safeArea = new Set([safeIndex, ...neighborsOf(safeIndex)]);
  const candidates = game.cells.map((_, index) => index).filter((index) => !safeArea.has(index));

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  candidates.slice(0, game.mines).forEach((index) => {
    game.cells[index].mine = true;
  });

  game.cells.forEach((cell, index) => {
    if (!cell.mine) cell.adjacent = neighborsOf(index).filter((neighbor) => game.cells[neighbor].mine).length;
  });
}

function createGame(options = {}) {
  if (game?.timerId) window.clearInterval(game.timerId);
  if (nextStageTimeout) window.clearTimeout(nextStageTimeout);
  nextStageTimeout = null;

  const level = getCurrentLevel();
  const isCustom = currentMode !== "daily" && currentMode !== "survival" && selectedDifficulty === "custom";
  game = {
    ...level,
    mode: currentMode,
    difficulty: isCustom ? "custom" : currentMode === "daily" ? "daily" : currentMode === "survival" ? "survival" : selectedDifficulty,
    cells: [],
    firstMove: true,
    started: false,
    over: false,
    won: false,
    flags: 0,
    opened: 0,
    seconds: 0,
    flagMode: false,
    timerId: null
  };

  boardElement.replaceChildren();
  boardElement.style.gridTemplateColumns = "repeat(" + game.columns + ", var(--cell-size))";
  boardElement.setAttribute("aria-label", game.rows + " row by " + game.columns + " column Minesweeper board");
  boardElement.classList.toggle("is-wide", game.columns > 16);

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const index = row * game.columns + column;
      const cell = { row, column, mine: false, adjacent: 0, opened: false, flagged: false };
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

  game.flagMode = false;
  faceButton.querySelector("span").textContent = "☺";
  faceButton.setAttribute("aria-label", "Start a new run");
  faceButton.classList.remove("is-happy", "is-sad");
  updateSetupControls();
  updateModeCopy();
  mineCountElement.textContent = formatCounter(game.mines);
  timerElement.textContent = currentMode === "blitz" ? formatCounter(getBlitzLimit(level)) : "000";
  messageElement.textContent = currentMode === "daily" ? "Today's shared field is open. Where will you go next?" : "Pick a square. Your first one’s safe.";

  if (currentMode === "daily") {
    game.firstMove = false;
    const center = Math.floor(game.rows / 2) * game.columns + Math.floor(game.columns / 2);
    placeMines(center, seededRandom(hashText(utcDateKey() + "-minefield-daily")));
    floodReveal(center);
  }

  if (currentMode === "survival" && !options.continueSurvival) updateSurvivalProgress();
  updateRecords();
}

function updateMineCount() {
  mineCountElement.textContent = formatCounter(game.mines - game.flags);
}

function skin() {
  return hazardStyles[currentSkin] || hazardStyles.classic;
}

function accessibleCellName(cell) {
  const position = "Row " + (cell.row + 1) + ", column " + (cell.column + 1);
  const art = skin();
  if (cell.wrong) return position + ", incorrect " + art.markerWord;
  if (cell.flagged) return position + ", " + art.markerWord + " marking a " + art.hazardWord;
  if (!cell.opened) return position + ", covered square";
  if (cell.mine) return position + ", " + art.hazardWord;
  if (cell.adjacent === 0) return position + ", clear";
  return position + ", " + cell.adjacent + (cell.adjacent === 1 ? " nearby hazard" : " nearby hazards");
}

function renderCell(index) {
  const cell = game.cells[index];
  const button = cell.element;
  button.classList.toggle("is-open", cell.opened);
  button.classList.toggle("is-flagged", cell.flagged && !cell.wrong);
  button.classList.toggle("is-mine", cell.opened && cell.mine);
  button.classList.toggle("is-exploded", cell.exploded === true);
  button.classList.toggle("is-wrong", cell.wrong === true);
  button.dataset.number = cell.opened && cell.adjacent ? String(cell.adjacent) : "";
  button.textContent = cell.wrong ? "×" : cell.flagged ? skin().marker : cell.opened && cell.mine ? skin().hazard : cell.opened && cell.adjacent ? String(cell.adjacent) : "";
  button.setAttribute("aria-label", accessibleCellName(cell));
}

function startTimer() {
  if (game.started || game.over) return;
  game.started = true;
  game.startedAt = Date.now();
  game.timerId = window.setInterval(() => {
    game.seconds = Math.floor((Date.now() - game.startedAt) / 1000);
    if (game.mode === "blitz" && game.seconds >= getBlitzLimit(game)) {
      game.seconds = getBlitzLimit(game);
      finishGame(false, "time");
      return;
    }
    updateTimer();
  }, 250);
}

function updateTimer() {
  if (game.mode === "blitz") {
    timerElement.textContent = formatCounter(getBlitzLimit(game) - game.seconds);
    return;
  }
  const seconds = game.mode === "survival" ? survivalTotalSeconds + game.seconds : game.seconds;
  timerElement.textContent = formatCounter(seconds);
}

function toggleFlag(index) {
  const cell = game.cells[index];
  if (game.over || game.mode === "no-flags" || cell.opened) return;
  if (!game.started) startTimer();
  cell.flagged = !cell.flagged;
  game.flags += cell.flagged ? 1 : -1;
  renderCell(index);
  updateMineCount();
}

function openCell(index) {
  const cell = game.cells[index];
  if (game.over || cell.opened || cell.flagged) return;

  if (game.firstMove) {
    placeMines(index);
    game.firstMove = false;
  }
  if (!game.started) startTimer();

  if (cell.mine) {
    cell.opened = true;
    cell.exploded = true;
    finishGame(false, "hazard");
    return;
  }

  floodReveal(index);
  if (game.opened === game.cells.length - game.mines) finishGame(true);
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
    renderCell(index);

    if (cell.adjacent === 0) pending.push(...neighborsOf(index));
  }
}

function recordData() {
  const stored = readStorage("minefieldRecordsV1", { scores: {} });
  if (!stored || typeof stored !== "object") return { scores: {} };
  if (!stored.scores || typeof stored.scores !== "object") stored.scores = {};
  return stored;
}

function updateRecords() {
  const records = recordData();
  const key = currentRecordKey();
  const record = records.scores?.[key] || { best: null, wins: 0 };
  document.querySelector("#best-time").textContent = record.best === null ? "—" : formatTime(record.best);
  document.querySelector("#games-won").textContent = String(record.wins || 0);
  document.querySelector("#record-caption").textContent = currentMode === "daily" ? "Today's field · saved on this device." : "Saved on this device for this mode.";
}

function saveWin(time) {
  const records = recordData();
  if (!records.scores) records.scores = {};
  const key = currentRecordKey();
  const record = records.scores[key] || { best: null, wins: 0 };
  record.wins = (record.wins || 0) + 1;
  if (record.best === null || time < record.best) record.best = time;
  records.scores[key] = record;
  writeStorage("minefieldRecordsV1", records);
  updateRecords();
}

function updateFace(won) {
  faceButton.querySelector("span").textContent = won ? "✦" : "×";
  faceButton.setAttribute("aria-label", won ? "You won. Start a new run" : "Game over. Start a new run");
  faceButton.classList.toggle("is-happy", won);
  faceButton.classList.toggle("is-sad", !won);
}

function finishGame(won, reason = "hazard") {
  if (game.over) return;
  game.over = true;
  game.won = won;
  game.flagMode = false;
  if (game.timerId) window.clearInterval(game.timerId);
  flagToggle.setAttribute("aria-pressed", "false");
  updateFace(won);

  if (won) {
    if (game.mode === "survival" && survivalStage < survivalLevels.length) {
      survivalTotalSeconds += game.seconds;
      messageElement.textContent = "Field " + survivalStage + " cleared! The next one gets trickier…";
      nextStageTimeout = window.setTimeout(() => {
        survivalStage += 1;
        createGame({ continueSurvival: true });
        messageElement.textContent = "Field " + survivalStage + " of 3. You’ve got this.";
      }, 1100);
    } else {
      const scoreTime = game.mode === "survival" ? survivalTotalSeconds + game.seconds : game.seconds;
      saveWin(scoreTime);
      messageElement.textContent = game.mode === "survival" ? "All three fields cleared. What a run!" : game.mode === "daily" ? "Today's field is clear. Lovely work!" : "Field cleared. Lovely work!";
    }
    return;
  }

  game.cells.forEach((cell, index) => {
    if (cell.mine) cell.opened = true;
    else if (cell.flagged) cell.wrong = true;
    renderCell(index);
  });
  messageElement.textContent = reason === "time" ? "Time's up. The field wins this round." : "A " + skin().hazardWord + "! The field wins this round.";
}

function setFlagMode(enabled) {
  if (game.over || game.mode === "no-flags") return;
  game.flagMode = enabled;
  flagToggle.setAttribute("aria-pressed", String(enabled));
  messageElement.textContent = enabled ? skin().markerWord.toUpperCase() + " mode. Tap a square to mark it." : "Marker mode off. Tap a square to reveal it.";
}

function updateCustomSummaryAndMaybeRestart(event) {
  updateCustomSummary();
  if (event.type === "change" && selectedDifficulty === "custom" && currentMode !== "daily" && currentMode !== "survival") createGame();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    survivalStage = 1;
    survivalTotalSeconds = 0;
    createGame();
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedDifficulty = button.dataset.difficulty;
    createGame();
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    updateThemeControls(button.dataset.themeChoice);
    savePreferences();
  });
});

skinSelect.addEventListener("change", () => {
  currentSkin = skinSelect.value in hazardStyles ? skinSelect.value : "classic";
  document.documentElement.dataset.skin = currentSkin;
  savePreferences();
  game.cells.forEach((_, index) => renderCell(index));
  if (!game.over) messageElement.textContent = skin().name + " on. Same clues, new look.";
});

["#custom-rows", "#custom-columns", "#custom-density"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", updateCustomSummaryAndMaybeRestart);
  document.querySelector(selector).addEventListener("change", updateCustomSummaryAndMaybeRestart);
});

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
  if (game.mode !== "no-flags") toggleFlag(Number(button.dataset.index));
});

boardElement.addEventListener("keydown", (event) => {
  const button = event.target.closest(".cell");
  if (!button) return;
  const index = Number(button.dataset.index);
  const offsets = { ArrowUp: -game.columns, ArrowDown: game.columns, ArrowLeft: -1, ArrowRight: 1 };
  if (!(event.key in offsets)) return;

  const nextIndex = index + offsets[event.key];
  if (event.key === "ArrowLeft" && game.cells[index].column === 0) return;
  if (event.key === "ArrowRight" && game.cells[index].column === game.columns - 1) return;
  if (nextIndex < 0 || nextIndex >= game.cells.length) return;
  event.preventDefault();
  game.cells[index].element.tabIndex = -1;
  game.cells[nextIndex].element.tabIndex = 0;
  game.cells[nextIndex].element.focus();
});

flagToggle.addEventListener("click", () => setFlagMode(!game.flagMode));
newGameButton.addEventListener("click", () => {
  survivalStage = 1;
  survivalTotalSeconds = 0;
  createGame();
});
faceButton.addEventListener("click", () => {
  survivalStage = 1;
  survivalTotalSeconds = 0;
  createGame();
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "f" || event.altKey || event.ctrlKey || event.metaKey || game.over) return;
  if (event.target.closest("button, input, select, textarea, [contenteditable='true']")) return;
  if (currentMode !== "no-flags") setFlagMode(!game.flagMode);
});

updateCustomSummary();
createGame();
