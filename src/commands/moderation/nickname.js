const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { resolveMember } = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Set yours/or a members nickname!")
    .addStringOption((option) =>
      option
        .setName("nickname")
        .setDescription("Set the new nickname")
        .setRequired(true)
        .setMaxLength(32)
    )
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Member whose nickname to set (Defaults to you)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(0x0000000008000000),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Guild Check
    if (!interaction.inGuild())
      return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
      });

    // Collect Options & Allow Nick Reset
    const nick = interaction.options.getString("nickname");
    const nextNick = /^reset$/i.test(nick) ? null : nick;

    // Set Member
    /** @type {import("discord.js").GuildMember} */
    const targetMember =
      interaction.options.getMember("target") ?? interaction.member;

    // Check Hierarchy
    const changingOther = targetMember.id !== interaction.member.id;

    if (!targetMember.manageable)
      return interaction.reply({
        content: `I cannot change this members nickname!`,
        flags: MessageFlags.Ephemeral,
      });

    if (changingOther) {
      if (
        targetMember.roles.highest.comparePositionTo(
          interaction.member.roles.highest
        ) >= 0
      )
        return interaction.reply({
          content: "You cannot change this members nickname!",
          flags: MessageFlags.Ephemeral,
        });
    }

    // Change Nickname
    await targetMember
      .setNickname(nextNick, `Changed by ${interaction.user.tag}`)
      .catch(() => null);
    return interaction.reply({
      content: nextNick
        ? `Updated nickname for ${targetMember} to ${nextNick}.`
        : `Reset nickname for ${targetMember}.`
    });
  },
};
