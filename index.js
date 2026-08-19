const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

// ========================================
// CLIENT
// ========================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// ========================================
// CONFIG
// ========================================

const SERVER_ID = "948681259889094766";

const RANK_III_ROLE_ID = "973666576727433276";
const GOVERNMENT_INVESTORS_ROLE_ID = "949331181911023666";

const IMAGE_PERM_ROLE_ID = "1538980733908033637";
const EMBED_PERM_ROLE_ID = "1538990659120402512";

const IMAGE_BANISHMENT_ROLE_ID = "1538990908928819270";
const EMBED_BANISHMENT_ROLE_ID = "1514388508125560853";

// ========================================
// TEST MODE
// ========================================

// TRUE  = ONLY manages TEST_USER_ID
// FALSE = manages the entire server

const TEST_MODE = false;

const TEST_USER_ID = "969986248586449016";

// ========================================
// BANISHMENT PERSISTENCE
// ========================================

const BANISHMENT_FILE = path.join(
    __dirname,
    "banishments.json"
);

function loadBanishmentStore() {

    try {

        if (!fs.existsSync(BANISHMENT_FILE)) {
            return {};
        }

        const raw =
            fs.readFileSync(
                BANISHMENT_FILE,
                "utf8"
            );

        if (!raw.trim()) {
            return {};
        }

        return JSON.parse(raw);

    }

    catch (error) {

        console.error(
            "[PERSISTENCE] Failed to load banishments.json"
        );

        console.error(error);

        return {};
    }
}

const banishmentStore =
    loadBanishmentStore();

function saveBanishmentStore() {

    try {

        fs.writeFileSync(
            BANISHMENT_FILE,
            JSON.stringify(
                banishmentStore,
                null,
                4
            ),
            "utf8"
        );

    }

    catch (error) {

        console.error(
            "[PERSISTENCE] Failed to save banishments.json"
        );

        console.error(error);
    }
}

function setStoredBanishments(
    userId,
    image,
    embed
) {

    const previous =
        banishmentStore[userId] || {
            image: false,
            embed: false
        };

    // No blacklist at all:
    // remove the stored entry.

    if (!image && !embed) {

        if (banishmentStore[userId]) {

            delete banishmentStore[userId];

            saveBanishmentStore();

            console.log(
                `[PERSISTENCE CLEAR] ${userId}`
            );

            return true;
        }

        return false;
    }

    // Nothing changed

    if (
        previous.image === image &&
        previous.embed === embed
    ) {
        return false;
    }

    banishmentStore[userId] = {
        image: image,
        embed: embed
    };

    saveBanishmentStore();

    console.log(
        `[PERSISTENCE SAVE] ${userId} | ` +
        `Image: ${image} | Embed: ${embed}`
    );

    return true;
}

function updateStoredBanishmentsFromMember(
    member
) {

    const image =
        member.roles.cache.has(
            IMAGE_BANISHMENT_ROLE_ID
        );

    const embed =
        member.roles.cache.has(
            EMBED_BANISHMENT_ROLE_ID
        );

    return setStoredBanishments(
        member.id,
        image,
        embed
    );
}

// ========================================
// SLASH COMMAND CHOICES
// ========================================

const BLACKLIST_CHOICES = [
    {
        name: "IMAGE",
        value: "image"
    },
    {
        name: "EMBED",
        value: "embed"
    },
    {
        name: "IMG_IMBED",
        value: "both"
    }
];

// ========================================
// SLASH COMMANDS
// ========================================

const commands = [

    new SlashCommandBuilder()
        .setName("blacklist")
        .setDescription(
            "Blacklist a member from images, embeds, or both"
        )

        .addUserOption(option =>
            option
                .setName("user")
                .setDescription(
                    "User to blacklist"
                )
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("type")
                .setDescription(
                    "Type of blacklist"
                )
                .setRequired(true)
                .addChoices(
                    ...BLACKLIST_CHOICES
                )
        )

        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription(
                    "Reason for the blacklist"
                )
                .setRequired(false)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        )

        .toJSON(),

    new SlashCommandBuilder()
        .setName("unblacklist")
        .setDescription(
            "Remove an image, embed, or combined blacklist"
        )

        .addUserOption(option =>
            option
                .setName("user")
                .setDescription(
                    "User to unblacklist"
                )
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("type")
                .setDescription(
                    "Type of blacklist to remove"
                )
                .setRequired(true)
                .addChoices(
                    ...BLACKLIST_CHOICES
                )
        )

        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription(
                    "Reason for removing the blacklist"
                )
                .setRequired(false)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        )

        .toJSON()
];

