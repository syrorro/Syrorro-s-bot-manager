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
const ADMIN_ROOM_ID = "948684753140326461";
const CHAT_MODERATOR_ROLE_ID = "974148626299383838";

const RANK_III_ROLE_ID = "973666576727433276";
const GOVERNMENT_INVESTORS_ROLE_ID = "949331181911023666";

const IMAGE_PERM_ROLE_ID = "1538980733908033637";
const EMBED_PERM_ROLE_ID = "1538990659120402512";

const IMAGE_BANISHMENT_ROLE_ID = "1538990908928819270";
const EMBED_BANISHMENT_ROLE_ID = "1514388508125560853";

const COMPLEX_BLACKLIST_ROLE_ID = "1279268982632874087";
const TOV_BLACKLIST_ROLE_ID = "1540169411250487406";
const PSLH_BLACKLIST_ROLE_ID = "1540169475968598127";
const FORUMS_BLACKLIST_ROLE_ID = "1540181617379774544";

// ========================================
// TEST MODE
// ========================================

// TRUE  = ONLY manages TEST_USER_ID
// FALSE = manages the entire server
const TEST_MODE = false;
const TEST_USER_ID = "969986248586449016";

// ========================================
// PUNISHMENT DEFINITIONS
// ========================================

const PUNISHMENTS = {
    image_banishment: {
        roleId: IMAGE_BANISHMENT_ROLE_ID,
        category: "banishment",
        label: "Image Banishment"
    },

    embed_banishment: {
        roleId: EMBED_BANISHMENT_ROLE_ID,
        category: "banishment",
        label: "Embed Banishment"
    },

    complex_blacklist: {
        roleId: COMPLEX_BLACKLIST_ROLE_ID,
        category: "blacklist",
        label: "Complex Blacklist"
    },

    tov_blacklist: {
        roleId: TOV_BLACKLIST_ROLE_ID,
        category: "blacklist",
        label: "TOV Blacklist"
    },

    pslh_blacklist: {
        roleId: PSLH_BLACKLIST_ROLE_ID,
        category: "blacklist",
        label: "PSLH Blacklist"
    },

    forums_blacklist: {
        roleId: FORUMS_BLACKLIST_ROLE_ID,
        category: "blacklist",
        label: "Forums Blacklist"
    }
};

const PUNISHMENT_KEYS =
    Object.keys(PUNISHMENTS);

const PUNISHMENT_ROLE_IDS =
    PUNISHMENT_KEYS.map(
        key => PUNISHMENTS[key].roleId
    );

// ========================================
// PERSISTENCE
// ========================================

// Locally: saves beside index.js.
// Railway: saves on the persistent /data volume.

const IS_RAILWAY = Boolean(
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_ENVIRONMENT_ID
);

const DATA_DIR =
    IS_RAILWAY
        ? "/data"
        : __dirname;

const PUNISHMENT_FILE =
    path.join(
        DATA_DIR,
        "banishments.json"
    );

function makeEmptyStore() {

    return {
        version: 2,
        users: {}
    };
}

function migrateLegacyStore(data) {

    if (
        data &&
        data.version === 2 &&
        data.users &&
        typeof data.users === "object"
    ) {

        return data;
    }

    const migrated =
        makeEmptyStore();

    if (
        !data ||
        typeof data !== "object"
    ) {

        return migrated;
    }

    for (
        const [userId, oldEntry]
        of Object.entries(data)
    ) {

        if (
            !oldEntry ||
            typeof oldEntry !== "object"
        ) {
            continue;
        }

        const punishments = {};

        if (
            oldEntry.image === true
        ) {

            punishments.image_banishment = {

                expiresAt: null,

                reason:
                    "Migrated persistent Image Banishment",

                moderatorId: null,

                dm: false,

                createdAt:
                    Date.now(),

                source:
                    "legacy",

                publicChannelId: null,

                publicMessageId: null
            };
        }

        if (
            oldEntry.embed === true
        ) {

            punishments.embed_banishment = {

                expiresAt: null,

                reason:
                    "Migrated persistent Embed Banishment",

                moderatorId: null,

                dm: false,

                createdAt:
                    Date.now(),

                source:
                    "legacy",

                publicChannelId: null,

                publicMessageId: null
            };
        }

        if (
            Object.keys(
                punishments
            ).length > 0
        ) {

            migrated.users[userId] = {
                punishments
            };
        }
    }

    return migrated;
}

function loadPunishmentStore() {

    try {

        if (
            !fs.existsSync(
                PUNISHMENT_FILE
            )
        ) {

            return makeEmptyStore();
        }

        const raw =
            fs.readFileSync(
                PUNISHMENT_FILE,
                "utf8"
            );

        if (
            !raw.trim()
        ) {

            return makeEmptyStore();
        }

        return migrateLegacyStore(
            JSON.parse(raw)
        );
    }

    catch (error) {

        console.error(
            "[PERSISTENCE] Failed to load banishments.json"
        );

        console.error(error);

        return makeEmptyStore();
    }
}

const punishmentStore =
    loadPunishmentStore();

