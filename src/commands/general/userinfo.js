const {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
} = require("discord.js");
const {
  resolveMember,
  formatDate,
  cleanPerms,
  getJoinPosition,
} = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Gather information on a member!")
    .addUserOption((o) =>
      o.setName("target").setDescription("User to look up").setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription("Name/ID/Mention to search")
        .setRequired(false)
    ),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {

    // Guild Check
    if (!interaction.inGuild()) return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
    });

    // Collect Options
    const optMember = interaction.options.getMember("target");
    const optUser = interaction.options.getUser("target");
    const query = interaction.options.getString("query");

    if (optUser && query) {
      return interaction.reply({
        content: `Use either target OR query, not both!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Set Member
    /** @type {import("discord.js").GuildMember | null} */
    let member = null;

    if (optMember) member = optMember;
    else if (optUser)member = await interaction.guild.members.fetch(optUser.id).catch(() => null);
    else if (query) member = await resolveMember(interaction.guild, query);
    else member = interaction.member;

    if (!member) return interaction.reply({
      content: `Couldn't find that member!`,
      flags: MessageFlags.Ephemeral,
    });

    // Assemble Information
    const statuses = {
      online: "Online",
      idle: "Idle",
      dnd: "Do Not Disturb",
      offline: "Offline",
    };

    const platforms = {
      desktop: "Desktop Client",
      mobile: "Mobile Client",
      web: "Web Client",
    };

    const activityTypes = {
      5: "Competing in",
      4: "",
      3: "Watching",
      2: "Listening to",
      1: "Streaming",
      0: "Playing",
    };

    const avatar = member.displayAvatarURL({ size: 512, forceStatic: false });
    const onMention = member.toString();
    const onId = member.id;
    const onUsername = member.user.username;

    const onCreated = formatDate(member.user.createdAt);
    const onJoined = member.joinedAt ? formatDate(member.joinedAt) : "Unknown";
    const onBoosting = member.premiumSince
      ? formatDate(member.premiumSince)
      : "Not Boosting";

    const statusKey = statuses[member.presence?.status ?? "offline"];
    const onStatus = statuses[statusKey] ?? "Offline";

    const cs = member.presence?.clientStatus;
    const onPlatform = cs
      ? Object.keys(cs)
          .map((k) => platforms[k] ?? k)
          .join(", ")
      : "None";

    const presence =
      member.presence ??
      interaction.guild.presences?.cache?.get(member.id) ??
      null;
    const activity0 = presence?.activities?.[0] ?? null;
    const onActivity = activity0
      ? activity0.type === 4
        ? activity0.state ?? "Custom Status"
        : `${activityTypes[activity0.type] ?? ""} ${activity0.name}`.trim()
      : "None";

    const onNickname = member.nickname ? member.displayName : "None";
    const onPosition = await getJoinPosition(interaction.guild, member).catch(() => null);
    const positionText = onPosition ? `#${onPosition}` : "N/A";
    const onHighest = member.roles.highest.toString();

    const roles =
      member.roles.cache
        .filter((r) => r.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.toString())
        .join(" ") || "None";
    const roleCount = Math.max(0, member.roles.cache.size - 1);
    const onPermissions = cleanPerms(member.permissions, member);

    // Create Embed
    const onEmbed = new EmbedBuilder()
      .setThumbnail(avatar)
      .setColor(member.displayHexColor)
      .setAuthor({ name: member.displayName, iconURL: avatar })
      .addFields(
        { name: "Mention", value: onMention, inline: true },
        { name: "Username", value: onUsername, inline: true },
        { name: "ID", value: onId, inline: true },

        { name: "Boosting Since", value: onBoosting, inline: true },
        { name: "Created At", value: onCreated, inline: true },
        { name: "Joined At", value: onJoined, inline: true },

        { name: "Status", value: onStatus, inline: true },
        { name: "Platform", value: onPlatform, inline: true },
        { name: "Activity", value: onActivity, inline: true },

        { name: "Nickname", value: onNickname, inline: true },
        { name: "Join Position", value: positionText, inline: true },
        { name: "Highest Role", value: onHighest, inline: true },

        { name: `Roles [${roleCount}]`, value: roles, inline: false },
        { name: "Permissions", value: onPermissions, inline: false }
      );

    return interaction.reply({ embeds: [onEmbed] });
  },
};