// ========================================
// SYNC LOCK
// ========================================

const syncingMembers = new Set();

// ========================================
// HELPERS
// ========================================

function getBlacklistName(type) {

    if (type === "image") {
        return "Image";
    }

    if (type === "embed") {
        return "Embed";
    }

    if (type === "both") {
        return "Image + Embed";
    }

    return "Unknown";
}

function getBlacklistDescription(type) {

    if (type === "image") {
        return "uploading images/files";
    }

    if (type === "embed") {
        return "sending embedded links";
    }

    if (type === "both") {
        return (
            "uploading images/files and " +
            "sending embedded links"
        );
    }

    return "using restricted media features";
}

// ========================================
// SYNC ACCESS PERMISSIONS
// ========================================

async function syncPermissions(member) {

    // TEST MODE

    if (
        TEST_MODE &&
        member.id !== TEST_USER_ID
    ) {
        return;
    }

    // Ignore bots

    if (member.user.bot) {
        return;
    }

    if (syncingMembers.has(member.id)) {
        return;
    }

    syncingMembers.add(member.id);

    try {

        // ========================================
        // QUALIFYING ROLES
        // ========================================

        const hasRankIII =
            member.roles.cache.has(
                RANK_III_ROLE_ID
            );

        const hasGovernmentInvestors =
            member.roles.cache.has(
                GOVERNMENT_INVESTORS_ROLE_ID
            );

        const qualifies =
            hasRankIII ||
            hasGovernmentInvestors;

        // ========================================
        // BANISHMENTS
        // ========================================

        const hasImageBanishment =
            member.roles.cache.has(
                IMAGE_BANISHMENT_ROLE_ID
            );

        const hasEmbedBanishment =
            member.roles.cache.has(
                EMBED_BANISHMENT_ROLE_ID
            );

        // ========================================
        // CURRENT ACCESS
        // ========================================

        const hasImagePerm =
            member.roles.cache.has(
                IMAGE_PERM_ROLE_ID
            );

        const hasEmbedPerm =
            member.roles.cache.has(
                EMBED_PERM_ROLE_ID
            );

        // ========================================
        // EXPECTED ACCESS
        // ========================================

        const shouldHaveImagePerm =
            qualifies &&
            !hasImageBanishment;

        const shouldHaveEmbedPerm =
            qualifies &&
            !hasEmbedBanishment;

        // ========================================
        // IMAGE ACCESS
        // ========================================

        if (
            shouldHaveImagePerm &&
            !hasImagePerm
        ) {

            await member.roles.add(
                IMAGE_PERM_ROLE_ID,
                "Automatically granted Image Access"
            );

            console.log(
                `[IMAGE ADD] ${member.user.tag} (${member.id})`
            );

        }

        else if (
            !shouldHaveImagePerm &&
            hasImagePerm
        ) {

            await member.roles.remove(
                IMAGE_PERM_ROLE_ID,

                hasImageBanishment
                    ? "Image Banishment active"
                    : "Member no longer qualifies for Image Access"
            );

            console.log(
                `[IMAGE REMOVE] ${member.user.tag} (${member.id})`
            );
        }

        // ========================================
        // EMBED ACCESS
        // ========================================

        if (
            shouldHaveEmbedPerm &&
            !hasEmbedPerm
        ) {

            await member.roles.add(
                EMBED_PERM_ROLE_ID,
                "Automatically granted Embed Access"
            );

            console.log(
                `[EMBED ADD] ${member.user.tag} (${member.id})`
            );

        }

        else if (
            !shouldHaveEmbedPerm &&
            hasEmbedPerm
        ) {

            await member.roles.remove(
                EMBED_PERM_ROLE_ID,

                hasEmbedBanishment
                    ? "Embed Banishment active"
                    : "Member no longer qualifies for Embed Access"
            );

            console.log(
                `[EMBED REMOVE] ${member.user.tag} (${member.id})`
            );
        }

    }

    catch (error) {

        console.error(
            `[SYNC ERROR] ${member.user.tag} (${member.id})`
        );

        console.error(error);

    }

    finally {

        syncingMembers.delete(member.id);
    }
}

