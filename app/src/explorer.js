// explorer.js
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
      await this._evalTree();

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

  // Get the path from root to current position
  getPathToCurrentPosition() {
    if (!this.isInitialized || !this.tree) {
      return [];
    }

    return this.tree.getPathToPosition(this.currentPosition);
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

    // Create the move list
    const moveList = document.createElement("div");
    moveList.className = "explorer-move-list";

    // Add header
    const header = document.createElement("div");
    header.className = "explorer-header";
    header.innerHTML = `
      <div class="header-move">Move</div>
      <div class="header-games">Games</div>
      <div class="header-score">Score</div>
      <div class="header-eval">Eval</div>
    `;
    moveList.appendChild(header);

    // Add moves
    moves.forEach((move) => {
      const moveElement = document.createElement("div");
      moveElement.className = "explorer-move";
      moveElement.innerHTML = `
        <div class="move-san">${move.san}</div>
        <div class="move-games">${move.count}</div>
        <div class="move-score">${Math.round(move.winPercentage)}%</div>
        <div class="move-eval">${move.evaluation.toFixed(2)}</div>
      `;

      // Add click event to make the move
      moveElement.addEventListener("click", () => {
        // Dispatch a custom event that the main app can listen for
        const event = new CustomEvent("explorer-move-selected", {
          detail: { san: move.san, fen: move.fen },
        });
        document.dispatchEvent(event);
      });

      moveList.appendChild(moveElement);
    });

    this.container.appendChild(moveList);
  }
}
