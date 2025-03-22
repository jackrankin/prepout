export default class Engine {
  constructor(stockfishPath = "/sf/stockfish-nnue-16.js") {
    this.engine = new Worker(stockfishPath);
    this.isReady = false;
    this.currentAnalysis = null;
    this.pendingResolve = null;
    this._setupEngine();
    this._setupListeners();
  }

  _setupEngine() {
    this._sendCommand("uci");
    this._sendCommand("setoption name MultiPV value 3");
    this._sendCommand("isready");
  }

  _setupListeners() {
    const evaluations = {};
    let bestMoveFound = false;
    this.engine.onmessage = (event) => {
      const output = event.data;
      const lines = output.split("\n");
      for (const line of lines) {
        if (line.includes("readyok")) {
          this.isReady = true;
        }
        if (
          this.currentAnalysis &&
          line.includes("info depth") &&
          line.includes("multipv") &&
          line.includes("score cp")
        ) {
          const multipvMatch = /multipv (\d+)/.exec(line);
          const scoreMatch = /score cp ([-\d]+)/.exec(line);
          const depthMatch = /depth (\d+)/.exec(line);
          const pvMatch = / pv (.+)$/.exec(line);
          if (multipvMatch && scoreMatch && depthMatch && pvMatch) {
            const lineNumber = parseInt(multipvMatch[1]);
            let score = parseInt(scoreMatch[1]);

            if (this.currentAnalysis.sideToMove === "b") {
              score = -score;
            }

            const depth = parseInt(depthMatch[1]);
            const moves = pvMatch[1];
            if (
              depth === this.currentAnalysis.depth ||
              (evaluations[lineNumber] && depth > evaluations[lineNumber].depth)
            ) {
              evaluations[lineNumber] = { score, depth, moves };
            }
          }
        }
        if (
          this.currentAnalysis &&
          line.includes("bestmove") &&
          !bestMoveFound
        ) {
          bestMoveFound = true;
          const results = [];
          for (let i = 1; i <= 3; i++) {
            if (evaluations[i]) {
              results.push({
                line: i,
                score: evaluations[i].score,
                depth: evaluations[i].depth,
                moves: evaluations[i].moves.split(" "),
                centipawnLoss:
                  i === 1
                    ? 0
                    : Math.abs(evaluations[1].score - evaluations[i].score),
              });
            }
          }
          if (this.pendingResolve) {
            this.pendingResolve(results);
            this.pendingResolve = null;
            this.currentAnalysis = null;
          }
          Object.keys(evaluations).forEach((key) => delete evaluations[key]);
          bestMoveFound = false;
        }
      }
    };
  }

  _sendCommand(command) {
    this.engine.postMessage(command);
  }

  async waitForReady() {
    if (this.isReady) return Promise.resolve();
    return new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (this.isReady) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);
    });
  }

  async analyzePosition(fen, depth = 20) {
    await this.waitForReady();

    const sideToMove = fen.split(" ")[1];

    this.currentAnalysis = { fen, depth, sideToMove };
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this._sendCommand("position fen " + fen);
      this._sendCommand("go depth " + depth);
    });
  }

  dispose() {
    this._sendCommand("quit");
    this.engine.terminate();
  }
}

export async function analyzePosition(fen, depth = 15) {
  const engine = new Engine();

  try {
    const analysis = await engine.analyzePosition(fen, depth);

    // console.log("Analysis Results:");
    // analysis.forEach((line) => {
    // console.log(
    //   `Line ${line.line}: Score ${line.score / 100}, Centipawn Loss: ${
    //     line.centipawnLoss / 100
    //   }`
    // );
    // console.log(`   Moves: ${line.moves.slice(0, 5).join(" ")}...`);
    // });
    return analysis;
  } finally {
    engine.dispose();
  }
}
