// this engine is used by the search method in the explorer

export default class Engine {
  constructor(stockfishPath = "/sf/stockfish-17-lite-02843c1.js") {
    this.engine = new Worker(stockfishPath, { type: "module" });
    this.isReady = false;
    this.pendingResolve = null;
    this.currentAnalysis = null;
    this._setupEngine();
    this._setupListeners();
  }

  _setupEngine() {
    this._sendCommand("uci");
    this._sendCommand("setoption name MultiPV value 1");
    this._sendCommand("isready");
  }

  _setupListeners() {
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
          line.includes("score cp")
        ) {
          const scoreMatch = /score cp ([-\d]+)/.exec(line);
          const depthMatch = /depth (\d+)/.exec(line);
          const pvMatch = / pv (.+)$/.exec(line);

          if (scoreMatch && depthMatch && pvMatch) {
            let score = parseInt(scoreMatch[1]);
            const depth = parseInt(depthMatch[1]);
            const moves = pvMatch[1].split(" ");

            if (this.currentAnalysis.sideToMove === "b") {
              score = -score;
            }

            this.currentAnalysis.bestMove = { score, depth, moves };
          }
        }

        if (this.currentAnalysis && line.includes("bestmove")) {
          const bestMoveData = this.currentAnalysis.bestMove || null;

          if (this.pendingResolve) {
            this.pendingResolve(bestMoveData);
            this.pendingResolve = null;
          }

          this.currentAnalysis = null;
        }
      }
    };
  }

  _sendCommand(command) {
    this.engine.postMessage(command);
  }

  async waitForReady() {
    if (this.isReady) return;
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

    this.currentAnalysis = { fen, depth, sideToMove: fen.split(" ")[1] };

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this._sendCommand(`position fen ${fen}`);
      this._sendCommand(`go depth ${depth}`);
    });
  }

  dispose() {
    this._sendCommand("quit");
    this.engine.terminate();
  }
}

export async function analyzeFen(fen, depth = 18) {
  const engine = new Engine();
  try {
    return await engine.analyzePosition(fen, depth);
  } finally {
    engine.dispose();
  }
}
