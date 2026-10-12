"use strict";

const levels = {
  beginner: { rows: 9, columns: 9, mines: 10, label: "Easy" },
  intermediate: { rows: 16, columns: 16, mines: 40, label: "Medium" },
  expert: { rows: 16, columns: 30, mines: 99, label: "Expert" }
};

const boardElement = document.querySelector("#board");
const boardViewport = document.querySelector("#board-viewport");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const bestTimeElement = document.querySelector("#best-time");
const messageElement = document.querySelector("#game-message");
const messageTextElement = document.querySelector("#message-text");
const boardSizeElement = document.querySelector("#board-size");
const mineTotalElement = document.querySelector("#mine-total");
const faceButton = document.querySelector("#face-button");
const flagToggle = document.querySelector("#flag-toggle");
const flagLabel = document.querySelector("#flag-label");
const resultPanel = document.querySelector("#result-panel");
const resultIcon = document.querySelector("#result-icon");
const resultEyebrow = document.querySelector("#result-eyebrow");
const resultTitle = document.querySelector("#result-title");
const resultCopy = document.querySelector("#result-copy");
const helpDialog = document.querySelector("#help-dialog");
const liveStateElement = document.querySelector("#live-state");

let selectedLevel = "beginner";
let game = null;
let timerId = null;

function safeStorageGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeStorageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* A private game still works without saved records. */ }
}

function recordKey(level) {
  return "minefield:classic:best:" + level;
}

function formatCounter(value) {
  const bounded = Math.max(-99, Math.min(999, value));
  return String(bounded).padStart(3, "0");
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
}

