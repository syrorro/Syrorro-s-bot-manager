const {
    Client,
    GatewayIntentBits,
    Events
} = require("discord.js");

require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ========================================
// CONFIG
// ========================================

const SERVER_ID = "948681259889094766";
const TEST_USER_ID = "969986248586449016";

const RANK_III_ROLE_ID = "973666576727433276";
const GOVERNMENT_INVESTORS_ROLE_ID = "949331181911023666";

const IMAGE_PERM_ROLE_ID = "1538980733908033637";
const EMBED_PERM_ROLE_ID = "1538990659120402512";

const IMAGE_BANISHMENT_ROLE_ID = "1538990908928819270";
const EMBED_BANISHMENT_ROLE_ID = "1514388508125560853";

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.get(SERVER_ID);

    if (!guild) {
        console.log("SERVER NOT FOUND.");
        client.destroy();
        return;
    }

    console.log(`Server found: ${guild.name}`);

    try {
        // Fetch ONLY the test account
        const member = await guild.members.fetch(TEST_USER_ID);

        console.log("");
        console.log("======================================");
        console.log("TEST ACCOUNT");
        console.log("======================================");
        console.log(`Username: ${member.user.tag}`);
        console.log(`User ID: ${member.id}`);

        const hasRankIII =
            member.roles.cache.has(RANK_III_ROLE_ID);

        const hasGovernmentInvestors =
            member.roles.cache.has(GOVERNMENT_INVESTORS_ROLE_ID);

        const hasImageBanishment =
            member.roles.cache.has(IMAGE_BANISHMENT_ROLE_ID);

        const hasEmbedBanishment =
            member.roles.cache.has(EMBED_BANISHMENT_ROLE_ID);

        const hasImagePerm =
            member.roles.cache.has(IMAGE_PERM_ROLE_ID);

        const hasEmbedPerm =
            member.roles.cache.has(EMBED_PERM_ROLE_ID);

        const qualifies =
            hasRankIII || hasGovernmentInvestors;

        const shouldHaveImagePerm =
            qualifies && !hasImageBanishment;

        const shouldHaveEmbedPerm =
            qualifies && !hasEmbedBanishment;

        console.log("");
        console.log("CURRENT ROLES:");
        console.log(`Rank III:              ${hasRankIII}`);
        console.log(`Government Investors: ${hasGovernmentInvestors}`);
        console.log(`Image Banishment:     ${hasImageBanishment}`);
        console.log(`Embed Banishment:     ${hasEmbedBanishment}`);
        console.log(`Image Perm:           ${hasImagePerm}`);
        console.log(`Embed Perm:           ${hasEmbedPerm}`);

        console.log("");
        console.log("EXPECTED:");
        console.log(`Should have Image Perm: ${shouldHaveImagePerm}`);
        console.log(`Should have Embed Perm: ${shouldHaveEmbedPerm}`);

        console.log("");
        console.log("APPLYING CHANGES TO TEST ACCOUNT ONLY...");

        // IMAGE PERM
        if (shouldHaveImagePerm && !hasImagePerm) {
            await member.roles.add(
                IMAGE_PERM_ROLE_ID,
                "Role Manager test - Image Perm"
            );

            console.log("✅ Added Image Perm");
        } else if (!shouldHaveImagePerm && hasImagePerm) {
            await member.roles.remove(
                IMAGE_PERM_ROLE_ID,
                "Role Manager test - Image Perm"
            );

            console.log("✅ Removed Image Perm");
        } else {
            console.log("➖ Image Perm already correct");
        }

        // EMBED PERM
        if (shouldHaveEmbedPerm && !hasEmbedPerm) {
            await member.roles.add(
                EMBED_PERM_ROLE_ID,
                "Role Manager test - Embed Perm"
            );

            console.log("✅ Added Embed Perm");
        } else if (!shouldHaveEmbedPerm && hasEmbedPerm) {
            await member.roles.remove(
                EMBED_PERM_ROLE_ID,
                "Role Manager test - Embed Perm"
            );

            console.log("✅ Removed Embed Perm");
        } else {
            console.log("➖ Embed Perm already correct");
        }

        console.log("");
        console.log("TEST COMPLETE.");
        console.log("Only user 969986248586449016 was checked.");

    } catch (error) {
        console.error("TEST FAILED:");
        console.error(error);
    }

    client.destroy();
});

client.login(process.env.BOT_TOKEN);