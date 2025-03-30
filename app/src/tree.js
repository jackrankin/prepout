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
    this.move = null; // Store UCI move { from, to, promotion }
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

  async _parsePGNs() {
    const pgnsArray = Array.isArray(this.pgns) ? this.pgns : [];

    for (let i = 0; i < pgnsArray.length; i++) {
      this._putPGN(pgnsArray[i]);
    }
  }

  _putPGN(pgn, result) {
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
          nextNode.move = {
            from: move.from,
            to: move.to,
            promotion: move.promotion || null,
          };
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

  _getUciMoveFromFens(startFen, endFen) {
    const chess = new Chess(startFen);
    const possibleMoves = chess.moves({ verbose: true });

    for (const move of possibleMoves) {
      chess.move(move);
      if (chess.fen() === endFen) {
        return move;
      }
      chess.undo();
    }

    return null;
  }

  getMovesForPosition(fen) {
    if (!this.initialized) return [];

    const normalizedFen = this._normalizeFen(fen);
    if (!this.fenNode.has(normalizedFen)) return [];

    const node = this.fenNode.get(normalizedFen);

    return node.children
      .map((child) => {
        const move = this._getUciMoveFromFens(fen, child.fen);
        const tempChess = new Chess(normalizedFen);
        const isLegal = tempChess.move(move);

        return {
          uci: `${move.from}${move.to}${move.promotion || ""}`,
          count: child.count,
          fen: child.fen,
          evaluation: child.eval,
          winPercentage: this._calculateWinPercentage(child),
          whiteWins: child.whiteWins,
          blackWins: child.blackWins,
          draws: child.draws,
          isLegal: !!isLegal,
        };
      })
      .filter((move) => move.isLegal)
      .sort((a, b) => b.count - a.count);
  }

  async evalTree(startingPosition = this.root.fen) {
    if (!this.initialized) await this.initialize();

    const normalizedFen = this._normalizeFen(startingPosition);
    if (!this.fenNode.has(normalizedFen)) return [];

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
    if (pgn.includes("1-0")) return "1-0";
    if (pgn.includes("0-1")) return "0-1";
    if (pgn.includes("1/2-1/2")) return "1/2-1/2";
    return null;
  }

  _updateResultCounts(node, result) {
    if (result === "1-0") node.whiteWins++;
    else if (result === "0-1") node.blackWins++;
    else if (result === "1/2-1/2") node.draws++;
  }

  _calculateWinPercentage(node) {
    const totalGames = node.count;
    if (totalGames === 0) return 0;

    const sideToMove = new Chess(node.fen).turn() === "w" ? "white" : "black";
    return sideToMove === "white"
      ? ((node.whiteWins + node.draws / 2) / totalGames) * 100
      : ((node.blackWins + node.draws / 2) / totalGames) * 100;
  }

  _normalizeFen(fen) {
    return fen.trim();
  }
}
