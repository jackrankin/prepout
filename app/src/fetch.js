const getChesscomGames = async (username, color, months) => {
  const currentDate = new Date();

  const urls = [];
  for (let i = 0; i < months; i++) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");

    urls.push(
      `https://api.chess.com/pub/player/${username}/games/${year}/${month}`
    );

    currentDate.setMonth(currentDate.getMonth() - 1);
  }

  try {
    const games = [];

    for (const url of urls) {
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      games.push(
        ...data.games.filter(
          (game) =>
            (game.white.username.toLowerCase() === username.toLowerCase() &&
              color === "white") ||
            (game.black.username.toLowerCase() === username.toLowerCase() &&
              color === "black")
        )
      );
    }

    return games.map((game) => game.pgn);
  } catch (error) {
    console.error("Error fetching Chess.com games:", error);
    throw error;
  }
};

const getLichessGames = async (username, color, months) => {
  const dateRange = new Date();
  dateRange.setMonth(dateRange.getMonth() - months);

  const url = `https://lichess.org/api/games/user/${username}?max=500&pgnInJson=true`;

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

    return colorFilteredGames.map((game) => game.pgn);
  } catch (error) {
    console.error("Error fetching Lichess games:", error);
    throw error;
  }
};

export const getUserGames = (website, username, color, months) => {
  if (website === "chesscom") {
    return getChesscomGames(username, color, months);
  } else {
    return getLichessGames(username, color, months);
  }
};
