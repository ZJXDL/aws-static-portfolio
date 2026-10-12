"use strict";

const levels = {
  beginner: { rows: 9, columns: 9, mines: 10 },
  intermediate: { rows: 16, columns: 16, mines: 40 },
  expert: { rows: 16, columns: 30, mines: 99 }
};

const boardElement = document.querySelector("#board");
const difficultyElement = document.querySelector("#difficulty");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const messageElement = document.querySelector("#game-message");
const flagToggle = document.querySelector("#flag-toggle");
const faceButton = document.querySelector("#face-button");
const newGameButton = document.querySelector("#new-game");

let game;

function createGame() {
  if (game?.timerId) window.clearInterval(game.timerId);

  const level = levels[difficultyElement.value] || levels.beginner;
  game = {
    ...level,
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
  flagToggle.setAttribute("aria-pressed", "false");
  mineCountElement.textContent = formatCounter(game.mines);
  timerElement.textContent = "000";
  messageElement.textContent = "Tap a tile to begin.";
  faceButton.textContent = "☺";
  faceButton.setAttribute("aria-label", "Start a new game");
  faceButton.classList.remove("is-happy", "is-sad");
}

function formatCounter(value) {
  return String(value).padStart(3, "0");
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
  const safeArea = new Set([safeIndex, ...neighborsOf(safeIndex)]);
  const candidates = game.cells.map((_, index) => index).filter((index) => !safeArea.has(index));

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  candidates.slice(0, game.mines).forEach((index) => {
    game.cells[index].mine = true;
  });

  game.cells.forEach((cell, index) => {
    if (!cell.mine) {
      cell.adjacent = neighborsOf(index).filter((neighbor) => game.cells[neighbor].mine).length;
    }
  });
}

function startTimer() {
  if (game.started) return;
  game.started = true;
  game.timerId = window.setInterval(() => {
    game.seconds = Math.min(999, game.seconds + 1);
    timerElement.textContent = formatCounter(game.seconds);
  }, 1000);
}

function updateMineCount() {
  mineCountElement.textContent = formatCounter(game.mines - game.flags);
}

function renderCell(index) {
  const cell = game.cells[index];
  const button = cell.element;
  button.classList.toggle("is-open", cell.opened);
  button.classList.toggle("is-flagged", cell.flagged);
  button.classList.toggle("is-mine", cell.opened && cell.mine);
  button.classList.toggle("is-exploded", cell.exploded === true);
  button.classList.toggle("is-wrong", cell.wrong === true);
  button.dataset.number = cell.opened && cell.adjacent ? String(cell.adjacent) : "";
  button.textContent = cell.flagged ? "⚑" : (cell.opened && cell.mine ? "✹" : (cell.opened && cell.adjacent ? String(cell.adjacent) : ""));
  button.setAttribute("aria-label", accessibleCellName(cell));
}

function accessibleCellName(cell) {
  const position = "Row " + (cell.row + 1) + ", column " + (cell.column + 1);
  if (cell.wrong) return position + ", incorrect flag";
  if (cell.flagged) return position + ", flagged as a mine";
  if (!cell.opened) return position + ", covered square";
  if (cell.mine) return position + ", mine";
  if (cell.adjacent === 0) return position + ", empty";
  return position + ", " + cell.adjacent + (cell.adjacent === 1 ? " mine nearby" : " mines nearby");
}

function toggleFlag(index) {
  const cell = game.cells[index];
  if (game.over || cell.opened) return;
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
    startTimer();
  }

  if (cell.mine) {
    cell.opened = true;
    cell.exploded = true;
    finishGame(false);
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

function finishGame(won) {
  game.over = true;
  game.won = won;
  game.flagMode = false;
  flagToggle.setAttribute("aria-pressed", "false");
  if (game.timerId) window.clearInterval(game.timerId);

  if (won) {
    messageElement.textContent = "Board cleared!";
    faceButton.textContent = "✓";
    faceButton.setAttribute("aria-label", "You won. Start a new game");
    faceButton.classList.add("is-happy");
  } else {
    game.cells.forEach((cell, index) => {
      if (cell.mine) cell.opened = true;
      else if (cell.flagged) cell.wrong = true;
      renderCell(index);
    });
    messageElement.textContent = "Mine hit.";
    faceButton.textContent = "×";
    faceButton.setAttribute("aria-label", "Game over. Start a new game");
    faceButton.classList.add("is-sad");
  }
}

function setFlagMode(enabled) {
  if (game.over) return;
  game.flagMode = enabled;
  flagToggle.setAttribute("aria-pressed", String(enabled));
  messageElement.textContent = enabled ? "Flag mode on." : "Flag mode off.";
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
difficultyElement.addEventListener("change", createGame);
newGameButton.addEventListener("click", createGame);
faceButton.addEventListener("click", createGame);

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "f" || event.altKey || event.ctrlKey || event.metaKey || game.over) return;
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
  setFlagMode(!game.flagMode);
});

createGame();
