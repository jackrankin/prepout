import "./style.css";
import { ground } from "./board";
import { chess } from "./board";
import { getUserGames } from "./fetch";
import { Tree } from "./search";
import Engine from "./engine";

const username = document.getElementById("username");
const websiteOrigin = document.getElementById("websiteOrigin");
const colorToggle = document.getElementById("colorToggle");
const icon = document.getElementById("queenIcon");
const searching = document.getElementById("startSearch");
const engine = new Engine();

const analyzeFen = async (fen) => {
  try {
    const analysis = await engine.analyzePosition(fen, 20);
    console.log(analysis);

    console.log("Analysis Results:");
    analysis.forEach((line) => {
      console.log(
        `Line ${line.line}: Score ${line.score / 100}, Centipawn Loss: ${
          line.centipawnLoss / 100
        }`
      );
      console.log(`   Moves: ${line.moves.slice(0, 5).join(" ")}...`);
    });
  } finally {
    engine.dispose();
  }
};

let userIsWhite = true;

colorToggle.addEventListener("click", () => {
  userIsWhite = !userIsWhite;
  ground.toggleOrientation();
  icon.innerHTML = userIsWhite
    ? `<path fill="black" stroke="black" stroke-width="2" d="M12 2L15 8H9L12 2ZM6 8L9 22H15L18 8H6ZM3 22H21V24H3V22Z"/>`
    : `<path fill="white" stroke="black" stroke-width="2" d="M12 2L15 8H9L12 2ZM6 8L9 22H15L18 8H6ZM3 22H21V24H3V22Z"/>`;
});

searching.addEventListener("click", async () => {
  console.log("FINDING", username.value, "ON", websiteOrigin.value);

  try {
    // const games = await getUserGames(
    //   websiteOrigin.value,
    //   username.value,
    //   userIsWhite ? "black" : "white",
    //   100
    // );
    const fen = chess.fen();
    await analyzeFen(fen);

    // const tree = new Tree(games.pgns);
    // tree.parsePGNs();
    // const weaknesses = await tree.findWeaknesses(
    //   chess.fen(),
    //   "userIsWhite" ? "black" : "white"
    // );
    // console.log(weaknesses.length, weaknesses);
  } catch (error) {
    console.error("Error fetching games:", error);
  }
});
