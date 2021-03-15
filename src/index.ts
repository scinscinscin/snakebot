import Discord, { ClientUser, Message, MessageReaction } from "discord.js";

const client = new Discord.Client();
const { token } = require("../token.json");
let games: Game[] = [];

type Tile = "head" | "body" | "food" | "empty";
type Direction = "⬇️" | "⬆️" | "⬅️" | "➡️";
const emojis = {
    body: ":green_square:",
    head: ":flushed:",
    food: ":red_square:",
    empty: ":white_large_square:",
};

const directions: Direction[] = ["⬇️", "⬆️", "⬅️", "➡️"];
const size = 7;
function blankBoard(): Tile[][] {
    let board: Tile[][] = [];
    //populate board
    for (let i = 0; i < size; i++) {
        let row: Tile[] = [];
        for (let k = 0; k < size; k++) {
            row.push("empty");
        }
        board.push(row);
    }

    return board;
}

const gP: () => number[] = () => {
    const gC = () => Math.floor(Math.random() * size);
    return [gC(), gC()];
};

class Game {
    constructor(public owner: string, public channel: string) {}
    public path: number[][] = [gP()];
    public food: number[] = gP();
    public gameMessage: Message;
    public ongoing: Boolean = true;
    snakeLength: () => Number = () => {
        return this.path.length;
    };

    move(direction: Direction): void {
        let [oldX, oldY] = this.path[0];
        let newPos: number[] = [];
        switch (direction) {
            case "⬇️":
                newPos = [oldX + 1, oldY];
                break;

            case "⬆️":
                newPos = [oldX - 1, oldY];
                break;

            case "➡️":
                newPos = [oldX, oldY + 1];
                break;

            case "⬅️":
                newPos = [oldX, oldY - 1];
                break;
            default:
                throw "stuff broke";
        }
        if (JSON.stringify(newPos) === JSON.stringify(this.food)) {
            //reached food
            this.path.unshift(newPos);
            let gotFood: boolean = false;
            while (gotFood === false) {
                let newFood = gP();
                let isInTheWay: Boolean = false;
                this.path.forEach((tile) => {
                    let [x, y] = tile;
                    let [foodX, foodY] = newFood;
                    if (x === foodX && y === foodY) {
                        isInTheWay = true;
                    }
                });

                if (!isInTheWay) {
                    this.food = newFood;
                    gotFood = true;
                }
            }
        } else if (JSON.stringify(newPos) === JSON.stringify(this.path[1])) {
            return; // you cannot turn back
        } else {
            // did not reach food
            // need to find out what that tile is
            let [x, y] = newPos;

            if (
                this.path
                    .map((coords) => coords.toString())
                    .includes(newPos.toString())
            ) {
                //this guy just bumped to himself lmao game over boiii
                this.ongoing = false;
                return;
            } else if (x < 0 || x > size - 1 || y < 0 || y > size - 1) {
                // this guy bumped into the wall
                this.ongoing = false;
                return;
            } else {
                // this guy moved forward
                this.path.unshift(newPos); // add the newposition to the front
                this.path.pop(); // remove the old pos
            }
        }
    }

    render(): Tile[][] {
        let board = blankBoard();
        this.path.forEach((coords, index) => {
            let [x, y] = coords;
            board[x][y] = index === 0 ? "head" : "body";
        });
        let [x, y] = this.food;
        board[x][y] = "food";
        return board;
    }

    reRender(): void {
        if (this.ongoing === false) {
            this.gameMessage.edit(
                new Discord.MessageEmbed()
                    .setColor("#f48f97")
                    .addField(
                        `You died! Final score: ${this.snakeLength()}`,
                        this.convertToEmoji()
                    )
            );
        } else {
            this.gameMessage.edit(
                new Discord.MessageEmbed()
                    .setColor("#a4d05f")
                    .addField(
                        `Score: ${this.snakeLength()}`,
                        this.convertToEmoji()
                    )
            );
        }
    }
    convertToEmoji(): string {
        let message: string = "";
        this.render().forEach((row) => {
            row.forEach((tile) => {
                message += `${emojis[tile]}`;
            });
            message += "\n";
        });
        return message;
    }
}

let bot: ClientUser;
client.on(
    "ready",
    async (): Promise<void> => {
        console.log("logged in");
        bot = await client.user!;
    }
);

client.on(
    "message",
    async (msg): Promise<void> => {
        if (msg.content === "snake!start") {
            let channel: string = msg.channel.id;
            let author: string = msg.author.id;

            //check if a game exists in this channel
            if (games.filter((game) => game.channel === channel).length > 0) {
                msg.channel.send("a game already exists in the channel");
                return;
            }
            msg.channel.send("starting game");

            // create game
            let game = new Game(author, channel);
            let gameMessage = await msg.channel.send(
                new Discord.MessageEmbed()
                    .setColor("#a4d05f")
                    .addField(
                        `Score: ${game.snakeLength()}`,
                        game.convertToEmoji()
                    )
            );

            //add reactions to message
            directions.forEach((emoji) => {
                gameMessage.react(emoji);
            });

            //set the gameID property to the id of the message then add to list of games
            game.gameMessage = gameMessage;

            games.push(game);
        } else if (msg.content === "snake!stop") {
            msg.channel.send("stopping game");
        }
    }
);

client.on("messageReactionAdd", async (reaction: MessageReaction) => {
    // When we receive a reaction we check if the reaction is partial or not
    if (reaction.partial) {
        // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
        try {
            await reaction.fetch();
        } catch (error) {
            console.error(
                "Something went wrong when fetching the message: ",
                error
            );
            // Return as `reaction.message.author` may be undefined/null
            return;
        }
    }

    // Now the message has been cached and is fully available
    if (reaction.me || reaction.message.author.id !== bot.id) {
        return;
    }

    // user is reacting to a message that the bot created
    let game = games.filter(({ gameMessage: { id }, ongoing }) => {
        return id === reaction.message.id && ongoing;
    })[0];
    let emoji: Direction = reaction.emoji.name as Direction;

    if (game !== undefined && directions.includes(emoji)) {
        let reactor = Object.values(reaction.users.cache.toJSON()).filter(
            (obj) => obj.bot === false
        )[0].id;
        let userReactions = reaction.message.reactions.cache.filter(
            (reaction) => reaction.users.cache.has(reactor)
        );

        game.move(emoji);
        game.reRender();
        try {
            for (const reaction of userReactions.values()) {
                await reaction.users.remove(reactor);
            }
        } catch (error) {
            if (error.code === 50013) {
                console.error("Give manage messages perms");
                throw "Give manage message perms";
            } else {
                console.error("Failed to remove reactions.");
            }
        }
    }
});

client.login(token);
