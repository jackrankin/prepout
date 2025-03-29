import "./style.css";
import { ground } from "./board";
import { chess } from "./board";
import { getUserGames } from "./fetch";
import { Tree } from "./search";

const elements = {
  username: document.getElementById("username"),
  websiteOrigin: document.getElementById("websiteOrigin"),
  colorToggle: document.getElementById("colorToggle"),
  icon: document.getElementById("queenIcon"),
  searching: document.getElementById("startSearch"),
  userIsWhite: true,
};

colorToggle.addEventListener("click", () => {
  elements.userIsWhite = !elements.userIsWhite;
  ground.toggleOrientation();
  icon.innerHTML = elements.userIsWhite
    ? `<path fill="black" stroke="black" stroke-width="2" d="M12 2L15 8H9L12 2ZM6 8L9 22H15L18 8H6ZM3 22H21V24H3V22Z"/>`
    : `<path fill="white" stroke="black" stroke-width="2" d="M12 2L15 8H9L12 2ZM6 8L9 22H15L18 8H6ZM3 22H21V24H3V22Z"/>`;
});

searching.addEventListener("click", async () => {
  console.log("FINDING", username.value, "ON", websiteOrigin.value);

  try {
    const games = await getUserGames(
      elements.websiteOrigin.value,
      "jackrankin",
      elements.userIsWhite ? "black" : "white",
      100
    );

    const tree = new Tree(games.pgns);
    tree.parsePGNs();

    const weaknesses = await tree.evalTree(
      chess.fen(),
      "userIsWhite" ? "black" : "white",
      5
    );
    console.log(weaknesses.length, weaknesses);
  } catch (error) {
    console.error("Error fetching games:", error);
  }
});
