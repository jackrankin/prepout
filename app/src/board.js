import "./style.css";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import Engine from "./engine";

const boardElement = document.getElementById("board");
const boardEvaluation = document.getElementById("evaluation");
const engine = new Engine();

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

setTimeout(() => {
  const cgBoard = boardElement.querySelector(".cg-board");
  if (cgBoard) {
    cgBoard.style.borderRadius = "inherit";
  }
}, 100);

export const ground = Chessground(boardElement, config);
export const chess = new Chess();

const moveHistory = [{ fen: chess.fen(), move: null }];
let currentMoveIndex = 0;

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
          console.log(move.lan);
          console.log("Current position (FEN):", chess.fen());

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

updateBoard();
