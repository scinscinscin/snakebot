"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Discord = require("discord.js");
const client = new Discord.Client();
const { token } = require("../token.json");
let games = [];
const emojis = {
    body: ":green_square:",
    head: ":flushed:",
    food: ":red_square:",
    empty: ":white_large_square:",
};
const directions = ["⬇️", "⬆️", "⬅️", "➡️"];
const size = 7;
function blankBoard() {
    let board = [];
    for (let i = 0; i < size; i++) {
        let row = [];
        for (let k = 0; k < size; k++) {
            row.push("empty");
        }
        board.push(row);
    }
    return board;
}
const gP = () => {
    const gC = () => Math.floor(Math.random() * size);
    return [gC(), gC()];
};
class Game {
    constructor(owner, channel) {
        this.owner = owner;
        this.channel = channel;
        this.path = [gP()];
        this.food = gP();
        this.ongoing = true;
        this.snakeLength = () => {
            return this.path.length;
        };
    }
    move(direction) {
        let [oldX, oldY] = this.path[0];
        let newPos = [];
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
            this.path.unshift(newPos);
            let gotFood = false;
            while (gotFood === false) {
                let newFood = gP();
                let isInTheWay = false;
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
        }
        else if (JSON.stringify(newPos) === JSON.stringify(this.path[1])) {
            return;
        }
        else {
            let [x, y] = newPos;
            if (this.path
                .map((coords) => coords.toString())
                .includes(newPos.toString())) {
                this.ongoing = false;
                return;
            }
            else if (x < 0 || x > size - 1 || y < 0 || y > size - 1) {
                this.ongoing = false;
                return;
            }
            else {
                this.path.unshift(newPos);
                this.path.pop();
            }
        }
    }
    render() {
        let board = blankBoard();
        this.path.forEach((coords, index) => {
            let [x, y] = coords;
            board[x][y] = index === 0 ? "head" : "body";
        });
        let [x, y] = this.food;
        board[x][y] = "food";
        return board;
    }
    reRender() {
        if (this.ongoing === false) {
            this.gameMessage.edit(new Discord.MessageEmbed()
                .setColor("#f48f97")
                .addField(`You died! Final score: ${this.snakeLength()}`, this.convertToEmoji()));
        }
        else {
            this.gameMessage.edit(new Discord.MessageEmbed()
                .setColor("#a4d05f")
                .addField(`Score: ${this.snakeLength()}`, this.convertToEmoji()));
        }
    }
    convertToEmoji() {
        let message = "";
        this.render().forEach((row) => {
            row.forEach((tile) => {
                message += `${emojis[tile]}`;
            });
            message += "\n";
        });
        return message;
    }
}
let bot;
client.on("ready", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("logged in");
    bot = yield client.user;
}));
client.on("message", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.content === "snake!start") {
        let channel = msg.channel.id;
        let author = msg.author.id;
        if (games.filter((game) => game.channel === channel).length > 0) {
            msg.channel.send("a game already exists in the channel");
            return;
        }
        msg.channel.send("starting game");
        let game = new Game(author, channel);
        let gameMessage = yield msg.channel.send(new Discord.MessageEmbed()
            .setColor("#a4d05f")
            .addField(`Score: ${game.snakeLength()}`, game.convertToEmoji()));
        directions.forEach((emoji) => {
            gameMessage.react(emoji);
        });
        game.gameMessage = gameMessage;
        games.push(game);
    }
    else if (msg.content === "snake!stop") {
        msg.channel.send("stopping game");
    }
}));
client.on("messageReactionAdd", (reaction, user) => __awaiter(void 0, void 0, void 0, function* () {
    if (reaction.partial) {
        try {
            yield reaction.fetch();
        }
        catch (error) {
            console.error("Something went wrong when fetching the message: ", error);
            return;
        }
    }
    if (reaction.me || reaction.message.author.id !== bot.id) {
        return;
    }
    let game = games.filter(({ gameMessage: { id }, ongoing }) => {
        return id === reaction.message.id && ongoing;
    })[0];
    let emoji = reaction.emoji.name;
    if (game !== undefined && directions.includes(emoji)) {
        let reactor = Object.values(reaction.users.cache.toJSON()).filter((obj) => obj.bot === false)[0].id;
        let userReactions = reaction.message.reactions.cache.filter((reaction) => reaction.users.cache.has(reactor));
        game.move(emoji);
        game.reRender();
        try {
            for (const reaction of userReactions.values()) {
                yield reaction.users.remove(reactor);
            }
        }
        catch (error) {
            if (error.code === 50013) {
                console.error("Give manage messages perms");
            }
            else {
                console.error("Failed to remove reactions.");
            }
        }
    }
}));
client.login(token);
//# sourceMappingURL=index.js.map