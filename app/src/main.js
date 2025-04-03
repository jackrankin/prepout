import "/assets/style.css";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import RealTimeEngine from "./realtime_engine";
import Explorer from "./explorer";

const elements = {
  username: document.getElementById("username"),
  websiteOrigin: document.getElementById("websiteOrigin"),
  colorToggle: document.getElementById("colorToggle"),
  months: document.getElementById("months"),
  icon: document.getElementById("queenIcon"),
  searching: document.getElementById("startSearch"),
  board: document.getElementById("board"),
  resizeHandle: document.getElementById("resize-handle"),
  container: document.getElementById("container"),

  engineEvaluation: document.getElementById("evaluation-score"),
  engineDepth: document.getElementById("engine-depth"),
  lines: [
    document.getElementById("line1"),
    document.getElementById("line2"),
    document.getElementById("line3"),
  ],
  evalScores: [
    document.getElementById("score1"),
    document.getElementById("score2"),
    document.getElementById("score3"),
  ],
  evalLines: [
    document.getElementById("moves1"),
    document.getElementById("moves2"),
    document.getElementById("moves3"),
  ],

  explorerMoveList: document.getElementById("explorer-move-list"),

  settingsToggle: document.getElementById("settings"),
  settingsPopup: document.getElementById("settings-popup"),
  settingsFooter: document.getElementById("settings-footer"),
  depthSlider: document.getElementById("depth-slider"),
  depthValue: document.getElementById("size-value"),
  blueButton: document.getElementById("blue-button"),
  greenButton: document.getElementById("green-button"),
  brownButton: document.getElementById("brown-button"),
};

const state = {
  userIsWhite: true,
  engine: new RealTimeEngine(),
  chess: new Chess(),
  ground: null,
  explorer: null,
  moveHistory: [],
  currentMoveIndex: 0,
  currentAnalysisId: 0,
  maxDepth: 30,
  lines: [],
  boardTheme: "brown",
};

async function initializeExplorer(username, platform, color, months) {
  try {
    if (elements.explorerMoveList) {
      elements.explorerMoveList.innerHTML =
        '<div class="loading">Loading explorer data...</div>';
    }

    const fen = state.chess.fen();
    state.explorer = new Explorer(username, platform, color, fen, months);
    await state.explorer.initialize();
    state.explorer.render();
  } catch (error) {
    console.error("Failed to initialize explorer:", error);
    if (elements.explorerMoveList) {
      elements.explorerMoveList.innerHTML =
        '<div class="error">Error loading explorer data</div>';
    }
  }
}

function updateExplorerDisplay() {
  if (!state.explorer) return;
  state.explorer.updatePosition(state.chess.fen());
  state.explorer.render();
}

state.engine.onEvaluationUpdate = (evaluations, analysisId) => {
  if (analysisId !== state.currentAnalysisId) return;

  let mx = null;
  let depth = null;
  let prefix = null;
  state.lines = evaluations.map((line) => line.moves[0]);

  evaluations.forEach((line) => {
    const index = line.line - 1;
    if (index >= 0 && index < 3) {
      const scoreValue = (line.score / 100).toFixed(2);
      const scorePrefix = line.score >= 0 ? "+" : "";
      elements.evalScores[index].innerText = `${scorePrefix}${scoreValue}`;

      if (line.score >= 0) {
        elements.evalScores[index].className = "white-advantage";
      } else {
        elements.evalScores[index].className = "black-advantage";
      }

      if (mx === null) {
        prefix = scorePrefix;
        mx = scoreValue;
        depth = line.depth;
      }

      let moveStr = line.moves.slice(0, 10).join(" ");
      if (line.line > 1 && line.centipawnLoss > 0) {
        moveStr += ` (${line.centipawnLoss}cp)`;
      }
      elements.evalLines[index].innerText = moveStr;
    }
  });

  elements.engineEvaluation.innerText = `${prefix}${mx}`;
  elements.engineDepth.innerText = `(d=${depth}/${state.maxDepth})`;
};

function resizeBoard() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const size = Math.min(viewportWidth * 0.7, viewportHeight * 0.7);
  elements.board.style.width = `${size}px`;
  elements.board.style.height = `${size}px`;

  if (state.ground) {
    state.ground.redrawAll();
  }
}

