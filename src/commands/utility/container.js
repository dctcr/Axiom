const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { parseRgb, parseHex } = require("../../utils/utils");

/**
 * @param {string} raw
 * @returns {string[]}
 */
function splitSections(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return [];

  // Prefer explicit delimiter if user includes it
  if (s.includes("||")) {
    return s
      .split("||")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // Otherwise allow markdown HR line as delimiter: "\n---\n"
  const parts = s
    .split(/\n\s*---\s*\n/g)
    .map((x) => x.trim())
    .filter(Boolean);

  return parts.length ? parts : [s];
}

/**
 * Turns typed escapes into real characters
 * - "\n" -> newline
 * - "\t" -> tab
 * Allows literal "\n" & "\t" -> "\\n" & "\\t"
 * @param {string} s
 */
function decodeEscapes(s) {
  const raw = String(s ?? "");

  // Preserve literal \\n \\t
  const NL = "\u0000NL\u0000";
  const TB = "\u0000TB\u0000";

  return raw
    .replace(/\\\\n/g, NL)
    .replace(/\\\\t/g, TB)
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(new RegExp(NL, "g"), "\\n")
    .replace(new RegExp(TB, "g"), "\\t");
}

/**
 * Max length for a Text Display Component's content.
 */
const TEXT_MAX = 3800;

/**
 * @param {string} text
 * @returns {string[]}
 */
function chunkText(text) {
  const out = [];
  let s = String(text ?? "");
  while (s.length > TEXT_MAX) {
    const cut = s.lastIndexOf("\n", TEXT_MAX);
    const idx = cut > 0 ? cut : TEXT_MAX;
    out.push(s.slice(0, idx).trimEnd());
    s = s.slice(idx).trimStart();
  }
  if (s.trim().length) out.push(s.trim());
  return out;
}

/**
 * @param {ContainerBuilder} container
 * @param {string[]} blocks
 * @returns {void}
 */
function addBlockWithAutoSeparators(container, blocks) {
  const flattened = blocks.flatMap(chunkText).filter(Boolean);

  for (let i = 0; i < flattened.length; i++) {
    const content = flattened[i];

    container.addTextDisplayComponents((t) => t.setContent(content));

    // Auto Separator
    if (i !== flattened.length - 1) {
      container.addSeparatorComponents((s) => s);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("container")
    .setDescription("Create a ComponentsV2 container (text + separators)!")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a container from sections of text.")
        .addStringOption((option) =>
          option
            .setName("sections")
            .setDescription(
              "Text sections separated by `||` or a line with `---`",
            )
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(6000),
        )
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("Optional title shown at the top")
            .setRequired(false)
            .setMaxLength(120),
        )
        .addStringOption((option) =>
          option
            .setName("accent")
            .setDescription("Accent color: ##RRGGBB or r,g,b")
            .setRequired(false)
            .setMaxLength(32),
        )
        .addBooleanOption((option) =>
          option
            .setName("ephemeral")
            .setDescription("Show only to you (useful for preview)")
            .setRequired(false),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a guild!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand(true);
    if (sub !== "create") return;

    const rawSections = decodeEscapes(
      interaction.options.getString("sections", true),
    );
    const title = decodeEscapes(interaction.options.getString("title"));
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

    const accentRaw = interaction.options.getString("accent");
    /** @type {{ ok: true, int: number} | { ok: false, error: string } | null} */
    let accent = null;

    if (accentRaw?.trim()) {
      accent = accentRaw.includes(",")
        ? parseRgb(accentRaw)
        : parseHex(accentRaw);

      if (!accent.ok) {
        return interaction.reply({
          content: `${accent.error}\nExamples: \`#ff00ff\` or \`255, 0, 255\``,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    const sections = splitSections(rawSections);
    if (!sections.length) {
      return interaction.reply({
        content: "You didn't provide any usable text sections!",
        flags: MessageFlags.Ephemeral,
      });
    }

    /** Build blocks (title becomes its own text component)
     * @type {string[]}
     */
    const blocks = [];

    if (title?.trim()) {
      blocks.push(`## ${title.trim()}`);
    }

    // Add provided sections
    blocks.push(...sections);

    const container = new ContainerBuilder();
    if (accent) container.setAccentColor(accent.int);

    addBlockWithAutoSeparators(container, blocks);

    return interaction.channel
      .send({
        components: [container],
        flags:
          (ephemeral ? MessageFlags.Ephemeral : 0) |
          MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      })
      .then(async () => {
        await interaction.reply({
          content: "Done!",
          flags: MessageFlags.Ephemeral,
        });
      });
  },
};
