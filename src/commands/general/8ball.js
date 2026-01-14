const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Ask the Magic 8ball!")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Enter your question here")
        .setMinLength(2)
        .setRequired(true)
    ),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Check Guild
    if (!interaction.inGuild())
      return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
      });

    // Gather String Option (do nothing...)
    const query = interaction.options.getString("text");

    const options = {
      affirmative: [
        "It is certain",
        "It is decidedly so",
        "Without a doubt",
        "Yes, definitely",
        "You may rely on it",
        "Most likely",
        "Outlook good",
        "Yes",
        "Signs point to yes",
      ],

      uncertain: [
        "Reply hazy, try again",
        "Ask again later",
        "Try asking again",
        "Cannot predict now",
        "Concentrate and ask again",
      ],

      negative: [
        "Don't count on it",
        "My sources say no",
        "Outlook not so good",
        "Doubtful",
        "No",
        "Definitely Not",
        "Hell nah"
      ],
    };

    const categories = Object.keys(options);
    const category = categories[Math.floor(Math.random() * categories.length)];
    const response =
      options[category][Math.floor(Math.random() * options[category].length)];

    return interaction.reply({ content: response });
  },
};
