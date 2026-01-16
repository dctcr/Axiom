const {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { resolveRole, formatDate, cleanPerms } = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Gather information on a role!")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("Role to gather information on")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("search")
        .setDescription("Role to gather information on")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Guild Check
    if (!interaction.inGuild())
      return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
      });

    // Gather Options
    const optRole = interaction.options.getRole("role");
    const query = interaction.options.getString("search");

    if (optRole && query)
      return interaction.reply({
        content: `Use either role OR search, not both!`,
        flags: MessageFlags.Ephemeral,
      });

    if (!optRole && !query)
      return interaction.reply({
        content: `Use either role OR search to target role!`,
        flags: MessageFlags.Ephemeral,
      });

    // Set Role
    /** @type {import("discord.js").Role | null} */
    let role = null;

    if (optRole) role = optRole;
    else role = await resolveRole(interaction.guild, query);

    if (!role)
      return interaction.reply({
        content: `I could not find that role!`,
        flags: MessageFlags.Ephemeral,
      });

    // Assemble Information
    const name = role.name;
    const ID = role.id;
    const members = `${role.members.size}`;

    const created = formatDate(role.createdAt);
    const color = role.hexColor;
    const position = `${role.position}`;

    const hoisted = role.hoist ? "Yes" : "No";
    const mentionable = role.mentionable ? "Yes" : "No";
    const editable = role.editable ? "Yes" : "No";

    const permissions = cleanPerms(role.permissions);

    // Create Embed
    const roleinfo = new EmbedBuilder()
      .setColor(color)
      .setTitle("Role Info")
      .addFields(
        { name: `Name`, value: name, inline: true },
        { name: `Members`, value: members, inline: true },
        { name: `ID`, value: ID, inline: true },

        { name: `Position`, value: position, inline: true },
        { name: `Color`, value: color.toUpperCase(), inline: true },
        { name: `Created At`, value: created, inline: true },

        { name: `Hoisted`, value: hoisted, inline: true },
        { name: `Mentionable`, value: mentionable, inline: true },
        { name: `Editable`, value: editable, inline: true },

        { name: `Role`, value: role.toString(), inline: false },
        { name: `Permissions`, value: permissions, inline: false }
      );

    return interaction.reply({ embeds: [roleinfo] });
  },
};
