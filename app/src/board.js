import "./style.css";
import { Chessground } from "chessground";
import { Chess } from "chess.js";

const boardElement = document.getElementById("board");

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

export const ground = Chessground(boardElement, config);

const chess = new Chess();

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
          updateBoard();
        },
      },
    },
  });
}

updateBoard();
