// explorer.js
import { getUserGames } from "./fetch";
import { Tree } from "./tree";

export default class Explorer {
  constructor(username, platform, color, fen, months) {
    this.username = username;
    this.platform = platform;
    this.color = color;
    this.startingPosition = fen;
    this.currentPosition = fen;
    this.months = months;
    this.container = document.getElementById("explorer-move-list");
    this.tree = null;
    this.pgns = null;
    this.isInitialized = false;
    this.isLoading = false;
    this.children = [];

    document.addEventListener("explorer-node-evaluated", (event) => {
      if (this.children.some((child) => child.fen === event.detail.fen)) {
        this.render();
      }
    });
  }

  async initialize() {
    if (this.isInitialized) return this;
    this.isLoading = true;

    try {
      this.pgns = await this._fetchGames();

      this.tree = new Tree(this.pgns, this.color);
      await this.tree.initialize();

      this.isInitialized = true;
      this.isLoading = false;

      return this;
    } catch (error) {
      this.isLoading = false;
      console.error("Explorer initialization failed:", error);
      throw error;
    }
  }

  async _fetchGames() {
    try {
      return await getUserGames(
        this.platform,
        this.username,
        this.color,
        this.months
      );
    } catch (error) {
      console.error("Failed to fetch games:", error);
      throw error;
    }
  }

  async _evalTree() {
    if (!this.tree) {
      throw new Error("Tree not initialized");
    }

    await this.tree.evalTree(this.startingPosition);
  }

  getMovesForPosition(fen = null) {
    if (!this.isInitialized || !this.tree) {
      return [];
    }

    const position = fen || this.currentPosition;
    return this.tree.getMovesForPosition(position);
  }

  updatePosition(fen) {
    this.currentPosition = fen;
    this._startBackgroundEval();

    return this.getMovesForPosition();
  }

  async _startBackgroundEval() {
    if (!this.tree.fenNode.has(this.currentPosition)) {
      return;
    }

    if (this.tree.fenNode.get(this.currentPosition).evaluated) {
      return;
    }

    this.tree.evaluating = true;

    try {
      await this.tree.evalTree(this.currentPosition);
    } catch (error) {
      console.error("Background eval failed:", error);
    } finally {
      this.tree.evaluating = false;
    }
  }

  async refresh(username, platform, color, days) {
    if (username) this.username = username;
    if (platform) this.platform = platform;
    if (color) this.color = color;
    if (days) this.days = days;

    this.isInitialized = false;
    return await this.initialize();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = "";

    if (this.isLoading) {
      this.container.innerHTML =
        '<div class="loading">Loading explorer data...</div>';
      return;
    }

    if (!this.isInitialized) {
      this.container.innerHTML =
        '<div class="not-initialized">Explorer not initialized</div>';
      return;
    }

    const moves = this.getMovesForPosition(this.currentPosition);
    this.children = moves;

    if (moves.length === 0) {
      this.container.innerHTML =
        '<div class="no-moves">No games found for this position</div>';
      return;
    }

    moves.forEach((move, idx) => {
      const moveElement = document.createElement("li");
      moveElement.className = `explorer-move-${idx % 2}`;
      moveElement.innerHTML = `
        <div style="width: 70px;">${move.san + move.moveSuperScript}</div>
        <div style="width: 50px;">${move.count}</div>
        <div style="width: 50px;">${Math.round(move.winPercentage)}%</div>
        <div style="width: 50px;">${
          (move.evaluation >= 0 ? "+" : "-") +
          Math.abs(move.evaluation).toFixed(2)
        }</div>
      `;
      moveElement.addEventListener("click", () => {
        const event = new CustomEvent("explorer-san-move-selected", {
          detail: { san: move.san, fen: move.fen },
        });

        // const event = new CustomEvent("explorer-uci-move-selected", {
        //   detail: { uci: move.uci, fen: move.fen },
        // });
        document.dispatchEvent(event);
      });

      this.container.appendChild(moveElement);
    });
  }
}
