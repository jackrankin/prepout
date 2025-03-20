// THIS FILE IS GOING TO PARSE THE PGN' AND MAKE TREES OUT OF THEM
import { Chess } from "chess.js";
import { getEval } from "./fetch";

function getMoveFromFens(fenA, fenB) {
  if (!fenA || !fenB || typeof fenA !== "string" || typeof fenB !== "string") {
    console.error("Invalid FEN strings provided");
    return null;
  }

  try {
    const chess = new Chess(fenA);

    const legalMoves = chess.moves({ verbose: true });

    for (const move of legalMoves) {
      const testChess = new Chess(fenA);

      testChess.move(move);

      const resultFen = testChess.fen();

      const fenBParts = fenB.split(" ");
      const resultFenParts = resultFen.split(" ");

      const fenBCore = fenBParts.slice(0, 4).join(" ");
      const resultFenCore = resultFenParts.slice(0, 4).join(" ");

      if (fenBCore === resultFenCore) {
        return move.san;
      }
    }

    console.error("No legal move found between the provided positions");
    return null;
  } catch (error) {
    console.error("Error analyzing chess positions:", error);
    return null;
  }
}

export class Node {
  constructor(fen, count, parent) {
    this.fen = fen;
    this.count = count;
    this.parent = parent;
    this.children = [];
    this.eval = 0;
  }
}

export class Weakness {
  constructor(positionNode, resultingNode, move, occurences, evalChange) {
    this.positionNode = positionNode;
    this.resultingNode = resultingNode;
    this.move = move;
    this.occurences = occurences;
    this.evalChange = evalChange;
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

  async evalTree(startingPosition) {
    if (startingPosition === "") {
      startingPosition =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    if (!this.fenNode.has(startingPosition)) {
      return null;
    }
    const root = this.fenNode.get(startingPosition);

    console.log("POSITION APPEARED", root.fen, root.count);

    const dfs = async (node) => {
      node.eval = await getEval(node.fen);

      for (let child of node.children) {
        await dfs(child);
      }
    };

    return dfs(root);
  }

  // MUAHAHAHA
  async findWeaknesses(startingPosition, color) {
    await this.evalTree(startingPosition);
    this.chess = new Chess(startingPosition);

    const weaknesses = [];

    const dfs = async (node, parent, turn) => {
      // check for jumps of 1.1
      // check if the previous position was the bad guy's position
      if (!parent) {
        for (let child of node.children) {
          dfs(child, node, turn === "white" ? "black" : "white");
        }

        return;
      }

      if (
        node.eval - parent.eval >= 1.1 &&
        turn === "white" &&
        color === "black" &&
        node.eval > 1
      ) {
        const w = new Weakness(
          parent,
          node,
          getMoveFromFens(parent.fen, node.fen),
          node.count,
          node.eval - parent.eval
        );
        weaknesses.push(w);
      } else if (
        node.eval - parent.eval <= -1.1 &&
        turn === "black" &&
        color === "white" &&
        node.eval <= -1.1
      ) {
        const w = new Weakness(
          parent,
          node,
          getMoveFromFens(parent.fen, node.fen),
          node.count,
          node.eval - parent.eval
        );
        weaknesses.push(w);
      }

      for (let child of node.children) {
        dfs(child, node, turn === "white" ? "black" : "white");
      }
    };

    dfs(startingPosition, null, this.chess.turn() === "w" ? "white" : "black");

    return weaknesses;
  }
}
