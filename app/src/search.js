// THIS FILE IS GOING TO PARSE THE PGN' AND MAKE TREES OUT OF THEM
import { Chess } from "chess.js";
import { getEval } from "./fetch";

export class Node {
  constructor(fen, count) {
    this.fen = fen;
    this.count = count;
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

  async evalTree(startingPosition) {
    if (startingPosition === "") {
      startingPosition =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    if (!this.fenNode.has(startingPosition)) {
      return null;
    }
    const root = this.fenNode.get(startingPosition);

    const dfs = async (node) => {
      node.eval = await getEval(node.fen);

      for (let child of node) {
        await dfs(child);
      }
    };

    return dfs(root);
  }

  // MUAHAHAHA
  async findWeaknesses(startingPosition, color) {
    await this.evalTree(startingPosition);
    this.chess = new chess();

    // we will have it be something like (beginning move, )
    const weaknesses = [];

    const dfs = async (node, parent) => {};
  }
}
