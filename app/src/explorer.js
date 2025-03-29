import { getUserGames } from "./fetch";
import { Tree } from "./search";

export default class Explorer {
  constructor(username, platform, color, fen, days) {
    this.username = username;
    this.platform = platform;
    this.color = color;
    this.startingPosition = fen;
    this.currentPosition = fen;
    this.days = days;
    this.container = document.getElementById("explorer-move-list");

    this._getTree();
    this._evalTree();
  }

  _getTree() {
    const pgns = getUserGames(
      this.platform,
      this.username,
      this.color,
      this.days
    )
      .then((data) => data)
      .catch((e) => {
        console.log(e);
      });

    this.tree = new Tree(pgns);
  }

  async _evalTree() {
    await this.tree.evalTree(this.startingPosition);
  }
}
