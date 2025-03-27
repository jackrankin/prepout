import "./style.css";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import RealTimeEngine from "./realtime_engine";

const boardElement = document.getElementById("board");

const engineEvaluation = document.getElementById("evaluation-score");
const engineDepth = document.getElementById("engine-depth");

const evalScores = [
  document.getElementById("score1"),
  document.getElementById("score2"),
  document.getElementById("score3"),
];

const evalLines = [
  document.getElementById("moves1"),
  document.getElementById("moves2"),
  document.getElementById("moves3"),
];

const engine = new RealTimeEngine();
let currentAnalysisId = 0;

engine.onEvaluationUpdate = (evaluations, analysisId) => {
  if (analysisId !== currentAnalysisId) return;
  let mx = null;
  let depth = null;
  let prefix = null;

  evaluations.forEach((line) => {
    const index = line.line - 1;
    if (index >= 0 && index < 3) {
      const scoreValue = (line.score / 100).toFixed(2);
      const scorePrefix = line.score >= 0 ? "+" : "";
      evalScores[index].innerText = `${scorePrefix}${scoreValue}`;

      if (line.score >= 0) {
        evalScores[index].className = "white-advantage";
      } else {
        evalScores[index].className = "black-advantage";
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
      evalLines[index].innerText = moveStr;
    }
  });
  engineEvaluation.innerText = `${prefix}${mx}`;
  engineDepth.innerText = `(d=${depth})`;
};

function resizeBoard() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const size = Math.min(viewportWidth * 0.7, viewportHeight * 0.7);
  boardElement.style.width = `${size}px`;
  boardElement.style.height = `${size}px`;
}

window.addEventListener("resize", resizeBoard);
resizeBoard();

const config = {
  coordinates: true,
  viewOnly: false,
};

const board = Chessground(boardElement, config);

export const ground = Chessground(boardElement, config);
export const chess = new Chess();

const moveHistory = [{ fen: chess.fen(), move: null }];
let currentMoveIndex = 0;

function clearEvaluation() {
  for (let i = 0; i < 3; i++) {
    evalScores[i].innerText = "...";
    evalScores[i].className = "";
    evalLines[i].innerText = "";
  }
}

async function analyzeCurrentPosition(fen, depth = 25) {
  clearEvaluation();
  currentAnalysisId = engine.analysisId + 1;
  try {
    const results = await engine.analyzePosition(fen, depth);
  } catch (e) {
    console.log("Engine analysis error:", e);
  }
}

function updateBoard() {
  const dests = new Map();
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

  analyzeCurrentPosition(chess.fen(), 25);

  ground.set({
    fen: chess.fen(),
    turnColor: chess.turn() === "w" ? "white" : "black",
    movable: {
      color: chess.turn() === "w" ? "white" : "black",
      dests: dests,
      free: false,
      events: {
        after: (orig, dest) => {
          const move = chess.move({ from: orig, to: dest });

          if (currentMoveIndex < moveHistory.length - 1) {
            moveHistory.splice(currentMoveIndex + 1);
          }
          moveHistory.push({
            move: move,
            fen: chess.fen(),
          });
          currentMoveIndex = moveHistory.length - 1;

          updateBoard();
        },
      },
    },
  });
}

function navigateMove(direction) {
  if (direction === "prev" && currentMoveIndex > 0) {
    currentMoveIndex--;
  } else if (
    direction === "next" &&
    currentMoveIndex < moveHistory.length - 1
  ) {
    currentMoveIndex++;
  } else {
    return;
  }

  chess.load(moveHistory[currentMoveIndex].fen);

  analyzeCurrentPosition(chess.fen(), 25);

  const lastMove = moveHistory[currentMoveIndex].move;
  const lastMoveHighlight = lastMove ? [lastMove.from, lastMove.to] : undefined;

  ground.set({
    fen: chess.fen(),
    turnColor: chess.turn() === "w" ? "white" : "black",
    movable: {
      color: chess.turn() === "w" ? "white" : "black",
      dests: calculateDests(),
      free: false,
    },
    lastMove: lastMoveHighlight,
  });
}

function calculateDests() {
  const dests = new Map();
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

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    navigateMove("prev");
    e.preventDefault();
  } else if (e.key === "ArrowRight") {
    navigateMove("next");
    e.preventDefault();
  }
});

window.addEventListener("beforeunload", () => {
  engine.dispose();
});

engine.waitForReady().then(() => {
  console.log("Engine ready");
  updateBoard();
});