// ========================================
// LIVE ROLE CHANGE SYNC
// ========================================

client.on(
    Events.GuildMemberUpdate,

    async (oldMember, newMember) => {

        if (
            newMember.guild.id !== SERVER_ID
        ) {
            return;
        }

        if (
            TEST_MODE &&
            newMember.id !== TEST_USER_ID
        ) {
            return;
        }

        if (newMember.user.bot) {
            return;
        }

        // ========================================
        // DETECT BANISHMENT CHANGES
        // ========================================

        const imageBanishmentChanged =
            oldMember.roles.cache.has(
                IMAGE_BANISHMENT_ROLE_ID
            )
            !==
            newMember.roles.cache.has(
                IMAGE_BANISHMENT_ROLE_ID
            );

        const embedBanishmentChanged =
            oldMember.roles.cache.has(
                EMBED_BANISHMENT_ROLE_ID
            )
            !==
            newMember.roles.cache.has(
                EMBED_BANISHMENT_ROLE_ID
            );

        // Keep ONLY the two banishment roles
        // persistent.

        if (
            imageBanishmentChanged ||
            embedBanishmentChanged
        ) {

            updateStoredBanishmentsFromMember(
                newMember
            );
        }

        // ========================================
        // NORMAL ACCESS SYNC
        // ========================================

        const watchedRoles = [

            RANK_III_ROLE_ID,
            GOVERNMENT_INVESTORS_ROLE_ID,

            IMAGE_PERM_ROLE_ID,
            EMBED_PERM_ROLE_ID,

            IMAGE_BANISHMENT_ROLE_ID,
            EMBED_BANISHMENT_ROLE_ID
        ];

        const relevantRoleChanged =
            watchedRoles.some(roleId => {

                const hadRole =
                    oldMember.roles.cache.has(
                        roleId
                    );

                const hasRole =
                    newMember.roles.cache.has(
                        roleId
                    );

                return hadRole !== hasRole;
            });

        if (!relevantRoleChanged) {
            return;
        }

        console.log(
            `[ROLE CHANGE] ${newMember.user.tag} (${newMember.id})`
        );

        await syncPermissions(
            newMember
        );
    }
);

// ========================================
// MEMBER LEAVES SERVER
// ========================================

client.on(
    Events.GuildMemberRemove,

    member => {

        if (
            member.guild.id !== SERVER_ID
        ) {
            return;
        }

        if (
            TEST_MODE &&
            member.id !== TEST_USER_ID
        ) {
            return;
        }

        if (member.user.bot) {
            return;
        }

        // Discord's remove event can sometimes
        // be partial. If we have the member's
        // cached roles, refresh the saved record.
        //
        // If it is partial, keep whatever state
        // we already recorded from role changes.

        if (
            !member.partial &&
            member.roles?.cache
        ) {

            updateStoredBanishmentsFromMember(
                member
            );
        }

        const saved =
            banishmentStore[member.id];

        if (saved) {

            console.log(
                `[MEMBER LEFT] ${member.user.tag} (${member.id}) | ` +
                `Persistent Image: ${saved.image} | ` +
                `Persistent Embed: ${saved.embed}`
            );

        }

        else {

            console.log(
                `[MEMBER LEFT] ${member.user.tag} (${member.id}) | ` +
                `No banishments to persist`
            );
        }
    }
);

// ========================================
// MEMBER REJOINS SERVER
// ========================================

