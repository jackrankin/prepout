import "./style.css";
import { ground } from "./board";
import { getUserGames } from "./fetch";
import { Tree } from "./search";

const username = document.getElementById("username");
const websiteOrigin = document.getElementById("websiteOrigin");
const colorToggle = document.getElementById("colorToggle");
const icon = document.getElementById("queenIcon");
const searching = document.getElementById("startSearch");
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

    // const tree = new Tree(games.pgns);
    // tree.parsePGNs();

    const tree = new Tree([]);
  } catch (error) {
    console.error("Error fetching games:", error);
  }
});
