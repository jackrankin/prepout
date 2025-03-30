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
    this.move = null;
    this.san = null;
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
    this.pgns = await Promise.resolve(this.pgns);

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
      if (typeof pgn === "string") {
        this.putPGN(pgn);
      } else if (pgn && typeof pgn === "object") {
        if (pgn.pgn) {
          this.putPGN(pgn.pgn, pgn.result);
        }
      }
    }
  }

  getMovesForPosition(fen) {
    if (!this.initialized) {
      return [];
    }

    const normalizedFen = this._normalizeFen(fen);
    console.log("Looking for moves for FEN:", normalizedFen);

    if (!this.fenNode.has(normalizedFen)) {
      console.log("FEN not found in position database!");
      return [];
    }

    const node = this.fenNode.get(normalizedFen);
    console.log("Found node with", node.children.length, "children");

    // Create a new Chess instance for validation
    const tempChess = new Chess(normalizedFen);
    const legalMoves = new Set(
      tempChess.moves({ verbose: true }).map((m) => m.san)
    );

    const moves = node.children
      .map((child) => {
        const isLegal = legalMoves.has(child.san);

        console.log(`Move ${child.san} is ${isLegal ? "LEGAL" : "ILLEGAL"}`);

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
          isLegal: isLegal, // Include this for debugging
        };
      })
      .filter((m) => m.isLegal) // Remove illegal moves
      .sort((a, b) => b.count - a.count);

    return moves;
  }

  async evalTree(
    startingPosition = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  ) {
    if (!this.initialized) {
      await this.initialize();
    }

    const normalizedFen = this._normalizeFen(startingPosition);

    if (!this.fenNode.has(normalizedFen)) {
      return [];
    }

    this.chess = new Chess(normalizedFen);
    const root = this.fenNode.get(normalizedFen);

    const dfs = async (node, turn, depth) => {
      try {
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

  _extractResultFromPgn(pgn) {
    if (pgn.includes("1-0")) {
      return "1-0";
    } else if (pgn.includes("0-1")) {
      return "0-1";
    } else if (pgn.includes("1/2-1/2")) {
      return "1/2-1/2";
    }
    return null;
  }

  _updateResultCounts(node, result) {
    if (result === "1-0") {
      node.whiteWins++;
    } else if (result === "0-1") {
      node.blackWins++;
    } else if (result === "1/2-1/2") {
      node.draws++;
    }
  }

  _calculateWinPercentage(node) {
    const totalGames = node.count;
    if (totalGames === 0) return 0;

    const chess = new Chess(node.fen);
    const sideToMove = chess.turn() === "w" ? "white" : "black";

    if (sideToMove === "white") {
      return ((node.whiteWins + node.draws / 2) / totalGames) * 100;
    } else {
      return ((node.blackWins + node.draws / 2) / totalGames) * 100;
    }
  }

  _normalizeFen(fen) {
    return fen.trim();
  }
}
