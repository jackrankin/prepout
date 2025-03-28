export default class Explorer {
  constructor(username, platform, fen) {
    this.username = username;
    this.platform = platform;
    this.startingPosition = fen;
    this.currentPosition = fen;
    this.container = document.getElementById("explorer-move-list");
  }

  getMoves() {}
}
