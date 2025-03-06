import "./style.css";
import { ground } from "./board";

const username = document.getElementById("username");
const websiteOrigin = document.getElementById("websiteOrigin");
const colorToggle = document.getElementById("colorToggle");
const icon = document.getElementById("queenIcon");
const searching = document.getElementById("startSearch");
let userIsWhite = true;

searching.addEventListener("click", () => {
  console.log(chess.fen());
});

colorToggle.addEventListener("click", () => {
  userIsWhite = !userIsWhite;
  ground.toggleOrientation();
  icon.innerHTML = userIsWhite
    ? `<path fill="black" stroke="black" stroke-width="2" d="M12 2L15 8H9L12 2ZM6 8L9 22H15L18 8H6ZM3 22H21V24H3V22Z"/>`
    : `<path fill="white" stroke="black" stroke-width="2" d="M12 2L15 8H9L12 2ZM6 8L9 22H15L18 8H6ZM3 22H21V24H3V22Z"/>`;
});
