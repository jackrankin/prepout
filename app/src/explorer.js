// explorer.js
import { getUserGames } from "./fetch";
import { Tree } from "./tree";

export default class Explorer {
  constructor(username, platform, color, fen, days) {
    this.username = username;
    this.platform = platform;
    this.color = color;
    this.startingPosition = fen;
    this.currentPosition = fen;
    this.days = days;
    this.container = document.getElementById("explorer-move-list");
    this.tree = null;
    this.pgns = null;
    this.isInitialized = false;
    this.isLoading = false;
  }

  async initialize() {
    if (this.isInitialized) return this;
    this.isLoading = true;

    try {
      // Get the games
      this.pgns = await this._fetchGames();

      // Create and initialize the tree
      this.tree = new Tree(this.pgns);
      await this.tree.initialize();

      // Evaluate the tree for the starting position
      // await this._evalTree();

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
        this.days
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

  // Get moves for the current position
  getMovesForPosition(fen = null) {
    if (!this.isInitialized || !this.tree) {
      return [];
    }

    const position = fen || this.currentPosition;
    return this.tree.getMovesForPosition(position);
  }

  // Update position and get moves
  updatePosition(fen) {
    this.currentPosition = fen;
    return this.getMovesForPosition();
  }

  // Refresh explorer data (for example after changing filters)
  async refresh(username, platform, color, days) {
    if (username) this.username = username;
    if (platform) this.platform = platform;
    if (color) this.color = color;
    if (days) this.days = days;

    this.isInitialized = false;
    return await this.initialize();
  }

  // Render explorer data to the container element
  render() {
    if (!this.container) return;

    // Clear the container
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

    const moves = this.getMovesForPosition();

    if (moves.length === 0) {
      this.container.innerHTML =
        '<div class="no-moves">No games found for this position</div>';
      return;
    }

    moves.forEach((move, idx) => {
      const moveElement = document.createElement("li");
      moveElement.className = `explorer-move-${idx % 2}`;
      moveElement.innerHTML = `
        <div style="width: 50px;">${move.san}</div>
        <div style="width: 50px;">${move.count}</div>
        <div style="width: 50px;">${Math.round(move.winPercentage)}%</div>
        <div style="width: 50px;">${move.evaluation.toFixed(2)}</div>
      `;
      moveElement.addEventListener("click", () => {
        const event = new CustomEvent("explorer-move-selected", {
          detail: { san: move.san, fen: move.fen },
        });
        document.dispatchEvent(event);
      });

      this.container.appendChild(moveElement);
    });
  }
}
