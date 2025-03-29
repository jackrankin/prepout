// search.js
import { Chess } from "chess.js";
import { analyzeFen } from "./search_engine";

export class Node {
  constructor(fen, count, parent) {
    this.fen = fen;
    this.count = count || 0;
    this.parent = parent || null;
    this.children = [];
    this.eval = 0;
    this.move = null; // Store the move that led to this position
    this.san = null; // Store the SAN notation of the move
    this.whiteWins = 0;
    this.blackWins = 0;
    this.draws = 0;
  }
}

export class Tree {
  constructor(pgns) {
    this.pgns = pgns;
    this.fenNode = new Map();
    this.chess = new Chess();
    this.root = new Node(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      0
    );
    this.fenNode.set(this.root.fen, this.root);
    this.initialized = false;
  }

  async initialize() {
    // Wait for pgns to resolve if it's a promise
    this.pgns = await Promise.resolve(this.pgns);

    // Parse all PGNs
    if (Array.isArray(this.pgns)) {
      await this._parsePGNs();
      this.initialized = true;
      return this;
    } else {
      throw new Error("Expected pgns to be an array");
    }
  }

  putPGN(pgn, result) {
    try {
      this.chess.loadPgn(pgn);
      const history = this.chess.history({ verbose: true });
      const gameResult = result || this._extractResultFromPgn(pgn);

      this.chess.reset();
      let currentFen = this.chess.fen();

      if (!this.fenNode.has(currentFen)) {
        this.fenNode.set(currentFen, this.root);
      }

      this.fenNode.get(currentFen).count++;
      this._updateResultCounts(this.root, gameResult);

      let currentNode = this.root;

      for (const move of history) {
        this.chess.move(move);
        currentFen = this.chess.fen();

        let nextNode;
        if (this.fenNode.has(currentFen)) {
          nextNode = this.fenNode.get(currentFen);
          nextNode.count++;
        } else {
          nextNode = new Node(currentFen, 1, currentNode);
          nextNode.move = move;
          nextNode.san = move.san;
          this.fenNode.set(currentFen, nextNode);
        }

        this._updateResultCounts(nextNode, gameResult);

        if (!currentNode.children.some((child) => child.fen === currentFen)) {
          currentNode.children.push(nextNode);
        }

        currentNode = nextNode;
      }

      this.chess.reset();
      return true;
    } catch (error) {
      console.error("Error processing PGN:", error);
      return false;
    }
  }

  async _parsePGNs() {
    const pgnsArray = Array.isArray(this.pgns) ? this.pgns : [];

    for (let pgn of pgnsArray) {
      // Handle different possible PGN formats
      if (typeof pgn === "string") {
        this.putPGN(pgn);
      } else if (pgn && typeof pgn === "object") {
        // If pgn is an object with a pgn property and result property
        if (pgn.pgn) {
          this.putPGN(pgn.pgn, pgn.result);
        }
      }
    }
  }

  // Get moves for a specific position
  getMovesForPosition(fen) {
    if (!this.initialized) {
      return [];
    }

    // Make sure the FEN is normalized (sometimes there are trailing spaces)
    const normalizedFen = this._normalizeFen(fen);

    // Check if we have the position in our tree
    if (!this.fenNode.has(normalizedFen)) {
      return [];
    }

    const node = this.fenNode.get(normalizedFen);

    // Convert children to move list
    return node.children
      .map((child) => {
        const totalGames = child.count;
        const winPercentage = this._calculateWinPercentage(child);

        return {
          san: child.san,
          count: totalGames,
          fen: child.fen,
          evaluation: child.eval,
          winPercentage: winPercentage,
          whiteWins: child.whiteWins,
          blackWins: child.blackWins,
          draws: child.draws,
        };
      })
      .sort((a, b) => b.count - a.count); // Sort by popularity
  }

  // Evaluate the tree for a given starting position
  async evalTree(
    startingPosition = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  ) {
    // Make sure pgns are parsed first
    if (!this.initialized) {
      await this.initialize();
    }

    // Normalize the FEN
    const normalizedFen = this._normalizeFen(startingPosition);

    if (!this.fenNode.has(normalizedFen)) {
      return [];
    }

    this.chess = new Chess(normalizedFen);
    const root = this.fenNode.get(normalizedFen);

    // Evaluate positions in the tree
    const dfs = async (node, turn, depth) => {
      try {
        // Only analyze if not already evaluated
        if (node.eval === 0) {
          const result = await analyzeFen(node.fen);
          node.eval = result.score / 100;
        }

        for (let child of node.children) {
          await dfs(child, turn === "white" ? "black" : "white", depth + 1);
        }
      } catch (error) {
        console.error("Error during tree evaluation:", error);
      }
    };

    await dfs(root, this.chess.turn() === "w" ? "white" : "black", 0);
    return root;
  }

  // Get the path from root to a specific position
  getPathToPosition(fen) {
    const normalizedFen = this._normalizeFen(fen);

    if (!this.fenNode.has(normalizedFen)) {
      return [];
    }

    const path = [];
    let currentNode = this.fenNode.get(normalizedFen);

    while (currentNode && currentNode.parent) {
      path.unshift({
        fen: currentNode.fen,
        san: currentNode.san,
        evaluation: currentNode.eval,
        count: currentNode.count,
      });
      currentNode = currentNode.parent;
    }

    return path;
  }

  // Helper method to extract result from PGN
  _extractResultFromPgn(pgn) {
    // Common PGN result patterns
    if (pgn.includes("1-0")) {
      return "1-0";
    } else if (pgn.includes("0-1")) {
      return "0-1";
    } else if (pgn.includes("1/2-1/2")) {
      return "1/2-1/2";
    }
    return null;
  }

  // Helper method to update result counts
  _updateResultCounts(node, result) {
    if (result === "1-0") {
      node.whiteWins++;
    } else if (result === "0-1") {
      node.blackWins++;
    } else if (result === "1/2-1/2") {
      node.draws++;
    }
  }

  // Helper method to calculate win percentage for the side to move
  _calculateWinPercentage(node) {
    const totalGames = node.count;
    if (totalGames === 0) return 0;

    // Determine side to move from FEN
    const chess = new Chess(node.fen);
    const sideToMove = chess.turn() === "w" ? "white" : "black";

    if (sideToMove === "white") {
      // White to move, calculate white's winning percentage
      return ((node.whiteWins + node.draws / 2) / totalGames) * 100;
    } else {
      // Black to move, calculate black's winning percentage
      return ((node.blackWins + node.draws / 2) / totalGames) * 100;
    }
  }

  // Helper method to normalize FEN strings
  _normalizeFen(fen) {
    // Some FENs might have extra spaces at the end
    return fen.trim();
  }
}
