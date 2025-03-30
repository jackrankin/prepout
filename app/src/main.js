// main.js
import "./style.css";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import RealTimeEngine from "./realtime_engine";
import Explorer from "./explorer";

// DOM elements
const elements = {
  username: document.getElementById("username"),
  websiteOrigin: document.getElementById("websiteOrigin"),
  colorToggle: document.getElementById("colorToggle"),
  icon: document.getElementById("queenIcon"),
  searching: document.getElementById("startSearch"),
  board: document.getElementById("board"),

  engineEvaluation: document.getElementById("evaluation-score"),
  engineDepth: document.getElementById("engine-depth"),
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
};

// App state
const state = {
  userIsWhite: true,
  engine: new RealTimeEngine(),
  chess: new Chess(),
  ground: null,
  explorer: null,
  moveHistory: [],
  currentMoveIndex: 0,
  currentAnalysisId: 0,
  maxDepth: 35,
};

async function initializeExplorer(username, platform, color, days) {
  try {
    if (elements.explorerMoveList) {
      elements.explorerMoveList.innerHTML =
        '<div class="loading">Loading explorer data...</div>';
    }

    const fen = state.chess.fen();
    state.explorer = new Explorer(username, platform, color, fen, days);
    await state.explorer.initialize();
    state.explorer.render();

    console.log("Explorer initialized successfully");
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

// Board sizing
function resizeBoard() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const size = Math.min(viewportWidth * 0.7, viewportHeight * 0.7);
  elements.board.style.width = `${size}px`;
  elements.board.style.height = `${size}px`;

  // Trigger chessground resize if it's initialized
  if (state.ground) {
    state.ground.redrawAll();
  }
}

// Move history management
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

// Make a move on the board
function makeMove(from, to, promotion = undefined) {
  const move = state.chess.move({ from, to, promotion });
  if (move) {
    updateMoveHistory(move);
    updateBoard();
    return move;
  }
  return null;
}

// Make a move using SAN notation
function makeSanMove(san) {
  const move = state.chess.move(san);
  if (move) {
    updateMoveHistory(move);
    updateBoard();
    return move;
  }
  return null;
}

// Make a move using UCI notation
function makeUCIMove(uci) {
  const move = state.chess.move(uci);
  if (move) {
    updateMoveHistory(move);
    updateBoard();
    return move;
  }
  return null;
}

// Navigation
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

  analyzeCurrentPosition(state.chess.fen(), 25);
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

// Legal moves calculation
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

// Clear evaluation display
function clearEvaluation() {
  for (let i = 0; i < 3; i++) {
    elements.evalScores[i].innerText = "...";
    elements.evalScores[i].className = "";
    elements.evalLines[i].innerText = "";
  }
}

// Engine analysis
async function analyzeCurrentPosition(fen, depth = state.maxDepth) {
  clearEvaluation();
  state.currentAnalysisId = state.engine.analysisId + 1;
  try {
    await state.engine.analyzePosition(fen, depth);
  } catch (e) {
    console.log("Engine analysis error:", e);
  }
}

// Update board state
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

// Initialize application
async function initApp() {
  // Set up initial move history
  state.moveHistory = [{ fen: state.chess.fen(), move: null }];
  state.currentMoveIndex = 0;

  // Create chessground instance
  const config = {
    coordinates: true,
    viewOnly: false,
  };

  state.ground = Chessground(elements.board, config);

  // Initialize engine
  await state.engine.waitForReady();

  // Set up event listeners
  window.addEventListener("resize", resizeBoard);

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
        30
      );
    } catch (error) {
      console.error("Error fetching games:", error);
    }
  });

  // Listen for explorer move selections
  document.addEventListener("explorer-san-move-selected", (e) => {
    const { san } = e.detail;
    makeSanMove(san);
  });

  document.addEventListener("explorer-uci-move-selected", (e) => {
    const { uci } = e.detail;
    makeUCIMove(uci);
  });

  // Initialize board size
  resizeBoard();

  // Initialize board position
  updateBoard();

  // Initialize explorer with default values - you can make these configurable
  // initializeExplorer("username", "lichess", "white", 30);
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
};