function updateMoveHistory(move) {
  if (state.currentMoveIndex < state.moveHistory.length - 1) {
    state.moveHistory.splice(state.currentMoveIndex + 1);
  }

  state.moveHistory.push({
    move: move,
    fen: state.chess.fen(),
  });

  state.currentMoveIndex = state.moveHistory.length - 1;
}

function makeMove(from, to, promotion = undefined) {
  const move = state.chess.move({ from, to, promotion });
  if (move) {
    updateMoveHistory(move);
    updateBoard();
    return move;
  }
  return null;
}

function makeSanMove(san) {
  const move = state.chess.move(san);
  if (move) {
    updateMoveHistory(move);
    updateBoard();
    return move;
  }
  return null;
}

function makeUCIMove(uci) {
  const move = state.chess.move(uci);
  if (move) {
    updateMoveHistory(move);
    updateBoard();
    return move;
  }
  return null;
}

function navigateMove(direction) {
  if (direction === "prev" && state.currentMoveIndex > 0) {
    state.currentMoveIndex--;
  } else if (
    direction === "next" &&
    state.currentMoveIndex < state.moveHistory.length - 1
  ) {
    state.currentMoveIndex++;
  } else {
    return;
  }

  state.chess.load(state.moveHistory[state.currentMoveIndex].fen);

  analyzeCurrentPosition(state.chess.fen(), state.maxDepth);
  updateExplorerDisplay();

  const lastMove = state.moveHistory[state.currentMoveIndex].move;
  const lastMoveHighlight = lastMove ? [lastMove.from, lastMove.to] : undefined;

  state.ground.set({
    fen: state.chess.fen(),
    turnColor: state.chess.turn() === "w" ? "white" : "black",
    movable: {
      color: state.chess.turn() === "w" ? "white" : "black",
      dests: calculateDests(),
      free: false,
    },
    lastMove: lastMoveHighlight,
  });
}

function calculateDests() {
  const dests = new Map();
  const chess = state.chess;

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const file = String.fromCharCode(97 + j);
      const rank = 8 - i;
      const square = file + rank;
      const piece = chess.get(square);
      if (piece) {
        const moves = chess.moves({ square: square, verbose: true });
        if (moves.length > 0) {
          dests.set(
            square,
            moves.map((m) => m.to)
          );
        }
      }
    }
  }
  return dests;
}

function clearEvaluation() {
  for (let i = 0; i < 3; i++) {
    elements.evalScores[i].innerText = "...";
    elements.evalLines[i].innerText = "...";
  }
}

async function analyzeCurrentPosition(fen, depth = state.maxDepth) {
  clearEvaluation();
  state.currentAnalysisId = state.engine.analysisId + 1;
  try {
    await state.engine.analyzePosition(fen, depth);
  } catch (e) {
    console.log("Engine analysis error:", e);
  }
}

function updateBoard() {
  const dests = calculateDests();

  analyzeCurrentPosition(state.chess.fen(), state.maxDepth);
  updateExplorerDisplay();

  state.ground.set({
    fen: state.chess.fen(),
    turnColor: state.chess.turn() === "w" ? "white" : "black",
    movable: {
      color: state.chess.turn() === "w" ? "white" : "black",
      dests: dests,
      free: false,
      events: {
        after: (orig, dest, metadata) => {
          const move = state.chess.move({
            from: orig,
            to: dest,
            promotion: metadata?.promotion,
          });
          updateMoveHistory(move);
          updateBoard();
        },
      },
    },
  });
}

function toggleSettings() {
  if (elements.settingsFooter.style.display === "flex") {
    elements.settingsFooter.style.display = "none";
  } else {
    elements.settingsFooter.style.display = "flex";
  }
}

function updateBoardTheme(theme) {
  const cgBoard = document.querySelector("cg-board");
  if (!cgBoard) return;

  cgBoard.style.backgroundImage = "none";

  switch (theme) {
    case "blue":
      cgBoard.style.backgroundImage = "url('/images/blue.svg')";
      break;
    case "green":
      cgBoard.style.backgroundImage = "url('/images/green.png')";
      break;
    case "brown":
      cgBoard.style.backgroundImage = "url('/images/brown.png')";
      break;
    default:
      cgBoard.style.backgroundImage = "url('/images/brown.png')";
  }

  elements.blueButton.style.border =
    theme === "blue" ? "2px solid white" : "2px solid transparent";
  elements.greenButton.style.border =
    theme === "green" ? "2px solid white" : "2px solid transparent";
  elements.brownButton.style.border =
    theme === "brown" ? "2px solid white" : "2px solid transparent";

  state.boardTheme = theme;
}