client.on(
    Events.GuildMemberAdd,

    async member => {

        if (
            member.guild.id !== SERVER_ID
        ) {
            return;
        }

        if (
            TEST_MODE &&
            member.id !== TEST_USER_ID
        ) {
            return;
        }

        if (member.user.bot) {
            return;
        }

        const saved =
            banishmentStore[member.id];

        if (!saved) {

            console.log(
                `[MEMBER JOINED] ${member.user.tag} (${member.id}) | ` +
                `No banishments to restore`
            );

            return;
        }

        console.log(
            `[MEMBER REJOINED] ${member.user.tag} (${member.id}) | ` +
            `Restoring persistent banishments`
        );

        try {

            // ========================================
            // RESTORE IMAGE BANISHMENT
            // ========================================

            if (
                saved.image &&
                !member.roles.cache.has(
                    IMAGE_BANISHMENT_ROLE_ID
                )
            ) {

                await member.roles.add(
                    IMAGE_BANISHMENT_ROLE_ID,
                    "Restored persistent Image Banishment after rejoin"
                );

                console.log(
                    `[RESTORE IMAGE BANISHMENT] ` +
                    `${member.user.tag} (${member.id})`
                );
            }

            // ========================================
            // RESTORE EMBED BANISHMENT
            // ========================================

            if (
                saved.embed &&
                !member.roles.cache.has(
                    EMBED_BANISHMENT_ROLE_ID
                )
            ) {

                await member.roles.add(
                    EMBED_BANISHMENT_ROLE_ID,
                    "Restored persistent Embed Banishment after rejoin"
                );

                console.log(
                    `[RESTORE EMBED BANISHMENT] ` +
                    `${member.user.tag} (${member.id})`
                );
            }

            // Fetch the updated member so the role
            // cache is definitely current.

            const refreshedMember =
                await member.guild.members.fetch(
                    member.id
                );

            updateStoredBanishmentsFromMember(
                refreshedMember
            );

            await syncPermissions(
                refreshedMember
            );

        }

        catch (error) {

            console.error(
                `[RESTORE ERROR] ${member.user.tag} (${member.id})`
            );

            console.error(error);
        }
    }
);

// ========================================
// MESSAGE-BASED LAZY SYNC
// ========================================

client.on(
    Events.MessageCreate,

    async message => {

        if (
            message.guildId !== SERVER_ID
        ) {
            return;
        }

        if (message.author.bot) {
            return;
        }

        if (
            TEST_MODE &&
            message.author.id !== TEST_USER_ID
        ) {
            return;
        }

        if (!message.member) {
            return;
        }

        // Also refresh the stored banishment state
        // whenever an active member talks.
        //
        // This does NOT save on every message unless
        // the actual banishment state changed.

        updateStoredBanishmentsFromMember(
            message.member
        );

        await syncPermissions(
            message.member
        );
    }
);

// ========================================
// SLASH COMMAND HANDLER
// ========================================

