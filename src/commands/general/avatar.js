const { SlashCommandBuilder, MessageFlags, ContainerBuilder, AttachmentBuilder, flatten } = require("discord.js");
const { resolveMember } =  require("../../utils/utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Get the avatar of a member!")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Member to look up")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("search")
        .setDescription("Name/ID/Mention to search")
        .setRequired(false)
    ),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {

    // Guild Check
    if (!interaction.inGuild()) return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral
    });

    // Collect Options
    const optMember = interaction.options.getMember("target");
    const optUser = interaction.options.getUser("target");
    const query = interaction.options.getString("search");

    if (optUser && query) return interaction.reply({
        content: `Use either target OR search, not both!`,
        flags: MessageFlags.Ephemeral
    });

    // Set Member
    /** @type {import("discord.js").GuildMember | null} */
    let member;

    if (optMember) member = optMember;
    else if (optUser) member = await interaction.guild.members.fetch(optUser.id).catch(() => null);
    else if (query) member = await resolveMember(interaction.guild, query);
    else member = interaction.member;

    if (!member) return interaction.reply({
        content: `I could not find that member!`,
        flags: MessageFlags.Ephemeral
    });

    const displayName = member.displayName;
    const isAnimated = member.user.avatar?.startsWith("a_");
    const avatarURL = member.displayAvatarURL({
        size: 4096,
        extension: isAnimated ? "gif" : "png",
        forceStatic: false
    });

    const onAvatar = new ContainerBuilder()
      .addTextDisplayComponents((text) => text.setContent(`## ${displayName}'s Avatar`))
      .addSeparatorComponents((s) => s)
      .addMediaGalleryComponents((gallery) =>
        gallery.addItems((item) =>
          item
            .setURL(avatarURL)
            .setDescription(`Avatar of ${displayName}`)
        )
      );

    return interaction.reply({
        components: [onAvatar],
        flags: MessageFlags.IsComponentsV2
    });
  }
};
