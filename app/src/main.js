import "./style.css";
import { Chessground } from "chessground";

const boardElement = document.getElementById("board");

function resizeBoard() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const size = Math.min(viewportWidth * 0.8, viewportHeight * 0.8);

  boardElement.style.width = `${size}px`;
  boardElement.style.height = `${size}px`;
}

window.addEventListener("resize", resizeBoard);
resizeBoard();

const config = {
  coordinates: true,
  viewOnly: false,
};
const ground = Chessground(boardElement, config);