function getBest(level) {
  const stored = safeStorageGet(recordKey(level));
  if (stored === null) return null;
  const value = Number(stored);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function updateBest() {
  const best = getBest(selectedLevel);
  bestTimeElement.textContent = best === null ? "—" : formatTime(best);
}

function createGame(level) {
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null;
  selectedLevel = level;
  const settings = levels[level] || levels.beginner;

  game = {
    level: level,
    rows: settings.rows,
    columns: settings.columns,
    mines: settings.mines,
    cells: [],
    opened: 0,
    flags: 0,
    started: false,
    over: false,
    won: false,
    flagMode: false,
    elapsed: 0,
    startedAt: 0
  };

  document.querySelectorAll(".size-option").forEach((button) => {
    const active = button.dataset.level === selectedLevel;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(active));
  });

  boardSizeElement.textContent = settings.columns + " × " + settings.rows;
  mineTotalElement.textContent = settings.mines + (settings.mines === 1 ? " mine" : " mines");
  boardElement.className = "board";
  boardElement.setAttribute("aria-label", settings.rows + " rows by " + settings.columns + " columns. Use arrow keys to move.");
  boardElement.setAttribute("aria-rowcount", String(settings.rows));
  boardElement.setAttribute("aria-colcount", String(settings.columns));
  boardElement.inert = false;
  boardElement.replaceChildren();

  for (let row = 0; row < game.rows; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";
    rowElement.setAttribute("role", "row");
    rowElement.setAttribute("aria-rowindex", String(row + 1));

    for (let column = 0; column < game.columns; column += 1) {
      const index = row * game.columns + column;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.index = String(index);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-rowindex", String(row + 1));
      button.setAttribute("aria-colindex", String(column + 1));
      button.tabIndex = index === 0 ? 0 : -1;
      button.setAttribute("aria-label", "Row " + (row + 1) + ", column " + (column + 1) + ", covered");
      const value = document.createElement("span");
      button.append(value);

      const cell = {
        row: row,
        column: column,
        mine: false,
        adjacent: 0,
        opened: false,
        flagged: false,
        exploded: false,
        element: button,
        label: value
      };
      game.cells.push(cell);
      rowElement.append(button);
    }
    boardElement.append(rowElement);
  }

  setFlagMode(false, false);
  resultPanel.hidden = true;
  resultPanel.classList.remove("is-loss");
  messageElement.classList.remove("is-alert");
  messageTextElement.textContent = "Your first move is always safe.";
  liveStateElement.textContent = "READY TO PLAY";
  faceButton.innerHTML = "<span aria-hidden=\"true\">↻</span>";
  faceButton.setAttribute("aria-label", "Start a new game");
  updateHud();
  updateBest();
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

function placeMines(safeIndex) {
  const safeZone = new Set([safeIndex, ...neighborsOf(safeIndex)]);
  const available = game.cells.map((cell, index) => index).filter((index) => !safeZone.has(index));

  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  for (let i = 0; i < game.mines; i += 1) game.cells[available[i]].mine = true;

  game.cells.forEach((cell, index) => {
    if (!cell.mine) {
      cell.adjacent = neighborsOf(index).filter((neighborIndex) => game.cells[neighborIndex].mine).length;
    }
  });
}

function updateHud() {
  mineCountElement.textContent = formatCounter(game.mines - game.flags);
  timerElement.textContent = formatCounter(game.elapsed);
}

function updateCell(index) {
  const cell = game.cells[index];
  const button = cell.element;
  button.classList.remove("is-open", "is-flagged", "is-mine", "is-exploded", "is-wrong");
  for (let number = 1; number <= 8; number += 1) button.classList.remove("number-" + number);
  button.disabled = false;
  cell.label.textContent = "";

  const position = "Row " + (cell.row + 1) + ", column " + (cell.column + 1) + ", ";

  if (cell.opened) {
    button.classList.add("is-open");
    if (cell.mine) {
      button.classList.add("is-mine");
      if (cell.exploded) button.classList.add("is-exploded");
      button.setAttribute("aria-label", position + (cell.exploded ? "mine, exploded" : "mine"));
    } else if (cell.adjacent > 0) {
      button.classList.add("number-" + cell.adjacent);
      cell.label.textContent = String(cell.adjacent);
      button.setAttribute("aria-label", position + cell.adjacent + (cell.adjacent === 1 ? " nearby mine" : " nearby mines"));
    } else {
      button.setAttribute("aria-label", position + "empty, revealed");
    }
  } else if (cell.flagged) {
    button.classList.add("is-flagged");
    button.setAttribute("aria-label", position + "flagged");
  } else {
    button.setAttribute("aria-label", position + "covered");
    if (cell.mine && game.over) {
      button.classList.add("is-open", "is-mine");
      button.setAttribute("aria-label", position + "mine");
    }
  }

  if (game.over && cell.flagged && !cell.mine) {
    button.classList.add("is-wrong");
    button.setAttribute("aria-label", position + "incorrect flag");
  }
}

function reveal(index) {
  if (game.over) return;
  const cell = game.cells[index];
  if (cell.opened) {
    chord(index);
    return;
  }
  if (cell.flagged) return;

  if (!game.started) {
    placeMines(index);
    game.started = true;
    game.startedAt = Date.now();
    liveStateElement.textContent = "IN PROGRESS";
    timerId = window.setInterval(updateClock, 250);
    messageTextElement.textContent = "Look for a safe path through the field.";
  }

  if (cell.mine) {
    cell.opened = true;
    cell.exploded = true;
    updateCell(index);
    finishGame(false, "mine");
    return;
  }

  openSafeCell(index);
  checkForWin();
}

function openSafeCell(index) {
  const cell = game.cells[index];
  if (cell.opened || cell.flagged || cell.mine) return;
  cell.opened = true;
  game.opened += 1;
  updateCell(index);

  if (cell.adjacent === 0) {
    neighborsOf(index).forEach((neighborIndex) => {
      const neighbor = game.cells[neighborIndex];
      if (!neighbor.opened && !neighbor.flagged && !neighbor.mine) openSafeCell(neighborIndex);
    });
  }
}

function chord(index) {
  if (game.over || !game.started) return;
  const cell = game.cells[index];
  if (!cell.opened || cell.mine || cell.adjacent === 0) return;
  const neighbors = neighborsOf(index);
  const flagCount = neighbors.filter((neighborIndex) => game.cells[neighborIndex].flagged).length;

  if (flagCount !== cell.adjacent) {
    messageElement.classList.add("is-alert");
    messageTextElement.textContent = flagCount + " flags around this tile; the clue needs " + cell.adjacent + ".";
    return;
  }

  for (const neighborIndex of neighbors) {
    if (!game.cells[neighborIndex].opened && !game.cells[neighborIndex].flagged) reveal(neighborIndex);
    if (game.over) return;
  }
  checkForWin();
}

function toggleFlag(index) {
  if (game.over) return;
  const cell = game.cells[index];
  if (cell.opened) return;

  if (!cell.flagged && game.flags >= game.mines) {
    messageElement.classList.add("is-alert");
    messageTextElement.textContent = "All flags are in use. Remove one before marking another tile.";
    return;
  }

  cell.flagged = !cell.flagged;
  game.flags += cell.flagged ? 1 : -1;
  updateCell(index);
  updateHud();
  messageElement.classList.remove("is-alert");
  messageTextElement.textContent = cell.flagged ? "Tile marked. Keep following the clues." : "Flag removed.";
}

function checkForWin() {
  if (game.opened === game.rows * game.columns - game.mines) finishGame(true, "clear");
}

function finishGame(won, reason) {
  if (game.started) updateClock();
  game.over = true;
  game.won = won;
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null;

  game.cells.forEach((cell, index) => {
    if (cell.mine && !cell.opened) {
      cell.opened = true;
      updateCell(index);
    } else if (cell.flagged && !cell.mine) {
      updateCell(index);
    }
  });

  if (won) {
    const best = getBest(selectedLevel);
    const isRecord = best === null || game.elapsed < best;
    if (isRecord) safeStorageSet(recordKey(selectedLevel), String(game.elapsed));
    resultPanel.classList.remove("is-loss");
    resultIcon.textContent = "✦";
    resultEyebrow.textContent = isRecord ? "NEW PERSONAL BEST" : "FIELD CLEARED";
    resultTitle.textContent = isRecord ? "A new best." : "Nicely done.";
    resultCopy.textContent = "You cleared the " + levels[selectedLevel].label.toLowerCase() + " field in " + formatTime(game.elapsed) + ".";
    messageTextElement.textContent = isRecord ? "A new personal best — " + formatTime(game.elapsed) + "." : "Field cleared in " + formatTime(game.elapsed) + ".";
    faceButton.innerHTML = "<span aria-hidden=\"true\">✓</span>";
    faceButton.setAttribute("aria-label", "Start a new game");
  } else {
    resultPanel.classList.add("is-loss");
    resultIcon.textContent = "×";
    resultEyebrow.textContent = "MINE FOUND";
    resultTitle.textContent = "One move too far.";
    resultCopy.textContent = "Take a breath. The next field is ready when you are.";
    messageTextElement.textContent = reason === "mine" ? "Mine hit. Start a fresh field when you’re ready." : "Game over.";
    faceButton.innerHTML = "<span aria-hidden=\"true\">×</span>";
    faceButton.setAttribute("aria-label", "Start a new game");
  }

  resultPanel.hidden = false;
  boardElement.inert = true;
  liveStateElement.textContent = won ? "FIELD CLEARED" : "FIELD ENDED";
  updateHud();
  updateBest();
  document.querySelector("#result-again").focus();
}

function updateClock() {
  if (!game.started || game.over) return;
  game.elapsed = Math.floor((Date.now() - game.startedAt) / 1000);
  timerElement.textContent = formatCounter(game.elapsed);
}

function setFlagMode(enabled, announce) {
  game.flagMode = enabled;
  flagToggle.setAttribute("aria-pressed", String(enabled));
  flagLabel.textContent = enabled ? "Flag mode on" : "Flag mode";
  flagToggle.setAttribute("aria-label", enabled ? "Turn flag mode off" : "Turn flag mode on");
  if (announce !== false) {
    messageElement.classList.remove("is-alert");
    messageTextElement.textContent = enabled ? "Flag mode on. Choose tiles to mark." : "Flag mode off. Choose tiles to reveal.";
  }
}

function focusCell(row, column) {
  const boundedRow = Math.max(0, Math.min(game.rows - 1, row));
  const boundedColumn = Math.max(0, Math.min(game.columns - 1, column));
  const nextIndex = boundedRow * game.columns + boundedColumn;
  boardElement.querySelectorAll(".cell").forEach((button) => { button.tabIndex = -1; });
  const nextButton = game.cells[nextIndex].element;
  nextButton.tabIndex = 0;
  nextButton.focus();
  const rect = nextButton.getBoundingClientRect();
  const viewportRect = boardViewport.getBoundingClientRect();
  if (rect.left < viewportRect.left) boardViewport.scrollLeft -= viewportRect.left - rect.left;
  if (rect.right > viewportRect.right) boardViewport.scrollLeft += rect.right - viewportRect.right;
}

document.querySelectorAll(".size-option").forEach((button) => {
  button.addEventListener("click", () => createGame(button.dataset.level));
});

document.querySelector("#new-game").addEventListener("click", () => createGame(selectedLevel));
faceButton.addEventListener("click", () => createGame(selectedLevel));
document.querySelector("#result-again").addEventListener("click", () => createGame(selectedLevel));
flagToggle.addEventListener("click", () => setFlagMode(!game.flagMode));

boardElement.addEventListener("click", (event) => {
  const button = event.target.closest(".cell");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (game.flagMode) toggleFlag(index);
  else reveal(index);
});

boardElement.addEventListener("focusin", (event) => {
  const button = event.target.closest(".cell");
  if (!button) return;
  boardElement.querySelectorAll(".cell").forEach((cell) => { cell.tabIndex = -1; });
  button.tabIndex = 0;
});

boardElement.addEventListener("contextmenu", (event) => {
  const button = event.target.closest(".cell");
  if (!button) return;
  event.preventDefault();
  toggleFlag(Number(button.dataset.index));
});

boardElement.addEventListener("keydown", (event) => {
  const button = event.target.closest(".cell");
  if (!button) return;
  const cell = game.cells[Number(button.dataset.index)];

  if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const rowChange = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    const columnChange = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    focusCell(cell.row + rowChange, cell.column + columnChange);
  } else if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    setFlagMode(!game.flagMode);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "f" || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest("button, input, select, textarea, dialog")) return;
  if (!event.target.closest("#board")) setFlagMode(!game.flagMode);
});

document.querySelector("#help-open").addEventListener("click", () => helpDialog.showModal());
document.querySelector("#help-close").addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) helpDialog.close();
});

createGame(selectedLevel);