client.on(
    Events.InteractionCreate,

    async interaction => {

        if (
            !interaction.isChatInputCommand()
        ) {
            return;
        }

        if (
            interaction.guildId !== SERVER_ID
        ) {
            return;
        }

        if (
            interaction.commandName !== "blacklist" &&
            interaction.commandName !== "unblacklist"
        ) {
            return;
        }

        // ========================================
        // PERMISSION CHECK
        // ========================================

        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageRoles
            )
        ) {

            await interaction.reply({
                content:
                    "❌ You do not have permission to use this command.",
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // ========================================
        // OPTIONS
        // ========================================

        const user =
            interaction.options.getUser(
                "user",
                true
            );

        const type =
            interaction.options.getString(
                "type",
                true
            );

        const suppliedReason =
            interaction.options.getString(
                "reason"
            );

        const reason =
            suppliedReason ||
            "No reason provided.";

        // ========================================
        // TEST MODE
        // ========================================

        if (
            TEST_MODE &&
            user.id !== TEST_USER_ID
        ) {

            await interaction.reply({
                content:
                    `⚠️ **TEST MODE is enabled.**\n` +
                    `The bot can currently only modify <@${TEST_USER_ID}>.`,
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        if (user.bot) {

            await interaction.reply({
                content:
                    "❌ This command cannot be used on bots.",
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // Public response

        await interaction.deferReply();

        try {

            const member =
                await interaction.guild.members
                    .fetch(user.id)
                    .catch(() => null);

            const typeName =
                getBlacklistName(type);

            const restrictionDescription =
                getBlacklistDescription(type);

            const auditReason =
                `${interaction.commandName} by ` +
                `${interaction.user.tag}: ${reason}`;

            // ========================================
            // /BLACKLIST
            // ========================================

            if (
                interaction.commandName ===
                "blacklist"
            ) {

                if (!member) {

                    await interaction.editReply({
                        content:
                            "❌ That user is not currently in the server.",
                        embeds: []
                    });

                    return;
                }

                if (!member.manageable) {

                    await interaction.editReply({
                        content:
                            "❌ I cannot manage this user because their highest role is equal to or higher than my bot role.",
                        embeds: []
                    });

                    return;
                }

                let changedSomething = false;

                // IMAGE

                if (
                    type === "image" ||
                    type === "both"
                ) {

                    if (
                        !member.roles.cache.has(
                            IMAGE_BANISHMENT_ROLE_ID
                        )
                    ) {

                        await member.roles.add(
                            IMAGE_BANISHMENT_ROLE_ID,
                            auditReason
                        );

                        changedSomething = true;
                    }
                }

                // EMBED

                if (
                    type === "embed" ||
                    type === "both"
                ) {

                    if (
                        !member.roles.cache.has(
                            EMBED_BANISHMENT_ROLE_ID
                        )
                    ) {

                        await member.roles.add(
                            EMBED_BANISHMENT_ROLE_ID,
                            auditReason
                        );

                        changedSomething = true;
                    }
                }

                if (!changedSomething) {

                    await interaction.editReply({
                        content:
                            `⚠️ **${user.username}** already has the selected blacklist.\n` +
                            `Type: **${typeName}**`,
                        embeds: []
                    });

                    return;
                }

                // Refresh after role changes

                const updatedMember =
                    await interaction.guild.members.fetch(
                        user.id
                    );

                // Save blacklist state immediately.
                // This means it survives even if the
                // bot later goes offline before they leave.

                updateStoredBanishmentsFromMember(
                    updatedMember
                );

                await syncPermissions(
                    updatedMember
                );

                // DM USER

                let dmStatus = "Sent";

                try {

                    await user.send(
                        `You have been blacklisted from **${restrictionDescription}** in **${interaction.guild.name}**.\n\n` +
                        `**Reason:** ${reason}`
                    );

                }

                catch {

                    dmStatus =
                        "Failed — user may have DMs disabled";

                    console.log(
                        `[DM FAILED] ${user.tag} (${user.id})`
                    );
                }

                // PUBLIC RESPONSE

                const resultEmbed =
                    new EmbedBuilder()
                        .setDescription(
                            `✅ **${user.username} was ${typeName} Blacklisted.** | "${reason}"`
                        );

                await interaction.editReply({
                    content: null,
                    embeds: [resultEmbed]
                });

                console.log(
                    `[BLACKLIST] ${user.tag} (${user.id}) | ` +
                    `${typeName} | ${reason} | ` +
                    `By ${interaction.user.tag} | ` +
                    `DM: ${dmStatus}`
                );

                return;
            }

            // ========================================
            // /UNBLACKLIST
            // ========================================

            if (
                interaction.commandName ===
                "unblacklist"
            ) {

                if (!member) {

                    await interaction.editReply({
                        content:
                            "❌ That user is not currently in the server.",
                        embeds: []
                    });

                    return;
                }

                if (!member.manageable) {

                    await interaction.editReply({
                        content:
                            "❌ I cannot manage this user because their highest role is equal to or higher than my bot role.",
                        embeds: []
                    });

                    return;
                }

                let changedSomething = false;

                // IMAGE

                if (
                    type === "image" ||
                    type === "both"
                ) {

                    if (
                        member.roles.cache.has(
                            IMAGE_BANISHMENT_ROLE_ID
                        )
                    ) {

                        await member.roles.remove(
                            IMAGE_BANISHMENT_ROLE_ID,
                            auditReason
                        );

                        changedSomething = true;
                    }
                }

                // EMBED

                if (
                    type === "embed" ||
                    type === "both"
                ) {

                    if (
                        member.roles.cache.has(
                            EMBED_BANISHMENT_ROLE_ID
                        )
                    ) {

                        await member.roles.remove(
                            EMBED_BANISHMENT_ROLE_ID,
                            auditReason
                        );

                        changedSomething = true;
                    }
                }

                if (!changedSomething) {

                    await interaction.editReply({
                        content:
                            `⚠️ **${user.username}** does not currently have the selected blacklist.\n` +
                            `Type: **${typeName}**`,
                        embeds: []
                    });

                    return;
                }

                const updatedMember =
                    await interaction.guild.members.fetch(
                        user.id
                    );

                // This also clears the persistence
                // entry for whichever banishment was
                // just removed.

                updateStoredBanishmentsFromMember(
                    updatedMember
                );

                await syncPermissions(
                    updatedMember
                );

                // DM USER

                let dmStatus = "Sent";

                try {

                    await user.send(
                        `Your **${typeName} Blacklist** has been removed in **${interaction.guild.name}**.\n\n` +
                        `**Reason:** ${reason}`
                    );

                }

                catch {

                    dmStatus =
                        "Failed — user may have DMs disabled";

                    console.log(
                        `[DM FAILED] ${user.tag} (${user.id})`
                    );
                }

                // PUBLIC RESPONSE

                const resultEmbed =
                    new EmbedBuilder()
                        .setDescription(
                            `✅ **${user.username}'s ${typeName} Blacklist was removed.** | "${reason}"`
                        );

                await interaction.editReply({
                    content: null,
                    embeds: [resultEmbed]
                });

                console.log(
                    `[UNBLACKLIST] ${user.tag} (${user.id}) | ` +
                    `${typeName} | ${reason} | ` +
                    `By ${interaction.user.tag} | ` +
                    `DM: ${dmStatus}`
                );

                return;
            }

        }

        catch (error) {

            console.error(
                `[COMMAND ERROR] /${interaction.commandName}`
            );

            console.error(error);

            try {

                await interaction.editReply({
                    content:
                        "❌ Something went wrong while changing that member's blacklist.",
                    embeds: []
                });

            }

            catch {
                // Nothing else to do
            }
        }
    }
);

// ========================================
// READY
// ========================================

client.once(
    Events.ClientReady,

    async () => {

        const guild =
            client.guilds.cache.get(
                SERVER_ID
            );

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            `Logged in as ${client.user.tag}`
        );

        if (!guild) {

            console.log("");
            console.log(
                "SERVER NOT FOUND."
            );

            console.log(
                "========================================"
            );

            return;
        }

        // ========================================
        // REGISTER SLASH COMMANDS
        // ========================================

        const rest =
            new REST({
                version: "10"
            }).setToken(
                process.env.BOT_TOKEN
            );

        try {

            await rest.put(
                Routes.applicationGuildCommands(
                    client.user.id,
                    SERVER_ID
                ),
                {
                    body: commands
                }
            );

            console.log(
                "✓ /blacklist registered"
            );

            console.log(
                "✓ /unblacklist registered"
            );

        }

        catch (error) {

            console.error(
                "❌ Failed to register slash commands:"
            );

            console.error(error);
        }

        // ========================================
        // STATUS
        // ========================================

        console.log(
            `Server: ${guild.name}`
        );

        console.log(
            `Server ID: ${guild.id}`
        );

        console.log(
            `Members: ${guild.memberCount}`
        );

        console.log("");
        console.log(
            "ROLE MANAGER IS LIVE"
        );

        console.log("");

        if (TEST_MODE) {

            console.log(
                "⚠ TEST MODE ENABLED"
            );

            console.log(
                `ONLY managing user: ${TEST_USER_ID}`
            );

        }

        else {

            console.log(
                "✓ PRODUCTION MODE"
            );

            console.log(
                "Managing all server members"
            );
        }

        console.log("");

        console.log(
            "✓ Live role-change synchronization"
        );

        console.log(
            "✓ Message-based lazy synchronization"
        );

        console.log(
            "✓ Persistent Image Banishment"
        );

        console.log(
            "✓ Persistent Embed Banishment"
        );

        console.log(
            "✓ Leave detection"
        );

        console.log(
            "✓ Rejoin restoration"
        );

        console.log(
            `✓ Stored punishments: ${Object.keys(banishmentStore).length}`
        );

        console.log(
            "✓ /blacklist"
        );

        console.log(
            "✓ /unblacklist"
        );

        console.log(
            "✓ User DM notifications"
        );

        console.log(
            "✓ NO startup member sweep"
        );

        console.log(
            "✓ NO Message Content intent"
        );

        console.log(
            "========================================"
        );

        console.log("");
    }
);

// ========================================
// LOGIN
// ========================================

client.login(
    process.env.BOT_TOKEN
);