const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { formatDate } = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Gather information on this server!"),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    const guild = interaction.guild;
    const isAnimated = guild.icon?.startsWith("a_");
    const icon = guild.iconURL({
      size: 4096,
      extension: isAnimated ? "gif" : "png",
      forceStatic: false,
    });

    const name = guild.name;
    const ID = guild.id;
    const owner = (await guild.members.fetch(guild.ownerId)).toString();

    const members = guild.memberCount;
    const boosters =
      (await guild.members.fetch()).filter((m) => m.premiumSince !== null)
        .size || "None";
    const created = formatDate(guild.createdAt);

    const info = new EmbedBuilder()
      .setTitle("Server Info")
      .setThumbnail(icon)
      .setColor("#131416")
      .addFields(
        { name: `Name`, value: name, inline: true },
        { name: `ID`, value: ID, inline: true },
        { name: `Owner`, value: owner, inline: true },

        { name: `Members`, value: `${members}`, inline: true },
        { name: `Boosters`, value: `${boosters}`, inline: true },
        { name: `Created On`, value: created, inline: true }
      );

    return interaction.reply({ embeds: [info] });
  },
};
