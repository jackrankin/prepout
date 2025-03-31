export default class RealTimeEngine {
  constructor(stockfishPath = "/sf/stockfish-nnue-16.js") {
    this.engine = new Worker(stockfishPath);
    this.isReady = false;
    this.currentAnalysis = null;
    this.pendingResolve = null;
    this.lastEvaluations = {};
    this.onEvaluationUpdate = null;
    this.analysisId = 0;
    this._setupEngine();
    this._setupListeners();
  }

  _setupEngine() {
    this._sendCommand("uci");
    this._sendCommand("setoption name MultiPV value 3");
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
          line.includes("multipv")
        ) {
          const multipvMatch = /multipv (\d+)/.exec(line);
          const depthMatch = /depth (\d+)/.exec(line);
          const pvMatch = / pv (.+)$/.exec(line);

          // Check for either centipawn score or mate score
          const cpScoreMatch = /score cp ([-\d]+)/.exec(line);
          const mateScoreMatch = /score mate ([-\d]+)/.exec(line);

          if (
            multipvMatch &&
            depthMatch &&
            pvMatch &&
            (cpScoreMatch || mateScoreMatch)
          ) {
            const lineNumber = parseInt(multipvMatch[1]);
            const depth = parseInt(depthMatch[1]);
            const moves = pvMatch[1].split(" ");

            let score;
            let isMate = false;

            if (cpScoreMatch) {
              // Regular centipawn evaluation
              score = parseInt(cpScoreMatch[1]);
              if (this.currentAnalysis.sideToMove === "b") {
                score = -score;
              }
            } else if (mateScoreMatch) {
              // Mate evaluation
              isMate = true;
              const mateIn = parseInt(mateScoreMatch[1]);

              // Convert mate score to a large centipawn value
              // Positive means the side to move can force mate
              // Negative means the side to move will be mated

              // Conventional conversion: mate in N moves is ±(10000 - N * 10)
              // This keeps mates sorted by distance (closer mates are higher valued)
              score = mateIn > 0 ? 10000 - mateIn * 10 : -10000 - mateIn * 10;

              if (this.currentAnalysis.sideToMove === "b") {
                score = -score;
              }
            }

            this.lastEvaluations[lineNumber] = {
              line: lineNumber,
              score,
              depth,
              moves,
              isMate,
              mateIn: isMate ? mateScoreMatch[1] : null,
              centipawnLoss:
                lineNumber === 1
                  ? 0
                  : this.lastEvaluations[1]
                  ? Math.abs(this.lastEvaluations[1].score - score)
                  : 0,
            };

            if (this.onEvaluationUpdate) {
              const evaluationsArray = Object.values(this.lastEvaluations);
              this.onEvaluationUpdate(
                evaluationsArray,
                this.currentAnalysis.id
              );
            }
          }
        }

        if (this.currentAnalysis && line.includes("bestmove")) {
          const results = Object.values(this.lastEvaluations);
          const currentId = this.currentAnalysis.id;

          if (this.pendingResolve && this.currentAnalysis) {
            this.pendingResolve(results);
            this.pendingResolve = null;
          }

          this.lastEvaluations = {};
          this.currentAnalysis = null;
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

  async analyzePosition(fen, depth = 25) {
    await this.waitForReady();
    await this._stopAnalysis();

    this.lastEvaluations = {};
    const analysisId = ++this.analysisId;
    const sideToMove = fen.split(" ")[1];

    this.currentAnalysis = { fen, depth, sideToMove, id: analysisId };

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this._sendCommand("position fen " + fen);
      this._sendCommand("go depth " + depth);
    });
  }

  async _stopAnalysis() {
    if (this.currentAnalysis) {
      return new Promise((resolve) => {
        this._sendCommand("stop");

        const checkStopped = setInterval(() => {
          if (!this.currentAnalysis) {
            clearInterval(checkStopped);
            resolve();
          }
        }, 50);

        if (this.pendingResolve) {
          const results = Object.values(this.lastEvaluations);
          this.pendingResolve(results);
          this.pendingResolve = null;
        }

        this.currentAnalysis = null;
      });
    }
  }

  dispose() {
    this._stopAnalysis();
    this._sendCommand("quit");
    this.engine.terminate();
  }
}
