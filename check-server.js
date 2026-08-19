const {
    Client,
    GatewayIntentBits,
    Events
} = require("discord.js");

require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

const SERVER_ID = "948681259889094766";

client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.get(SERVER_ID);

    if (guild) {
        console.log("SERVER FOUND!");
        console.log(`Name: ${guild.name}`);
        console.log(`ID: ${guild.id}`);
        console.log(`Members: ${guild.memberCount}`);
    } else {
        console.log("SERVER NOT FOUND.");
    }

    client.destroy();
});

client.login(process.env.BOT_TOKEN);