async function initApp() {
  state.moveHistory = [{ fen: state.chess.fen(), move: null }];
  state.currentMoveIndex = 0;

  const config = {
    coordinates: false,
    viewOnly: false,
  };

  state.ground = Chessground(elements.board, config);

  await state.engine.waitForReady();

  window.addEventListener("resize", resizeBoard);

  elements.settingsToggle.addEventListener("click", toggleSettings);

  document.addEventListener("click", (e) => {
    if (
      !elements.settingsPopup.contains(e.target) &&
      e.target !== elements.settingsToggle
    ) {
      elements.settingsFooter.style.display = "none";
    }
  });

  elements.colorToggle.addEventListener("click", () => {
    state.userIsWhite = !state.userIsWhite;
    state.ground.toggleOrientation();
    elements.icon.innerHTML = state.userIsWhite
      ? `<path fill="white" stroke="black" stroke-width="2" d="M12 2L15 8H9L12 2ZM6 8L9 22H15L18 8H6ZM3 22H21V24H3V22Z"/>`
      : `<path fill="black" stroke="black" stroke-width="2" d="M12 2L15 8H9L12 2ZM6 8L9 22H15L18 8H6ZM3 22H21V24H3V22Z"/>`;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      navigateMove("prev");
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      navigateMove("next");
      e.preventDefault();
    }
  });

  elements.searching.addEventListener("click", async () => {
    try {
      initializeExplorer(
        elements.username.value,
        elements.websiteOrigin.value,
        state.userIsWhite ? "white" : "black",
        parseInt(elements.months.value)
      );
    } catch (error) {
      console.error("Error fetching games:", error);
    }
  });

  for (let i = 0; i < 3; i++) {
    elements.lines[i].addEventListener("mouseenter", () => {
      state.ground.set({
        drawable: {
          shapes: [
            {
              orig: state.lines[i].substring(0, 2),
              dest: state.lines[i].substring(2, 4),
              brush: "green",
            },
          ],
        },
      });
    });

    elements.lines[i].addEventListener("mouseleave", () => {
      state.ground.set({
        drawable: {
          shapes: [],
        },
      });
    });

    elements.lines[i].addEventListener("click", () => {
      makeUCIMove(state.lines[i]);
    });
  }

  elements.resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();

    const minSize = 200;
    const maxSize = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.7);

    function onMouseMove(event) {
      let newSize = Math.min(
        event.clientX - elements.container.offsetLeft,
        event.clientY - elements.container.offsetTop
      );

      newSize = Math.max(minSize, newSize);
      newSize = Math.min(maxSize, newSize);

      elements.board.style.width = `${newSize}px`;
      elements.board.style.height = `${newSize}px`;

      if (state.ground) {
        state.ground.redrawAll();
      }
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  document.addEventListener("explorer-san-move-selected", (e) => {
    const { san } = e.detail;
    makeSanMove(san);
  });

  document.addEventListener("explorer-uci-move-selected", (e) => {
    const { uci } = e.detail;
    makeUCIMove(uci);
  });

  elements.depthSlider.addEventListener("input", () => {
    const newDepth = parseInt(elements.depthSlider.value, 10);
    state.maxDepth = newDepth;
    elements.depthValue.textContent = newDepth;

    analyzeCurrentPosition(state.chess.fen(), state.maxDepth);
  });

  elements.blueButton.addEventListener("click", () => updateBoardTheme("blue"));
  elements.greenButton.addEventListener("click", () =>
    updateBoardTheme("green")
  );
  elements.brownButton.addEventListener("click", () =>
    updateBoardTheme("brown")
  );

  resizeBoard();
  updateBoard();
}

// Clean up resources on page unload
window.addEventListener("beforeunload", () => {
  state.engine.dispose();
});

// Start the application
initApp();

// Export some functions for external use
window.chessFunctions = {
  makeMove,
  makeSanMove,
  makeUCIMove,
  navigateMove,
  initializeExplorer,
  updateBoardTheme,
  setEngineDepth: (depth) => {
    state.maxDepth = depth;
    elements.depthSlider.value = depth;
    elements.depthValue.textContent = depth;
    analyzeCurrentPosition(state.chess.fen(), depth);
  },
};