function savePunishmentStore() {

    try {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

        fs.writeFileSync(
            PUNISHMENT_FILE,

            JSON.stringify(
                punishmentStore,
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

function getUserPunishments(
    userId,
    create = false
) {

    let entry =
        punishmentStore.users[
            userId
        ];

    if (
        !entry &&
        create
    ) {

        entry = {
            punishments: {}
        };

        punishmentStore.users[
            userId
        ] = entry;
    }

    if (
        entry &&
        (
            !entry.punishments ||
            typeof entry.punishments !==
            "object"
        )
    ) {

        entry.punishments = {};
    }

    return entry;
}

function cleanUserStore(
    userId
) {

    const entry =
        getUserPunishments(
            userId,
            false
        );

    if (
        !entry
    ) {
        return;
    }

    if (
        Object.keys(
            entry.punishments
        ).length === 0
    ) {

        delete punishmentStore.users[
            userId
        ];
    }
}

function buildStoredPunishmentRecord(
    key,
    previous = {},
    metadata = {}
) {

    return {

        expiresAt:
            metadata.expiresAt ??
            null,

        reason:
            metadata.reason ??
            "No reason provided.",

        moderatorId:
            metadata.moderatorId ??
            null,

        dm:
            metadata.dm ??
            false,

        createdAt:
            metadata.createdAt ??
            Date.now(),

        source:
            metadata.source ??
            "unknown",

        publicChannelId:
            metadata.publicChannelId ??
            previous.publicChannelId ??
            null,

        publicMessageId:
            metadata.publicMessageId ??
            previous.publicMessageId ??
            null,

        publicExpiredDescription:
            metadata.publicExpiredDescription ??
            previous.publicExpiredDescription ??
            null,

        // Multi-role commands such as Full Blacklist
        // share one batch. This lets expiry/logging treat
        // the whole command as one moderation action.
        batchId:
            metadata.batchId ??
            previous.batchId ??
            null,

        batchLabel:
            metadata.batchLabel ??
            previous.batchLabel ??
            null,

        batchKeys:
            Array.isArray(
                metadata.batchKeys
            )
                ? [
                    ...metadata.batchKeys
                ]
                : (
                    Array.isArray(
                        previous.batchKeys
                    )
                        ? [
                            ...previous.batchKeys
                        ]
                        : [
                            key
                        ]
                )
    };
}

function setStoredPunishment(
    userId,
    key,
    metadata = {}
) {

    if (
        !PUNISHMENTS[key]
    ) {

        return;
    }

    const entry =
        getUserPunishments(
            userId,
            true
        );

    const previous =
        entry.punishments[
            key
        ] || {};

    entry.punishments[
        key
    ] =
        buildStoredPunishmentRecord(
            key,
            previous,
            metadata
        );

    savePunishmentStore();

    console.log(
        `[PERSISTENCE SAVE] ${userId} | ` +
        `${key} | Expires: ` +
        `${
            entry
                .punishments[key]
                .expiresAt ??
            "never"
        }`
    );
}

function setStoredPunishments(
    userId,
    keys,
    metadata = {}
) {

    const entry =
        getUserPunishments(
            userId,
            true
        );

    const savedKeys =
        [];

    for (
        const key
        of keys
    ) {

        if (
            !PUNISHMENTS[key]
        ) {

            continue;
        }

        const previous =
            entry.punishments[
                key
            ] || {};

        entry.punishments[
            key
        ] =
            buildStoredPunishmentRecord(
                key,
                previous,
                metadata
            );

        savedKeys.push(
            key
        );
    }

    if (
        savedKeys.length ===
        0
    ) {

        return false;
    }

    savePunishmentStore();

    console.log(
        `[PERSISTENCE BATCH SAVE] ${userId} | ` +
        `${savedKeys.join(", ")} | ` +
        `Expires: ${metadata.expiresAt ?? "never"}`
    );

    return true;
}

function deleteStoredPunishments(
    userId,
    keys
) {

    const entry =
        getUserPunishments(
            userId,
            false
        );

    if (
        !entry?.punishments
    ) {

        return false;
    }

    const removedKeys =
        [];

    for (
        const key
        of keys
    ) {

        if (
            !entry.punishments[
                key
            ]
        ) {

            continue;
        }

        delete entry.punishments[
            key
        ];

        removedKeys.push(
            key
        );
    }

    if (
        removedKeys.length ===
        0
    ) {

        return false;
    }

    cleanUserStore(
        userId
    );

    savePunishmentStore();

    console.log(
        `[PERSISTENCE BATCH CLEAR] ${userId} | ` +
        `${removedKeys.join(", ")}`
    );

    return true;
}

function deleteStoredPunishment(
    userId,
    key
) {

    return deleteStoredPunishments(
        userId,
        [
            key
        ]
    );
}

function getStoredPunishment(
    userId,
    key
) {

    return (
        getUserPunishments(
            userId,
            false
        )
        ?.punishments?.[key]
        ??
        null
    );
}

// ========================================
// SAVE ORIGINAL PUBLIC MESSAGE
// ========================================

function attachPublicMessageToPunishments(
    userId,
    keys,
    message,
    expiredDescription
) {

    if (
        !message?.id ||
        !message?.channelId
    ) {

        console.error(
            "[PUBLIC MESSAGE SAVE] Message ID or channel ID missing."
        );

        return;
    }

    if (
        !expiredDescription
    ) {

        console.error(
            "[PUBLIC MESSAGE SAVE] Expired description missing."
        );

        return;
    }

    const entry =
        getUserPunishments(
            userId,
            false
        );

    if (
        !entry
    ) {

        console.error(
            `[PUBLIC MESSAGE SAVE] No stored punishment entry for ${userId}.`
        );

        return;
    }

    let changed =
        false;

    for (
        const key
        of keys
    ) {

        const record =
            entry.punishments[
                key
            ];

        if (
            !record
        ) {
            continue;
        }

        record.publicChannelId =
            message.channelId;

        record.publicMessageId =
            message.id;

        record.publicExpiredDescription =
            expiredDescription;

        changed =
            true;
    }

    if (
        changed
    ) {

        savePunishmentStore();

        console.log(
            `[PUBLIC MESSAGE SAVE] ${message.id} | EXPIRED DATA: YES`
        );
    }
}

// ========================================
// CHANGE ORIGINAL MESSAGE TO EXPIRED
// ========================================

async function markPublicMessageExpired(
    record
) {

    if (
        !record?.publicChannelId ||
        !record?.publicMessageId
    ) {

        console.log(
            "[PUBLIC EXPIRY] No stored message/channel ID."
        );

        return false;
    }

    if (
        !record.publicExpiredDescription
    ) {

        console.error(
            `[PUBLIC EXPIRY] No expired description stored for message ${record.publicMessageId}`
        );

        return false;
    }

    try {

        const channel =
            await client.channels.fetch(
                record.publicChannelId
            );

        if (
            !channel ||
            !channel.isTextBased() ||
            !channel.messages
        ) {

            console.error(
                "[PUBLIC EXPIRY] Could not access the punishment channel."
            );

            return false;
        }

        const expiredEmbed =
            new EmbedBuilder()
                .setDescription(
                    record.publicExpiredDescription
                );

        const editedMessage =
            await channel.messages.edit(

                record.publicMessageId,

                {
                    embeds: [
                        expiredEmbed
                    ]
                }
            );

        const editedDescription =
            editedMessage
                ?.embeds?.[0]
                ?.description ??
            "";

        if (
            !editedDescription.includes(
                "**Length:** **EXPIRED**"
            )
        ) {

            console.error(
                `[PUBLIC EXPIRY] Discord returned message ${record.publicMessageId}, but its embed did not contain EXPIRED.`
            );

            return false;
        }

        console.log(
            `[PUBLIC MESSAGE EXPIRED] ${record.publicMessageId} | VERIFIED`
        );

        return true;
    }

    catch (error) {

        console.error(
            `[PUBLIC EXPIRY MESSAGE ERROR] ${record.publicMessageId}`
        );

        console.error(
            error
        );

        return false;
    }
}

// ========================================
// SNAPSHOT PUNISHMENT ROLES
// ========================================

function snapshotPunishmentRoles(
    member
) {

    let changed =
        false;

    const entry =
        getUserPunishments(
            member.id,
            true
        );

    for (
        const key
        of PUNISHMENT_KEYS
    ) {

        const roleId =
            PUNISHMENTS[key]
                .roleId;

        const hasRole =
            member.roles.cache.has(
                roleId
            );

        const stored =
            entry.punishments[
                key
            ];

        if (
            hasRole &&
            !stored
        ) {

            entry.punishments[key] = {

                expiresAt:
                    null,

                reason:
                    "Role applied manually or by another integration.",

                moderatorId:
                    null,

                dm:
                    false,

                createdAt:
                    Date.now(),

                source:
                    "role_sync",

                publicChannelId:
                    null,

                publicMessageId:
                    null
            };

            changed =
                true;
        }

        if (
            !hasRole &&
            stored
        ) {

            delete entry
                .punishments[
                    key
                ];

            changed =
                true;
        }
    }

    cleanUserStore(
        member.id
    );

    if (
        changed
    ) {

        savePunishmentStore();
    }
}

// ========================================
// DURATION PARSER
// ========================================

const DURATION_UNITS = {

    s: 1000,
    sec: 1000,
    secs: 1000,
    second: 1000,
    seconds: 1000,

    m:
        60 *
        1000,

    min:
        60 *
        1000,

    mins:
        60 *
        1000,

    minute:
        60 *
        1000,

    minutes:
        60 *
        1000,

    h:
        60 *
        60 *
        1000,

    hr:
        60 *
        60 *
        1000,

    hrs:
        60 *
        60 *
        1000,

    hour:
        60 *
        60 *
        1000,

    hours:
        60 *
        60 *
        1000,

    d:
        24 *
        60 *
        60 *
        1000,

    day:
        24 *
        60 *
        60 *
        1000,

    days:
        24 *
        60 *
        60 *
        1000,

    w:
        7 *
        24 *
        60 *
        60 *
        1000,

    wk:
        7 *
        24 *
        60 *
        60 *
        1000,

    wks:
        7 *
        24 *
        60 *
        60 *
        1000,

    week:
        7 *
        24 *
        60 *
        60 *
        1000,

    weeks:
        7 *
        24 *
        60 *
        60 *
        1000
};

function parseDuration(
    input
) {

    if (
        !input ||
        !input.trim()
    ) {

        return {
            ms: null,
            permanent: true
        };
    }

    const normalized =
        input
            .trim()
            .toLowerCase();

    if (
        [
            "perm",
            "permanent",
            "forever",
            "none"
        ].includes(
            normalized
        )
    ) {

        return {
            ms: null,
            permanent: true
        };
    }

    const tokenRegex =
        /(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|wks?|wk|w)/gi;

    let totalMs =
        0;

    let match;

    while (
        (
            match =
            tokenRegex.exec(
                normalized
            )
        ) !== null
    ) {

        const amount =
            Number(
                match[1]
            );

        const unit =
            match[2]
                .toLowerCase();

        if (
            !Number.isFinite(
                amount
            ) ||
            amount <= 0
        ) {

            return null;
        }

        totalMs +=
            amount *
            DURATION_UNITS[
                unit
            ];
    }

    const leftovers =
        normalized
            .replace(
                tokenRegex,
                ""
            )
            .replace(
                /[\s,+]/g,
                ""
            );

    if (
        totalMs <= 0 ||
        leftovers.length > 0
    ) {

        return null;
    }

    const MAX_MS =
        10 *
        365 *
        24 *
        60 *
        60 *
        1000;

    if (
        totalMs >
        MAX_MS
    ) {

        return null;
    }

    return {
        ms: totalMs,
        permanent: false
    };
}

function formatDuration(
    ms
) {

    if (
        ms === null ||
        ms === undefined
    ) {

        return "Permanent";
    }

    const units = [

        [
            "week",

            7 *
            24 *
            60 *
            60 *
            1000
        ],

        [
            "day",

            24 *
            60 *
            60 *
            1000
        ],

        [
            "hour",

            60 *
            60 *
            1000
        ],

        [
            "minute",

            60 *
            1000
        ],

        [
            "second",

            1000
        ]
    ];

    let remaining =
        Math.max(
            0,
            ms
        );

    const parts =
        [];

    for (
        const [name, size]
        of units
    ) {

        const count =
            Math.floor(
                remaining /
                size
            );

        if (
            count > 0
        ) {

            parts.push(
                `${count} ${name}${
                    count === 1
                        ? ""
                        : "s"
                }`
            );

            remaining -=
                count *
                size;
        }

        if (
            parts.length >= 2
        ) {

            break;
        }
    }

    return (
        parts.length > 0
            ? parts.join(" ")
            : "0 seconds"
    );
}

function formatExpiry(
    expiresAt
) {

    if (
        !expiresAt
    ) {

        return "Permanent";
    }

    if (
        expiresAt <=
        Date.now()
    ) {

        return "**EXPIRED**";
    }

    const seconds =
        Math.floor(
            expiresAt /
            1000
        );

    return (
        `<t:${seconds}:R> ` +
        `(<t:${seconds}:f>)`
    );
}

// ========================================
// COMMAND CHOICES
// ========================================

const BANISHMENT_CHOICES = [

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

const BLACKLIST_CHOICES = [

    {
        name:
            "Complex Blacklist",

        value:
            "complex"
    },

    {
        name:
            "TOV Blacklist",

        value:
            "tov"
    },

    {
        name:
            "PSLH Blacklist",

        value:
            "pslh"
    },

    {
        name:
            "Forums Blacklist",

        value:
            "forums"
    },

    {
        name:
            "Full Blacklist",

        value:
            "full"
    }
];

// ========================================
// COMMAND OPTION BUILDERS
// ========================================

function addCommonApplyOptions(
    builder,
    typeChoices
) {

    return builder

        .addUserOption(
            option =>
                option

                    .setName(
                        "user"
                    )

                    .setDescription(
                        "User to apply the punishment to"
                    )

                    .setRequired(
                        true
                    )
        )

        .addStringOption(
            option =>
                option

                    .setName(
                        "type"
                    )

                    .setDescription(
                        "Punishment type"
                    )

                    .setRequired(
                        true
                    )

                    .addChoices(
                        ...typeChoices
                    )
        )

        .addStringOption(
            option =>
                option

                    .setName(
                        "reason"
                    )

                    .setDescription(
                        "Reason for the punishment"
                    )

                    .setRequired(
                        false
                    )
        )

        .addStringOption(
            option =>
                option

                    .setName(
                        "length"
                    )

                    .setDescription(
                        "Duration: 10m, 6h, 14d, 2w, 2 days. Blank = permanent"
                    )

                    .setRequired(
                        false
                    )
        )

        .addBooleanOption(
            option =>
                option

                    .setName(
                        "dm"
                    )

                    .setDescription(
                        "DM the user? Default: True"
                    )

                    .setRequired(
                        false
                    )
        );
}

function addCommonRemoveOptions(
    builder,
    typeChoices
) {

    return builder

        .addUserOption(
            option =>
                option

                    .setName(
                        "user"
                    )

                    .setDescription(
                        "User to remove the punishment from"
                    )

                    .setRequired(
                        true
                    )
        )

        .addStringOption(
            option =>
                option

                    .setName(
                        "type"
                    )

                    .setDescription(
                        "Punishment type"
                    )

                    .setRequired(
                        true
                    )

                    .addChoices(
                        ...typeChoices
                    )
        )

        .addStringOption(
            option =>
                option

                    .setName(
                        "reason"
                    )

                    .setDescription(
                        "Reason for removing the punishment"
                    )

                    .setRequired(
                        false
                    )
        )

        .addBooleanOption(
            option =>
                option

                    .setName(
                        "dm"
                    )

                    .setDescription(
                        "DM the user? Default: True"
                    )

                    .setRequired(
                        false
                    )
        );
}

// ========================================
// SLASH COMMANDS
// ========================================

const commands = [

    addCommonApplyOptions(

        new SlashCommandBuilder()

            .setName(
                "banishment"
            )

            .setDescription(
                "Apply an image/embed banishment"
            ),

        BANISHMENT_CHOICES
    )

        .toJSON(),

    addCommonRemoveOptions(

        new SlashCommandBuilder()

            .setName(
                "unbanishment"
            )

            .setDescription(
                "Remove an image/embed banishment"
            ),

        BANISHMENT_CHOICES
    )

        .toJSON(),

    addCommonApplyOptions(

        new SlashCommandBuilder()

            .setName(
                "blacklist"
            )

            .setDescription(
                "Apply a server blacklist role"
            ),

        BLACKLIST_CHOICES
    )

        .toJSON(),

    addCommonRemoveOptions(

        new SlashCommandBuilder()

            .setName(
                "unblacklist"
            )

            .setDescription(
                "Remove a server blacklist role"
            ),

        BLACKLIST_CHOICES
    )

        .toJSON()
];

// ========================================
// TYPE HELPERS
// ========================================

function getBanishmentKeys(
    type
) {

    if (
        type === "image"
    ) {

        return [
            "image_banishment"
        ];
    }

    if (
        type === "embed"
    ) {

        return [
            "embed_banishment"
        ];
    }

    if (
        type === "both"
    ) {

        return [
            "image_banishment",
            "embed_banishment"
        ];
    }

    return [];
}

function getBlacklistKeys(
    type
) {

    if (
        type === "complex"
    ) {

        return [
            "complex_blacklist"
        ];
    }

    if (
        type === "tov"
    ) {

        return [
            "tov_blacklist"
        ];
    }

    if (
        type === "pslh"
    ) {

        return [
            "pslh_blacklist"
        ];
    }

    if (
        type === "forums"
    ) {

        return [
            "forums_blacklist"
        ];
    }

    if (
        type === "full"
    ) {

        return [
            "complex_blacklist",
            "tov_blacklist",
            "pslh_blacklist",
            "forums_blacklist"
        ];
    }

    return [];
}

function getBanishmentName(
    type
) {

    if (
        type === "image"
    ) {
        return "Image";
    }

    if (
        type === "embed"
    ) {
        return "Embed";
    }

    if (
        type === "both"
    ) {
        return "Image + Embed";
    }

    return "Unknown";
}

function getBanishmentDescription(
    type
) {

    if (
        type === "image"
    ) {

        return "uploading images/files";
    }

    if (
        type === "embed"
    ) {

        return "sending embedded links";
    }

    if (
        type === "both"
    ) {

        return (
            "uploading images/files and " +
            "sending embedded links"
        );
    }

    return (
        "using restricted media features"
    );
}

function getBlacklistName(
    type
) {

    if (
        type === "complex"
    ) {
        return "Complex Blacklist";
    }

    if (
        type === "tov"
    ) {
        return "TOV Blacklist";
    }

    if (
        type === "pslh"
    ) {
        return "PSLH Blacklist";
    }

    if (
        type === "forums"
    ) {
        return "Forums Blacklist";
    }

    if (
        type === "full"
    ) {
        return "Full Blacklist";
    }

    return "Unknown Blacklist";
}

// ========================================
// ACCESS ROLE SYNC
// ========================================

const syncingMembers =
    new Set();

async function syncPermissions(
    member
) {

    if (
        TEST_MODE &&
        member.id !==
        TEST_USER_ID
    ) {

        return;
    }

    if (
        member.user.bot
    ) {

        return;
    }

    if (
        syncingMembers.has(
            member.id
        )
    ) {

        return;
    }

    syncingMembers.add(
        member.id
    );

    try {

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

        const hasImageBanishment =
            member.roles.cache.has(
                IMAGE_BANISHMENT_ROLE_ID
            );

        const hasEmbedBanishment =
            member.roles.cache.has(
                EMBED_BANISHMENT_ROLE_ID
            );

        const hasImagePerm =
            member.roles.cache.has(
                IMAGE_PERM_ROLE_ID
            );

        const hasEmbedPerm =
            member.roles.cache.has(
                EMBED_PERM_ROLE_ID
            );

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

        console.error(
            error
        );
    }

    finally {

        syncingMembers.delete(
            member.id
        );
    }
}

// ========================================
// ADMIN ROOM LOGGING
// ========================================

async function sendAdminLog({

    title,
    user,
    typeName,
    moderator,
    reason,
    dmStatus,
    expiresAt,
    showLength = true,
    roles = null,
    extra = null

}) {

    try {

        const channel =
            await client.channels.fetch(
                ADMIN_ROOM_ID
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {

            console.error(
                "[ADMIN LOG] Admin Room is not a text channel."
            );

            return;
        }

        const fields = [

            {
                name:
                    "User",

                value:
                    `<@${user.id}> ` +
                    `(\`${user.id}\`)`,

                inline:
                    false
            },

            {
                name:
                    "Type",

                value:
                    typeName,

                inline:
                    true
            },

            {
                name:
                    "Moderator",

                value:
                    moderator

                        ? (
                            `<@${moderator.id}> ` +
                            `(\`${moderator.id}\`)`
                        )

                        : "Automatic / External",

                inline:
                    true
            }
        ];

        if (
            Array.isArray(
                roles
            )
            &&
            roles.length >
            0
        ) {

            fields.push({

                name:
                    "Roles",

                value:
                    roles
                        .join(
                            "\n"
                        )
                        .slice(
                            0,
                            1024
                        ),

                inline:
                    false
            });
        }

        fields.push({

            name:
                "Reason",

            value:
                reason ||
                "No reason provided.",

            inline:
                false
        });

        if (
            showLength
        ) {

            fields.push({

                name:
                    "Length",

                value:
                    formatExpiry(
                        expiresAt
                    ),

                inline:
                    true
            });
        }

        fields.push({

            name:
                "DM",

            value:
                dmStatus ||
                "N/A",

            inline:
                true
        });

        if (
            extra
        ) {

            fields.push({

                name:
                    "Details",

                value:
                    extra,

                inline:
                    false
            });
        }

        const embed =
            new EmbedBuilder()

                .setTitle(
                    title
                )

                .addFields(
                    fields
                )

                .setTimestamp();

        await channel.send({

            embeds: [
                embed
            ],

            allowedMentions: {
                parse: []
            }
        });
    }

    catch (error) {

        console.error(
            "[ADMIN LOG ERROR]"
        );

        console.error(
            error
        );
    }
}

// ========================================
// DM HELPERS
// ========================================

async function sendBanishmentApplyDM(
    user,
    guildName,
    type,
    reason,
    expiresAt
) {

    const description =
        getBanishmentDescription(
            type
        );

    await user.send(

        `You have been blacklisted from **${description}** in **${guildName}**.\n\n` +

        `**Reason:** ${reason}\n` +

        `**Length:** ${formatExpiry(expiresAt)}`
    );
}

async function sendBanishmentRemoveDM(
    user,
    guildName,
    typeName,
    reason
) {

    await user.send(

        `Your **${typeName} Blacklist** has been removed in **${guildName}**.\n\n` +

        `**Reason:** ${reason}`
    );
}

async function sendBlacklistApplyDM(
    user,
    guildName,
    typeName,
    reason,
    expiresAt
) {

    await user.send(

        `You have been given **${typeName}** in **${guildName}**.\n\n` +

        `**Reason:** ${reason}\n` +

        `**Length:** ${formatExpiry(expiresAt)}\n\n` +

        `This restriction will remain in effect until it expires or is removed by the moderation team.`
    );
}

async function sendBlacklistRemoveDM(
    user,
    guildName,
    typeName,
    reason
) {

    await user.send(

        `Your **${typeName}** has been removed in **${guildName}**.\n\n` +

        `**Reason:** ${reason}`
    );
}

async function sendExpiryDM(
    user,
    guildName,
    punishment
) {

    const categoryName =

        punishment.category ===
        "banishment"

            ? "Banishment"

            : "Blacklist";

    await user.send(

        `Your **${punishment.label}** ${categoryName.toLowerCase()} in **${guildName}** has expired and was automatically removed.`
    );
}

async function sendGroupedExpiryDM(
    user,
    guildName,
    typeName,
    category
) {

    const normalizedName =
        typeName
            .toLowerCase();

    let suffix =
        "";

    if (
        category ===
        "banishment"
        &&
        !normalizedName.includes(
            "banishment"
        )
    ) {

        suffix =
            " banishment";
    }

    else if (
        category ===
        "blacklist"
        &&
        !normalizedName.includes(
            "blacklist"
        )
    ) {

        suffix =
            " blacklist";
    }

    await user.send(

        `Your **${typeName}**${suffix} in **${guildName}** ` +
        `has expired and was automatically removed.`
    );
}

// ========================================
// PUBLIC COMMAND RESPONSE
// ========================================

async function sendPublicResult(
    interaction,
    user,
    text,
    reason,
    expiresAt = null,
    showLength = true
) {

    let description =

        `✅ **${user.username}** (<@${user.id}>) ${text}\n` +

        `**Reason:** ${reason}`;

    let expiredDescription =

        `✅ **${user.username}** (<@${user.id}>) ${text}\n` +

        `**Reason:** ${reason}`;

    if (
        showLength
    ) {

        description +=

            `\n**Length:** ${formatExpiry(expiresAt)}`;

        expiredDescription +=

            `\n**Length:** **EXPIRED**`;
    }

    const embed =
        new EmbedBuilder()
            .setDescription(
                description
            );

    const channel =
        interaction.channel;

    if (
        !channel ||
        !channel.isTextBased() ||
        typeof channel.send !== "function"
    ) {

        throw new Error(
            "The command channel does not support normal bot messages."
        );
    }

    const message =
        await channel.send({

            content:
                `<@${user.id}>`,

            embeds: [
                embed
            ],

            allowedMentions: {

                users: [
                    user.id
                ]
            }
        });

    return {
        message,
        expiredDescription
    };
}

// ========================================
// ROLE CHANGE SUPPRESSION
// ========================================

const suppressedRoleChanges =
    new Map();

function suppressRoleChanges(
    userId,
    roleIds
) {

    const expires =
        Date.now() +
        10000;

    let roleMap =
        suppressedRoleChanges.get(
            userId
        );

    if (
        !roleMap
    ) {

        roleMap =
            new Map();

        suppressedRoleChanges.set(
            userId,
            roleMap
        );
    }

    for (
        const roleId
        of roleIds
    ) {

        roleMap.set(
            roleId,
            expires
        );
    }
}

function isRoleChangeSuppressed(
    userId,
    roleId
) {

    const roleMap =
        suppressedRoleChanges.get(
            userId
        );

    if (
        !roleMap
    ) {

        return false;
    }

    const now =
        Date.now();

    for (
        const [
            storedRoleId,
            expires
        ]
        of roleMap
    ) {

        if (
            expires <
            now
        ) {

            roleMap.delete(
                storedRoleId
            );
        }
    }

    if (
        roleMap.size ===
        0
    ) {

        suppressedRoleChanges.delete(
            userId
        );

        return false;
    }

    const suppressed =
        roleMap.has(
            roleId
        );

    // Consume suppression once the expected
    // GuildMemberUpdate actually arrives.
    if (
        suppressed
    ) {

        roleMap.delete(
            roleId
        );

        if (
            roleMap.size ===
            0
        ) {

            suppressedRoleChanges.delete(
                userId
            );
        }
    }

    return suppressed;
}

// ========================================
// PUNISHMENT ROLE UPDATE TRACKING
// ========================================

client.on(

    Events.GuildMemberUpdate,

    async (
        oldMember,
        newMember
    ) => {

        if (
            newMember.guild.id !==
            SERVER_ID
        ) {

            return;
        }

        if (
            TEST_MODE &&
            newMember.id !==
            TEST_USER_ID
        ) {

            return;
        }

        if (
            newMember.user.bot
        ) {

            return;
        }

        const externalChanges =
            [];

        for (
            const key
            of PUNISHMENT_KEYS
        ) {

            const punishment =
                PUNISHMENTS[
                    key
                ];

            const roleId =
                punishment.roleId;

            const hadRole =
                oldMember.roles.cache.has(
                    roleId
                );

            const hasRole =
                newMember.roles.cache.has(
                    roleId
                );

            if (
                hadRole ===
                hasRole
            ) {

                continue;
            }

            const suppressed =
                isRoleChangeSuppressed(
                    newMember.id,
                    roleId
                );

            if (
                suppressed
            ) {

                continue;
            }

            if (
                hasRole
            ) {

                if (
                    !getStoredPunishment(
                        newMember.id,
                        key
                    )
                ) {

                    setStoredPunishment(

                        newMember.id,
                        key,

                        {
                            expiresAt:
                                null,

                            reason:
                                "Role applied manually or by another integration.",

                            moderatorId:
                                null,

                            dm:
                                false,

                            source:
                                "role_change"
                        }
                    );
                }
            }

            else {

                deleteStoredPunishment(
                    newMember.id,
                    key
                );
            }

            externalChanges.push({

                key,
                punishment,
                hasRole
            });
        }

        // All punishment roles changed inside the same
        // GuildMemberUpdate are represented by one log.
        if (
            externalChanges.length >
            0
        ) {

            const added =
                externalChanges.filter(
                    change =>
                        change.hasRole
                );

            const removed =
                externalChanges.filter(
                    change =>
                        !change.hasRole
                );

            const categories =
                new Set(
                    externalChanges.map(
                        change =>
                            change
                                .punishment
                                .category
                    )
                );

            let title =
                "Punishment Roles Changed";

            if (
                removed.length ===
                0
            ) {

                title =
                    categories.size ===
                    1

                        ? (
                            `${
                                added[0]
                                    .punishment
                                    .category ===
                                "banishment"

                                    ? "Banishment"
                                    : "Blacklist"
                            } Applied`
                        )

                        : "Punishment Roles Applied";
            }

            else if (
                added.length ===
                0
            ) {

                title =
                    categories.size ===
                    1

                        ? (
                            `${
                                removed[0]
                                    .punishment
                                    .category ===
                                "banishment"

                                    ? "Banishment"
                                    : "Blacklist"
                            } Removed`
                        )

                        : "Punishment Roles Removed";
            }

            await sendAdminLog({

                title,

                user:
                    newMember.user,

                typeName:
                    externalChanges.length ===
                    1

                        ? externalChanges[0]
                            .punishment
                            .label

                        : "Multiple Punishment Roles",

                moderator:
                    null,

                reason:
                    "Role changed manually or by another integration; no command reason was available.",

                dmStatus:
                    "Not sent",

                expiresAt:
                    null,

                roles:
                    externalChanges.map(
                        change =>
                            `${
                                change.hasRole
                                    ? "➕"
                                    : "➖"
                            } ` +
                            `${change.punishment.label} ` +
                            `(<@&${change.punishment.roleId}>)`
                    ),

                extra:
                    "These changes were detected from the same member role update."
            });
        }

        // ========================================
        // ACCESS ROLE SYSTEM
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
            watchedRoles.some(

                roleId =>

                    oldMember
                        .roles
                        .cache
                        .has(
                            roleId
                        )

                    !==

                    newMember
                        .roles
                        .cache
                        .has(
                            roleId
                        )
            );

        if (
            !relevantRoleChanged
        ) {

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
            member.guild.id !==
            SERVER_ID
        ) {

            return;
        }

        if (
            TEST_MODE &&
            member.id !==
            TEST_USER_ID
        ) {

            return;
        }

        if (
            member.user.bot
        ) {

            return;
        }

        if (
            !member.partial &&
            member.roles?.cache
        ) {

            snapshotPunishmentRoles(
                member
            );
        }

        const stored =
            getUserPunishments(
                member.id,
                false
            );

        console.log(

            `[MEMBER LEFT] ` +

            `${member.user.tag} ` +

            `(${member.id}) | ` +

            `Stored punishments: ${
                stored

                    ? Object.keys(
                        stored.punishments
                    ).length

                    : 0
            }`
        );
    }
);

// ========================================
// MEMBER REJOINS SERVER
// ========================================

client.on(

    Events.GuildMemberAdd,

    async member => {

        if (
            member.guild.id !==
            SERVER_ID
        ) {

            return;
        }

        if (
            TEST_MODE &&
            member.id !==
            TEST_USER_ID
        ) {

            return;
        }

        if (
            member.user.bot
        ) {

            return;
        }

        const entry =
            getUserPunishments(
                member.id,
                false
            );

        if (
            !entry
        ) {

            console.log(

                `[MEMBER JOINED] ` +

                `${member.user.tag} ` +

                `(${member.id}) | ` +

                `No punishments to restore`
            );

            return;
        }

        try {

            const now =
                Date.now();

            const roleIdsToRestore =
                [];

            const expiredItems =
                [];

            for (
                const [key, record]
                of Object.entries(
                    entry.punishments
                )
            ) {

                const punishment =
                    PUNISHMENTS[
                        key
                    ];

                if (
                    !punishment
                ) {

                    continue;
                }

                if (
                    record.expiresAt &&
                    record.expiresAt <=
                    now
                ) {

                    expiredItems.push({
                        key,
                        record,
                        punishment
                    });

                    continue;
                }

                roleIdsToRestore.push(
                    punishment.roleId
                );
            }

            const expiredGroups =
                new Map();

            for (
                const item
                of expiredItems
            ) {

                const groupId =
                    getExpiryGroupId(
                        item.key,
                        item.record
                    );

                if (
                    !expiredGroups.has(
                        groupId
                    )
                ) {

                    expiredGroups.set(
                        groupId,
                        []
                    );
                }

                expiredGroups
                    .get(
                        groupId
                    )
                    .push(
                        item
                    );
            }

            for (
                const items
                of expiredGroups.values()
            ) {

                await markPublicMessageExpired(
                    items[0].record
                );

                deleteStoredPunishments(
                    member.id,
                    items.map(
                        item =>
                            item.key
                    )
                );
            }

            if (
                roleIdsToRestore.length >
                0
            ) {

                suppressRoleChanges(
                    member.id,
                    roleIdsToRestore
                );

                await member.roles.add(

                    roleIdsToRestore,

                    "Restored persistent punishment roles after rejoin"
                );

                console.log(

                    `[RESTORE] ` +

                    `${member.user.tag} ` +

                    `(${member.id}) | ` +

                    `${roleIdsToRestore.length} role(s)`
                );
            }

            const refreshedMember =
                await member.guild
                    .members
                    .fetch(
                        member.id
                    );

            await syncPermissions(
                refreshedMember
            );
        }

        catch (error) {

            console.error(
                `[RESTORE ERROR] ${member.user.tag} (${member.id})`
            );

            console.error(
                error
            );
        }
    }
);

// ========================================
// MESSAGE-BASED LAZY ACCESS SYNC
// ========================================

client.on(

    Events.MessageCreate,

    async message => {

        if (
            message.guildId !==
            SERVER_ID
        ) {

            return;
        }

        if (
            message.author.bot
        ) {

            return;
        }

        if (
            TEST_MODE &&
            message.author.id !==
            TEST_USER_ID
        ) {

            return;
        }

        if (
            !message.member
        ) {

            return;
        }

        snapshotPunishmentRoles(
            message.member
        );

        await syncPermissions(
            message.member
        );
    }
);

// ========================================
// ROLE EDITABILITY CHECK
// ========================================

function findUneditableRole(
    guild,
    roleIds
) {

    for (
        const roleId
        of roleIds
    ) {

        const role =
            guild.roles.cache.get(
                roleId
            );

        if (
            !role
        ) {

            return {
                roleId,
                reason:
                    "Role not found"
            };
        }

        if (
            !role.editable
        ) {

            return {
                roleId,
                reason:
                    "Bot role is not high enough"
            };
        }
    }

    return null;
}

// ========================================
// COMMAND HANDLER
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
            interaction.guildId !==
            SERVER_ID
        ) {

            return;
        }

        const commandName =
            interaction.commandName;

        if (
            ![
                "banishment",
                "unbanishment",
                "blacklist",
                "unblacklist"
            ].includes(
                commandName
            )
        ) {

            return;
        }

        // ========================================
        // MODERATOR PERMISSION
        // ========================================

        const hasManageRoles =
            interaction
                .memberPermissions
                ?.has(
                    PermissionFlagsBits.ManageRoles
                )
            ?? false;

        const isChatModerator =
            interaction
                .member
                ?.roles
                ?.cache
                ?.has(
                    CHAT_MODERATOR_ROLE_ID
                )
            ?? false;

        if (
            !hasManageRoles &&
            !isChatModerator
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

        const reason =
            interaction.options.getString(
                "reason"
            )
            ||
            "No reason provided.";

        const dm =
            interaction.options.getBoolean(
                "dm"
            )
            ??
            true;

        const isApply =

            commandName ===
            "banishment"

            ||

            commandName ===
            "blacklist";

        const isBanishment =

            commandName ===
            "banishment"

            ||

            commandName ===
            "unbanishment";

        // ========================================
        // LENGTH
        // ========================================

        let durationResult = {

            ms:
                null,

            permanent:
                true
        };

        if (
            isApply
        ) {

            const lengthInput =
                interaction
                    .options
                    .getString(
                        "length"
                    );

            durationResult =
                parseDuration(
                    lengthInput
                );

            if (
                !durationResult
            ) {

                await interaction.reply({

                    content:
                        "❌ Invalid length. Use formats like `10m`, `6h`, `14d`, `2w`, `2 days`, or leave it blank for permanent.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return;
            }
        }

        // ========================================
        // TEST MODE
        // ========================================

        if (
            TEST_MODE &&
            user.id !==
            TEST_USER_ID
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

        // ========================================
        // DON'T TARGET BOTS
        // ========================================

        if (
            user.bot
        ) {

            await interaction.reply({

                content:
                    "❌ This command cannot be used on bots.",

                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // ========================================
        // GET ROLE KEYS
        // ========================================

        const keys =

            isBanishment

                ? getBanishmentKeys(
                    type
                )

                : getBlacklistKeys(
                    type
                );

        if (
            keys.length === 0
        ) {

            await interaction.reply({

                content:
                    "❌ Invalid punishment type.",

                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        const typeName =

            isBanishment

                ? getBanishmentName(
                    type
                )

                : getBlacklistName(
                    type
                );

        const roleIds =
            keys.map(

                key =>
                    PUNISHMENTS[
                        key
                    ].roleId
            );

        const expiresAt =

            (
                isApply &&
                !durationResult.permanent
            )

                ? (
                    Date.now() +
                    durationResult.ms
                )

                : null;

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {

            const member =
                await interaction
                    .guild
                    .members
                    .fetch(
                        user.id
                    )
                    .catch(
                        () => null
                    );

            // ========================================
            // APPLY REQUIRES USER IN SERVER
            // ========================================

            if (
                isApply &&
                !member
            ) {

                await interaction.editReply({

                    content:
                        "❌ That user is not currently in the server.",

                    embeds:
                        []
                });

                return;
            }

            // ========================================
            // ROLE HIERARCHY CHECK
            // ========================================

            if (
                member
            ) {

                if (
                    !member.manageable
                ) {

                    await interaction.editReply({

                        content:
                            "❌ I cannot manage this user because their highest role is equal to or higher than my bot role.",

                        embeds:
                            []
                    });

                    return;
                }

                const badRole =
                    findUneditableRole(
                        interaction.guild,
                        roleIds
                    );

                if (
                    badRole
                ) {

                    await interaction.editReply({

                        content:

                            `❌ I cannot manage one of the required roles ` +

                            `(<@&${badRole.roleId}>). ` +

                            `${badRole.reason}.`,

                        embeds:
                            [],

                        allowedMentions: {
                            parse: []
                        }
                    });

                    return;
                }
            }

            const auditReason =

                `${commandName} by ` +

                `${interaction.user.tag}: ` +

                `${reason}`;

            // ========================================
            // APPLY PUNISHMENT
            // ========================================

            if (
                isApply
            ) {

                const missingRoleIds =
                    roleIds.filter(

                        roleId =>

                            !member
                                .roles
                                .cache
                                .has(
                                    roleId
                                )
                    );

                if (
                    missingRoleIds.length >
                    0
                ) {

                    suppressRoleChanges(
                        user.id,
                        missingRoleIds
                    );

                    await member.roles.add(

                        missingRoleIds,

                        auditReason
                    );
                }

                // Save/reset all selected punishment records
                // as one command batch.
                setStoredPunishments(

                    user.id,

                    keys,

                    {
                        expiresAt,

                        reason,

                        moderatorId:
                            interaction.user.id,

                        dm,

                        createdAt:
                            Date.now(),

                        source:
                            "command",

                        batchId:
                            interaction.id,

                        batchLabel:
                            typeName,

                        batchKeys:
                            keys
                    }
                );

                const refreshedMember =
                    await interaction
                        .guild
                        .members
                        .fetch(
                            user.id
                        );

                await syncPermissions(
                    refreshedMember
                );

                // ========================================
                // DM USER
                // ========================================

                let dmStatus =

                    dm

                        ? "Sent"

                        : "Disabled by moderator";

                if (
                    dm
                ) {

                    try {

                        if (
                            isBanishment
                        ) {

                            await sendBanishmentApplyDM(

                                user,

                                interaction
                                    .guild
                                    .name,

                                type,

                                reason,

                                expiresAt
                            );
                        }

                        else {

                            await sendBlacklistApplyDM(

                                user,

                                interaction
                                    .guild
                                    .name,

                                typeName,

                                reason,

                                expiresAt
                            );
                        }
                    }

                    catch {

                        dmStatus =
                            "Failed — user may have DMs disabled";
                    }
                }

                // ========================================
                // PUBLIC RESPONSE
                // ========================================

                const publicText =

                    isBanishment

                        ? (
                            `was given **${typeName} Banishment**.`
                        )

                        : (
                            `was given **${typeName}**.`
                        );

                const publicResult =
                    await sendPublicResult(

                        interaction,

                        user,

                        publicText,

                        reason,

                        expiresAt
                    );

                if (
                    expiresAt
                ) {

                    attachPublicMessageToPunishments(

                        user.id,

                        keys,

                        publicResult.message,

                        publicResult.expiredDescription
                    );
                }

                await interaction.deleteReply()
                    .catch(() => {});

                // ========================================
                // ADMIN ROOM
                // ========================================

                await sendAdminLog({

                    title:

                        isBanishment

                            ? "Banishment Applied"

                            : "Blacklist Applied",

                    user,

                    typeName,

                    moderator:
                        interaction.user,

                    reason,

                    dmStatus,

                    expiresAt,

                    roles:

                        keys.length >
                        1

                            ? keys.map(
                                key =>
                                    `• ${PUNISHMENTS[key].label} ` +
                                    `(<@&${PUNISHMENTS[key].roleId}>)`
                            )

                            : null,

                    extra:

                        missingRoleIds.length ===
                        0

                            ? (
                                "Role(s) were already present; punishment metadata/length was refreshed."
                            )

                            : null
                });

                console.log(

                    `[${
                        isBanishment

                            ? "BANISHMENT"

                            : "BLACKLIST"
                    }] ` +

                    `${user.tag} ` +

                    `(${user.id}) | ` +

                    `${typeName} | ` +

                    `${reason} | ` +

                    `By ${interaction.user.tag} | ` +

                    `DM: ${dmStatus}`
                );

                return;
            }

            // ========================================
            // REMOVE PUNISHMENT
            // ========================================

            let removedStored =
                false;

            let removedRole =
                false;

            removedStored =
                deleteStoredPunishments(
                    user.id,
                    keys
                );

            if (
                member
            ) {

                const existingRoleIds =
                    roleIds.filter(

                        roleId =>

                            member
                                .roles
                                .cache
                                .has(
                                    roleId
                                )
                    );

                if (
                    existingRoleIds.length >
                    0
                ) {

                    suppressRoleChanges(
                        user.id,
                        existingRoleIds
                    );

                    await member.roles.remove(

                        existingRoleIds,

                        auditReason
                    );

                    removedRole =
                        true;
                }

                const refreshedMember =
                    await interaction
                        .guild
                        .members
                        .fetch(
                            user.id
                        );

                await syncPermissions(
                    refreshedMember
                );
            }

            if (
                !removedStored &&
                !removedRole
            ) {

                await interaction.editReply({

                    content:

                        `⚠️ <@${user.id}> does not currently have the selected ` +

                        `${
                            isBanishment

                                ? "banishment"

                                : "blacklist"
                        }.`,

                    embeds:
                        [],

                    allowedMentions: {

                        users: [
                            user.id
                        ]
                    }
                });

                return;
            }

            // ========================================
            // DM USER
            // ========================================

            let dmStatus =

                dm

                    ? "Sent"

                    : "Disabled by moderator";

            if (
                dm
            ) {

                try {

                    if (
                        isBanishment
                    ) {

                        await sendBanishmentRemoveDM(

                            user,

                            interaction
                                .guild
                                .name,

                            typeName,

                            reason
                        );
                    }

                    else {

                        await sendBlacklistRemoveDM(

                            user,

                            interaction
                                .guild
                                .name,

                            typeName,

                            reason
                        );
                    }
                }

                catch {

                    dmStatus =
                        "Failed — user may have DMs disabled";
                }
            }

            // ========================================
            // PUBLIC RESPONSE
            // ========================================

            const publicText =

                isBanishment

                    ? (
                        `had their **${typeName} Banishment** removed.`
                    )

                    : (
                        `had their **${typeName}** removed.`
                    );

            await sendPublicResult(

                interaction,

                user,

                publicText,

                reason,

                null,

                false
            );

            // ========================================
            // ADMIN ROOM
            // ========================================

            await sendAdminLog({

                title:

                    isBanishment

                        ? "Banishment Removed"

                        : "Blacklist Removed",

                user,

                typeName,

                moderator:
                    interaction.user,

                reason,

                dmStatus,

                expiresAt:
                    null,

                showLength:
                    false,

                roles:

                    keys.length >
                    1

                        ? keys.map(
                            key =>
                                `• ${PUNISHMENTS[key].label} ` +
                                `(<@&${PUNISHMENTS[key].roleId}>)`
                        )

                        : null,

                extra:

                    member

                        ? null

                        : (
                            "User was not in the server; stored persistent punishment was cleared."
                        )
            });

            console.log(

                `[${
                    isBanishment

                        ? "UNBANISHMENT"

                        : "UNBLACKLIST"
                }] ` +

                `${user.tag} ` +

                `(${user.id}) | ` +

                `${typeName} | ` +

                `${reason} | ` +

                `By ${interaction.user.tag} | ` +

                `DM: ${dmStatus}`
            );
        }

        catch (error) {

            console.error(
                `[COMMAND ERROR] /${commandName}`
            );

            console.error(
                error
            );

            try {

                await interaction.editReply({

                    content:
                        "❌ Something went wrong while changing that member's punishment.",

                    embeds:
                        []
                });
            }

            catch {

                // Nothing else to do.
            }
        }
    }
);

// ========================================
// EXPIRY GROUP HELPERS
// ========================================

function getExpiryGroupId(
    key,
    record
) {

    if (
        record?.batchId
    ) {

        return (
            `batch:${record.batchId}`
        );
    }

    // Backward compatibility for timed multi-role
    // punishments made before batchId existed.
    if (
        record?.publicMessageId
    ) {

        return (
            `message:${record.publicMessageId}`
        );
    }

    return (
        `single:${key}`
    );
}

function getGroupedPunishmentLabel(
    items
) {

    const explicitLabel =
        items
            .map(
                item =>
                    item.record
                        ?.batchLabel
            )
            .find(
                Boolean
            );

    if (
        explicitLabel
    ) {

        return explicitLabel;
    }

    const keys =
        items.map(
            item =>
                item.key
        );

    const keySet =
        new Set(
            keys
        );

    const fullBlacklistKeys = [
        "complex_blacklist",
        "tov_blacklist",
        "pslh_blacklist",
        "forums_blacklist"
    ];

    if (
        keys.length ===
        fullBlacklistKeys.length
        &&
        fullBlacklistKeys.every(
            key =>
                keySet.has(
                    key
                )
        )
    ) {

        return "Full Blacklist";
    }

    if (
        keys.length ===
        2
        &&
        keySet.has(
            "image_banishment"
        )
        &&
        keySet.has(
            "embed_banishment"
        )
    ) {

        return "Image + Embed";
    }

    if (
        items.length ===
        1
    ) {

        return (
            items[0]
                .punishment
                .label
        );
    }

    return items
        .map(
            item =>
                item
                    .punishment
                    .label
        )
        .join(
            " + "
        );
}

function getGroupedPunishmentCategory(
    items
) {

    const categories =
        new Set(
            items.map(
                item =>
                    item
                        .punishment
                        .category
            )
        );

    if (
        categories.size ===
        1
    ) {

        return (
            items[0]
                .punishment
                .category
        );
    }

    return "punishment";
}

// ========================================
// EXPIRATION PROCESSOR
// ========================================

let expirationSweepRunning =
    false;

async function processExpiredPunishments() {

    if (
        expirationSweepRunning
    ) {

        return;
    }

    expirationSweepRunning =
        true;

    try {

        const guild =
            client.guilds.cache.get(
                SERVER_ID
            );

        if (
            !guild
        ) {

            return;
        }

        const now =
            Date.now();

        for (
            const [userId, entry]
            of Object.entries(
                punishmentStore.users
            )
        ) {

            if (
                !entry?.punishments
            ) {

                continue;
            }

            const expiredItems =
                Object.entries(
                    entry.punishments
                )

                    .filter(
                        (
                            [key, record]
                        ) =>
                            PUNISHMENTS[key]
                            &&
                            record.expiresAt
                            &&
                            record.expiresAt <=
                            now
                    )

                    .map(
                        (
                            [key, record]
                        ) => ({

                            key,
                            record,
                            punishment:
                                PUNISHMENTS[
                                    key
                                ]
                        })
                    );

            if (
                expiredItems.length ===
                0
            ) {

                continue;
            }

            const member =
                await guild
                    .members
                    .fetch(
                        userId
                    )
                    .catch(
                        () => null
                    );

            let user =
                member?.user ??
                null;

            if (
                !user
            ) {

                user =
                    await client
                        .users
                        .fetch(
                            userId
                        )
                        .catch(
                            () => null
                        );
            }

            const groups =
                new Map();

            for (
                const item
                of expiredItems
            ) {

                const groupId =
                    getExpiryGroupId(
                        item.key,
                        item.record
                    );

                if (
                    !groups.has(
                        groupId
                    )
                ) {

                    groups.set(
                        groupId,
                        []
                    );
                }

                groups
                    .get(
                        groupId
                    )
                    .push(
                        item
                    );
            }

            for (
                const items
                of groups.values()
            ) {

                const keys =
                    items.map(
                        item =>
                            item.key
                    );

                const batchLabel =
                    getGroupedPunishmentLabel(
                        items
                    );

                const category =
                    getGroupedPunishmentCategory(
                        items
                    );

                const roleIdsToRemove =
                    member

                        ? items
                            .map(
                                item =>
                                    item
                                        .punishment
                                        .roleId
                            )
                            .filter(
                                roleId =>
                                    member
                                        .roles
                                        .cache
                                        .has(
                                            roleId
                                        )
                            )

                        : [];

                // ========================================
                // REMOVE ALL EXPIRED ROLES AT ONCE
                // ========================================

                if (
                    roleIdsToRemove.length >
                    0
                ) {

                    try {

                        suppressRoleChanges(
                            userId,
                            roleIdsToRemove
                        );

                        await member.roles.remove(

                            roleIdsToRemove,

                            `${batchLabel} expired automatically`
                        );
                    }

                    catch (error) {

                        console.error(

                            `[EXPIRY ROLE ERROR] ` +
                            `${userId} | ` +
                            `${batchLabel}`
                        );

                        console.error(
                            error
                        );

                        // Keep persistence so next sweep retries.
                        continue;
                    }
                }

                // ========================================
                // CHANGE ORIGINAL MESSAGE ONCE
                // ========================================

                const representativeRecord =
                    items[0]
                        .record;

                await markPublicMessageExpired(
                    representativeRecord
                );

                // ========================================
                // REMOVE WHOLE BATCH FROM STORAGE
                // ========================================

                deleteStoredPunishments(
                    userId,
                    keys
                );

                // ========================================
                // RESTORE ACCESS ONCE IF NEEDED
                // ========================================

                if (
                    category ===
                    "banishment"
                    &&
                    member
                ) {

                    const refreshedMember =
                        await guild
                            .members
                            .fetch(
                                userId
                            );

                    await syncPermissions(
                        refreshedMember
                    );
                }

                // ========================================
                // ONE EXPIRATION DM PER BATCH
                // ========================================

                let dmStatus =

                    representativeRecord.dm

                        ? "Sent"

                        : "Disabled by moderator";

                if (
                    representativeRecord.dm &&
                    user
                ) {

                    try {

                        await sendGroupedExpiryDM(

                            user,
                            guild.name,
                            batchLabel,
                            category
                        );
                    }

                    catch {

                        dmStatus =
                            "Failed — user may have DMs disabled";
                    }
                }

                // ========================================
                // ONE ADMIN LOG PER BATCH
                // ========================================

                if (
                    user
                ) {

                    await sendAdminLog({

                        title:

                            category ===
                            "banishment"

                                ? "Banishment Expired"

                                : (
                                    category ===
                                    "blacklist"

                                        ? "Blacklist Expired"

                                        : "Punishment Expired"
                                ),

                        user,

                        typeName:
                            batchLabel,

                        moderator:
                            null,

                        reason:

                            representativeRecord.reason ||
                            "Timed punishment expired.",

                        dmStatus,

                        expiresAt:
                            representativeRecord.expiresAt,

                        roles:

                            items.length >
                            1

                                ? items.map(
                                    item =>
                                        `• ${item.punishment.label} ` +
                                        `(<@&${item.punishment.roleId}>)`
                                )

                                : null,

                        extra:
                            "Automatically removed because the configured length expired."
                    });
                }

                console.log(

                    `[EXPIRED] ` +
                    `${userId} | ` +
                    `${batchLabel} | ` +
                    `${items.length} punishment record(s)`
                );
            }
        }
    }

    finally {

        expirationSweepRunning =
            false;
    }
}

// ========================================
// EXPIRATION TIMER
// ========================================

setInterval(

    () => {

        processExpiredPunishments()

            .catch(
                error => {

                    console.error(
                        "[EXPIRY SWEEP ERROR]"
                    );

                    console.error(
                        error
                    );
                }
            );
    },

    30 *
    1000
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

        console.log(
            ""
        );

        console.log(
            "========================================"
        );

        console.log(
            `Logged in as ${client.user.tag}`
        );

        if (
            !guild
        ) {

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
                version:
                    "10"
            })

                .setToken(
                    process.env.BOT_TOKEN
                );

        try {

            await rest.put(

                Routes.applicationGuildCommands(

                    client.user.id,

                    SERVER_ID
                ),

                {
                    body:
                        commands
                }
            );

            console.log(
                "✓ /banishment registered"
            );

            console.log(
                "✓ /unbanishment registered"
            );

            console.log(
                "✓ /blacklist registered"
            );

            console.log(
                "✓ /unblacklist registered"
            );

            console.log(
                `✓ Chat Moderator commands enabled for role ${CHAT_MODERATOR_ROLE_ID}`
            );
        }

        catch (error) {

            console.error(
                "❌ Failed to register slash commands:"
            );

            console.error(
                error
            );
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

        console.log(
            `Data file: ${PUNISHMENT_FILE}`
        );

        console.log(
            ""
        );

        console.log(
            "ROLE MANAGER IS LIVE"
        );

        console.log(
            ""
        );

        if (
            TEST_MODE
        ) {

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

        console.log(
            ""
        );

        console.log(
            "✓ Live access-role synchronization"
        );

        console.log(
            "✓ Message-based lazy synchronization"
        );

        console.log(
            "✓ Persistent banishments"
        );

        console.log(
            "✓ Persistent blacklist roles"
        );

        console.log(
            "✓ Timed punishments + automatic expiry"
        );

        console.log(
            "✓ Public punishment messages change to EXPIRED"
        );

        console.log(
            "✓ Admin Room moderation logs"
        );

        console.log(
            "✓ Multi-role punishment batching"
        );

        console.log(
            "✓ Grouped Full Blacklist / IMG_IMBED expiry"
        );

        console.log(
            "✓ Grouped manual punishment-role logs"
        );

        console.log(
            "✓ Optional user DMs"
        );

        console.log(
            "✓ Public responses ping the target user"
        );

        console.log(
            "✓ Username + mention shown inside public embeds"
        );

        console.log(
            "✓ NO startup member sweep"
        );

        console.log(
            "✓ NO Message Content intent"
        );

        console.log(

            `✓ Stored users: ${
                Object.keys(
                    punishmentStore.users
                ).length
            }`
        );

        console.log(
            "========================================"
        );

        console.log(
            ""
        );

        // Immediately process anything that expired
        // while the bot was offline or redeploying.

        await processExpiredPunishments();
    }
);

// ========================================
// LOGIN
// ========================================

client.login(
    process.env.BOT_TOKEN
);