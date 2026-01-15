const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const { resolveMember } = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Set yours/or a members nickname!")
    .addSubcommand((sub) =>
      sub
        .setName("me")
        .setDescription("Set your nickname")
        .addStringOption((option) =>
          option
            .setName("nickname")
            .setDescription("Sets your nickname (or 'reset')")
            .setRequired(true)
            .setMaxLength(32)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("member")
        .setDescription("Set a member's nickname")
        .addUserOption((option) =>
          option
            .setName("member")
            .setDescription("Member whose nickname to set")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("nickname")
            .setDescription("New nickname (or 'reset')")
            .setRequired(true)
            .setMaxLength(32)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("search")
        .setDescription("Search for member whose nickname to set")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Name/ID/Mention to search")
            .setRequired(true)
            .setMaxLength(32)
        )
        .addStringOption((option) =>
          option
            .setName("nickname")
            .setDescription("New nickname (or 'reset')")
            .setRequired(true)
            .setMaxLength(32)
        )
    )
    .setDefaultMemberPermissions(0x0000000004000000),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Guild Check
    if (!interaction.inGuild())
      return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
      });

    const sub = interaction.options.getSubcommand(true);

    const nick = interaction.options.getString("nickname", true);
    const nextNick = /^reset$/i.test(nick) ? null : nick;

    /** @type {import("discord.js").GuildMember | null} */
    let targetMember = null;

    if (sub === "me") targetMember = interaction.member;
    if (sub === "member")
      targetMember = interaction.options.getMember("member");
    if (sub === "search") {
      const query = interaction.options.getString("query");
      targetMember = await resolveMember(interaction.guild, query);
    }

    if (!targetMember)
      return interaction.reply({
        content: `I couldn't find that member!`,
        flags: MessageFlags.Ephemeral,
      });

    const changingOther = targetMember.id !== interaction.member.id;

    // Permissions/Hierarchy Check
    if (
      changingOther &&
      !interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)
    ) {
      return interaction.reply({
        content: `You do not have sufficient permissions to use this command!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.guild.ownerId === targetMember.id && changingOther) {
      return interaction.reply({
        content: `The server owner's nickname cannot be changed!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!targetMember.manageable) {
      return interaction.reply({
        content: `I cannot change this members nickname!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (changingOther) {
      const cmp = targetMember.roles.highest.comparePositionTo(
        interaction.member.roles.highest
      );

      if (cmp >= 0)
        return interaction.reply({
          content: `You can't change that members nickname!`,
          flags: MessageFlags.Ephemeral,
        });
    }

    // Change Nickname
    await targetMember
      .setNickname(nextNick, `Changed by ${interaction.user.tag}`)
      .catch((e) => {
        throw e;
      });

    return interaction.reply({
      content: nextNick
        ? `Updated nickname for ${targetMember.user.username} to **${nextNick}**`
        : `Reset nickname for ${targetMember.user.username}`,
    });
  },
};
