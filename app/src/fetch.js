const getChesscomGames = async (username, color, lastXdays) => {
  const url = `https://api.chess.com/pub/player/${username}/games/2025/03`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Failed to fetch data");
    }

    const data = await response.json();
    console.log(data, username, color);

    const games = data.games.filter(
      (game) =>
        (game.white.username.toLowerCase() === username.toLowerCase() &&
          color === "white") ||
        (game.black.username.toLowerCase() === username.toLowerCase() &&
          color === "black")
    );

    const pgns = games.map((game) => game.pgn);

    return { pgns };
  } catch (error) {
    console.error("Error fetching games:", error);
    throw error;
  }
};

const getLichessGames = async (username, color, lastXdays) => {
  const url = `https://lichess.org/api/games/user/${username}?max=500&pgnInJson=true`;

  const dateRange = new Date();
  dateRange.setDate(dateRange.getDate() - lastXdays);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/x-ndjson",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch data");
    }

    const data = await response.text();

    const games = data
      .split("\n")
      .filter((game) => game)
      .map((game) => JSON.parse(game));

    const filteredGames = games.filter((game) => {
      const gameDate = new Date(game.createdAt);
      return gameDate >= dateRange;
    });

    const colorFilteredGames = filteredGames.filter((game) => {
      if (color === "white") {
        return game.players.white.user.id === username;
      } else if (color === "black") {
        return game.players.black.user.id === username;
      }
      return false;
    });

    const pgns = colorFilteredGames.map((game) => game.pgn);

    return { pgns };
  } catch (error) {
    console.error("Error fetching games:", error);
    throw error;
  }
};

export const getUserGames = (website, username, color, days) => {
  if (website === "chesscom") {
    return getChesscomGames(username, color, days);
  } else {
    return getLichessGames(username, color, days);
  }
};
