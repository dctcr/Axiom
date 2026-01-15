const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { parseCommaList } = require("../../utils");

// In-memory poll storage (key = messageId)
// { question, options: [string], votes: Map<userId, optionIndex> }
const POLLS = new Map();
const OPT_LABELS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function buildPollContainer(question, options, counts) {
  const lines = options.map((opt, i) => {
    const c = counts[i] ?? 0;
    return `${OPT_LABELS[i]} **${opt}** — ${c}`;
  });

  return new ContainerBuilder()
    .addTextDisplayComponents((t) => t.setContent(`## ${question}`))
    .addSeparatorComponents((s) => s)
    .addTextDisplayComponents((t) => t.setContent(lines.join("\n")));
}

function buildPollButtons(messageId, options) {
  const rows = [];
  let row = new ActionRowBuilder();

  for (let i = 0; i < options.length; i++) {
    if (i > 0 && i % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll:${messageId}:${i}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(`${i + 1}`)
    );
  }

  rows.push(row);
  return rows;
}

function computeCounts(optionsLen, votesMap) {
  const counts = Array(optionsLen).fill(0);
  for (const idx of votesMap.values()) {
    if (Number.isInteger(idx) && idx >= 0 && idx < optionsLen) counts[idx]++;
  }
  return counts;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll!")
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Poll question")
        .setMinLength(3)
        .setMaxLength(120)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("options")
        .setDescription("Comma-separated options (e.g., Yes, No, Maybe)")
        .setMaxLength(200)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(0x0000000000002000),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a guild!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const question = interaction.options.getString("title", true);
    const rawOptions = interaction.options.getString("options");

    const options = rawOptions
      ? (() => {
          const parsed = parseCommaList(rawOptions, { min: 2, max: 10 });
          return parsed.ok ? parsed.values : null;
        })()
      : ["Yes", "No"];

    if (!options) {
      return interaction.reply({
        content:
          "Options must be comma-separated (2-10)! Example: `Yes, No, Maybe`",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Create placeholder -> Get message id for custom ids
    const votes = new Map();
    const counts = computeCounts(options.length, votes);

    // Send temporary id marker -> Edit once message id
    const tempContainer = buildPollContainer(question, options, counts);

    const msg = await interaction.reply({
      components: [tempContainer],
      flags: MessageFlags.IsComponentsV2,
      withResponse: true,
    });

    const message = msg.resource.message;
    POLLS.set(message.id, { question, options, votes });

    // Update with buttons that include message id
    const container = buildPollContainer(question, options, counts);
    const buttonRows = buildPollButtons(message.id, options);

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      componentsV2: undefined,
      components: [container, ...buttonRows],
    });
  },

  // Export store for interaction handler
  POLLS,
  buildPollContainer,
  buildPollButtons,
  computeCounts,
};