const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { parseHex, parseRgb } = require("../../utils/utils");
const { PNG } = require("pngjs");

function makeSolidPng({ r, g, b }, size = 512) {
  const png = new PNG({ width: size, height: size });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("color")
    .setDescription("Show a color preview from hex or RGB!")
    .addSubcommand((sub) =>
      sub
        .setName("hex")
        .setDescription("Use a hex color like #ff00ff or #f0f")
        .addStringOption((option) =>
          option
            .setName("value")
            .setDescription("Hex color (e.g., #ff00ff)")
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(9)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("rgb")
        .setDescription("Use an RGB color like 255,0,255")
        .addStringOption((option) =>
          option
            .setName("value")
            .setDescription("RGB (e.g., 255,0,255)")
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(20)
        )
    ),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);
    const value = interaction.options.getString("value", true);

    const parsed = sub === "hex" ? parseHex(value) : parseRgb(value);
    if (!parsed.ok) {
      const example =
        sub === "hex"
          ? "`/color hex value:#ff00ff`"
          : "`/color rgb value:255, 0, 255`";
      return interaction.reply({
        content: `${parsed.error}\nExample: ${example}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Choose Output Resolution
    const size = 1024;
    const buffer = makeSolidPng(
      { r: parsed.r, g: parsed.g, b: parsed.b },
      size
    );

    const fileName = `color-${parsed.hex.slice(1)}.png`;
    const file = new AttachmentBuilder(buffer, { name: fileName });
    const title = sub === "hex" 
      ? `## \\${parsed.hex}\n-# RGB: ${parsed.r}, ${parsed.g}, ${parsed.b}`
      : `## RGB: ${parsed.r}, ${parsed.g}, ${parsed.b}\n-# \\${parsed.hex}`

    const container = new ContainerBuilder()
      .setAccentColor(parsed.int)
      .addTextDisplayComponents((text) =>
        text.setContent(title))
      .addSeparatorComponents((s) => s)
      .addMediaGalleryComponents((gallery) =>
        gallery.addItems((i) =>
          i.setURL(`attachment://${fileName}`).setDescription(parsed.hex)
        )
      );

    return interaction.reply({
      components: [container],
      files: [file],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
