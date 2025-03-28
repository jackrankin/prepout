// parse pgns into a tree

import { Chess } from "chess.js";
import { analyzeFen } from "./search_engine";

export class Node {
  constructor(fen, count, parent) {
    this.fen = fen;
    this.count = count;
    this.parent = parent;
    this.children = [];
    this.eval = 0;
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
  }

  putPGN(pgn) {
    this.chess.loadPgn(pgn);
    const history = this.chess.history({ verbose: true });
    this.chess.reset();
    let currentFen = this.chess.fen();

    if (!this.fenNode.has(currentFen)) {
      this.fenNode.set(currentFen, this.root);
    }

    this.fenNode.get(currentFen).count++;
    let currentNode = this.root;

    for (const move of history) {
      this.chess.move(move);

      currentFen = this.chess.fen();

      let nextNode;
      if (this.fenNode.has(currentFen)) {
        nextNode = this.fenNode.get(currentFen);
        nextNode.count++;
      } else {
        nextNode = new Node(currentFen, 1);
        this.fenNode.set(currentFen, nextNode);
      }
      nextNode.parent = currentNode;

      if (!currentNode.children.some((child) => child.fen === currentFen)) {
        currentNode.children.push(nextNode);
      }

      currentNode = nextNode;
    }

    this.chess.reset();
  }

  parsePGNs() {
    for (let pgn of this.pgns) {
      this.putPGN(pgn);
    }
  }

  // playerColor = 'black' means we are finding moves to paly AGAINST black
  async evalTree(
    startingPosition = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  ) {
    if (!this.fenNode.has(startingPosition)) {
      return [];
    }

    this.chess = new Chess(startingPosition);
    const root = this.fenNode.get(startingPosition);

    const dfs = async (node, turn, depth) => {
      const result = await analyzeFen(node.fen);
      node.eval = result.score / 100;

      for (let child of node.children) {
        await dfs(child, turn === "white" ? "black" : "white", depth + 1);
      }
    };

    await dfs(root, this.chess.turn() === "w" ? "white" : "black", 0);
  }
}
