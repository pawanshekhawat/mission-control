import { Client, GatewayIntentBits, Partials, SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import config from './config.json' assert { type: 'json' };

const prisma = new PrismaClient();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const CHANNELS = {
  GAME: 'new-game-requests',
  UPDATE: 'update-requests',
  FIX: 'fix-requests',
  PRIORITY: 'priority',
};

const STATUS_EMOJI = {
  NEW: '📋',
  REVIEW: '🔍',
  ACCEPTED: '✅',
  IN_PROGRESS: '⚙️',
  DONE: '🏁',
  REJECTED: '❌',
};

const STATUS_LABEL = {
  NEW: 'New',
  REVIEW: 'Under Review',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In Progress',
  DONE: 'Completed',
  REJECTED: 'Rejected',
};

// ─────────────────────────────────────────────
// Slash Commands
// ─────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('request')
    .setDescription('Submit a new game request')
    .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true))
    .addStringOption(opt => opt.setName('link').setDescription('Store link (Steam, Epic, etc.)').setRequired(true))
    .addStringOption(opt => opt.setName('comment').setDescription('Additional notes').setRequired(false)),

  new SlashCommandBuilder()
    .setName('update-request')
    .setDescription('Request an update for an existing game')
    .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true))
    .addStringOption(opt => opt.setName('version').setDescription('New version number').setRequired(false))
    .addStringOption(opt => opt.setName('link').setDescription('Update link').setRequired(false))
    .addStringOption(opt => opt.setName('comment').setDescription('What needs updating?').setRequired(false)),

  new SlashCommandBuilder()
    .setName('fix-request')
    .setDescription('Report a broken link or issue')
    .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true))
    .addStringOption(opt => opt.setName('issue').setDescription('Describe the issue').setRequired(true))
    .addStringOption(opt => opt.setName('link').setDescription('Broken link').setRequired(false)),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for existing requests')
    .addStringOption(opt => opt.setName('query').setDescription('Game name to search').setRequired(true)),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show request statistics'),
].map(cmd => cmd.toJSON());

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function getStatusColor(status) {
  switch (status) {
    case 'NEW': return 0x808080;
    case 'REVIEW': return 0xFFC107;
    case 'ACCEPTED': return 0x4CAF50;
    case 'IN_PROGRESS': return 0x2196F3;
    case 'DONE': return 0x00C853;
    case 'REJECTED': return 0xF44336;
    default: return 0xFFFFFF;
  }
}

async function findOrCreateUser(discordId) {
  return prisma.user.upsert({
    where: { discordId },
    update: {},
    create: { discordId },
  });
}

async function findChannel(guild, channelName) {
  return guild.channels.cache.find(c => c.name === channelName && c.isTextBased());
}

async function buildRequestEmbed(request, user) {
  return new EmbedBuilder()
    .setTitle(`🎮 ${request.gameName}`)
    .setDescription(request.comment || 'No additional notes')
    .addFields(
      { name: 'Request ID', value: request.id, inline: true },
      { name: 'Type', value: request.type.toUpperCase(), inline: true },
      { name: 'Status', value: `${STATUS_EMOJI[request.status]} ${STATUS_LABEL[request.status]}`, inline: true },
      { name: 'Votes', value: `👍 ${request.voteCount}`, inline: true },
      { name: 'Requested by', value: user.discordId, inline: true },
      { name: 'Store Link', value: request.storeLink || 'Not provided', inline: false },
    )
    .setColor(getStatusColor(request.status))
    .setTimestamp(request.createdAt);
}

async function updateLeaderboard(guild) {
  const priorityChannel = await findChannel(guild, CHANNELS.PRIORITY);
  if (!priorityChannel) return;

  const requests = await prisma.request.findMany({
    where: { status: { notIn: ['DONE', 'REJECTED'] } },
    orderBy: [{ voteCount: 'desc' }, { createdAt: 'asc' }],
    take: 15,
  });

  if (requests.length === 0) {
    return priorityChannel.send('📋 No active requests yet. Be the first to submit one!');
  }

  const leaderboard = new EmbedBuilder()
    .setTitle('🏆 Priority Leaderboard')
    .setDescription('Top community requests — vote for your favorites!')
    .setColor(0xFFD700);

  const lines = await Promise.all(requests.map(async (r, i) => {
    const user = await prisma.user.findUnique({ where: { id: r.userId } });
    return `**${i + 1}.** ${r.gameName} — ${r.voteCount} votes`;
  }));

  leaderboard.setDescription(lines.join('\n') || 'No active requests');
  leaderboard.setFooter({ text: 'Use /request to submit a new game!' });

  // Edit or send new message
  const messages = await priorityChannel.messages.fetch({ limit: 1 });
  if (messages.size > 0) {
    await messages.first().edit({ embeds: [leaderboard] });
  } else {
    await priorityChannel.send({ embeds: [leaderboard] });
  }
}

// ─────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────
client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register slash commands
  await client.application.commands.set(commands);
  console.log('✅ Slash commands registered');

  // Initial leaderboard
  const guild = client.guilds.cache.first();
  if (guild) await updateLeaderboard(guild);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const user = await findOrCreateUser(interaction.user.id);

  // ─── /request ───
  if (commandName === 'request') {
    const game = interaction.options.getString('game');
    const link = interaction.options.getString('link');
    const comment = interaction.options.getString('comment');

    const request = await prisma.request.create({
      data: {
        type: 'game',
        gameName: game,
        storeLink: link,
        comment,
        userId: user.id,
        status: 'NEW',
      },
    });

    const channel = await findChannel(interaction.guild, CHANNELS.GAME);
    if (channel) {
      const embed = await buildRequestEmbed(request, user);
      const msg = await channel.send({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vote_${request.id}`).setLabel('👍 Vote').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`follow_${request.id}`).setLabel('🔔 Follow').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });

      await prisma.request.update({ where: { id: request.id }, data: { messageId: msg.id, channelId: channel.id } });
    }

    await interaction.reply({
      content: `✅ Request submitted! **${game}** has been posted to <#${channel?.id}>`,
      ephemeral: true,
    });

    await updateLeaderboard(interaction.guild);
  }

  // ─── /update-request ───
  else if (commandName === 'update-request') {
    const game = interaction.options.getString('game');
    const version = interaction.options.getString('version');
    const link = interaction.options.getString('link');
    const comment = interaction.options.getString('comment');

    const request = await prisma.request.create({
      data: {
        type: 'update',
        gameName: game,
        storeLink: link || null,
        comment: `${version ? `Version: ${version}\n` : ''}${comment || ''}`,
        userId: user.id,
        status: 'NEW',
      },
    });

    const channel = await findChannel(interaction.guild, CHANNELS.UPDATE);
    if (channel) {
      const embed = await buildRequestEmbed(request, user);
      const msg = await channel.send({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vote_${request.id}`).setLabel('👍 Vote').setStyle(ButtonStyle.Primary),
          ),
        ],
      });

      await prisma.request.update({ where: { id: request.id }, data: { messageId: msg.id, channelId: channel.id } });
    }

    await interaction.reply({
      content: `✅ Update request submitted for **${game}**`,
      ephemeral: true,
    });

    await updateLeaderboard(interaction.guild);
  }

  // ─── /fix-request ───
  else if (commandName === 'fix-request') {
    const game = interaction.options.getString('game');
    const issue = interaction.options.getString('issue');
    const link = interaction.options.getString('link');

    const request = await prisma.request.create({
      data: {
        type: 'fix',
        gameName: game,
        storeLink: link || null,
        comment: issue,
        userId: user.id,
        status: 'NEW',
      },
    });

    const channel = await findChannel(interaction.guild, CHANNELS.FIX);
    if (channel) {
      const embed = await buildRequestEmbed(request, user);
      const msg = await channel.send({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vote_${request.id}`).setLabel('👍 Vote').setStyle(ButtonStyle.Primary),
          ),
        ],
      });

      await prisma.request.update({ where: { id: request.id }, data: { messageId: msg.id, channelId: channel.id } });
    }

    await interaction.reply({
      content: `✅ Fix request submitted for **${game}**`,
      ephemeral: true,
    });

    await updateLeaderboard(interaction.guild);
  }

  // ─── /search ───
  else if (commandName === 'search') {
    const query = interaction.options.getString('query').toLowerCase();

    const requests = await prisma.request.findMany({
      where: {
        gameName: { contains: query, mode: 'insensitive' },
      },
      orderBy: { voteCount: 'desc' },
      take: 10,
    });

    if (requests.length === 0) {
      return interaction.reply({ content: `No requests found for "${query}"`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Search results for "${query}"`)
      .setColor(0x5865F2);

    const lines = requests.map(r =>
      `**${r.gameName}** [${r.type.toUpperCase()}] — ${r.voteCount} votes — ${STATUS_EMOJI[r.status]} ${STATUS_LABEL[r.status]}`
    );

    embed.setDescription(lines.join('\n') || 'No results');
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ─── /stats ───
  else if (commandName === 'stats') {
    const [total, byType, byStatus] = await Promise.all([
      prisma.request.count(),
      prisma.request.groupBy({ by: ['type'], _count: true }),
      prisma.request.groupBy({ by: ['status'], _count: true }),
    ]);

    const embed = new EmbedBuilder()
      .setTitle('📊 Request Statistics')
      .addFields(
        { name: 'Total Requests', value: String(total), inline: true },
        { name: 'Games', value: String(byType.find(x => x.type === 'game')?._count || 0), inline: true },
        { name: 'Updates', value: String(byType.find(x => x.type === 'update')?._count || 0), inline: true },
        { name: 'Fixes', value: String(byType.find(x => x.type === 'fix')?._count || 0), inline: true },
      )
      .setColor(0x00C853);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// ─── Button Interactions (Admin controls) ───
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, requestId] = interaction.customId.split('_');
  if (!requestId) return;

  // ─── Vote Button ───
  if (action === 'vote') {
    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) return;

    // Toggle vote
    const existingVote = await prisma.vote.findUnique({
      where: { requestId_userId: { requestId, userId: interaction.user.id } },
    });

    if (existingVote) {
      await prisma.vote.delete({ where: { id: existingVote.id } });
      await prisma.request.update({ where: { id: requestId }, data: { voteCount: { decrement: 1 } } });
      await interaction.reply({ content: '✅ Vote removed', ephemeral: true });
    } else {
      await prisma.vote.create({ data: { requestId, userId: interaction.user.id } });
      await prisma.request.update({ where: { id: requestId }, data: { voteCount: { increment: 1 } } });
      await interaction.reply({ content: '✅ Vote added!', ephemeral: true });
    }

    // Update original embed
    const updated = await prisma.request.findUnique({ where: { id: requestId } });
    const channel = interaction.guild.channels.cache.get(request.channelId);
    if (channel && request.messageId) {
      const msg = await channel.messages.fetch(request.messageId);
      const embed = await buildRequestEmbed(updated, interaction.user);
      await msg.edit({ embeds: [embed] });
    }

    await updateLeaderboard(interaction.guild);
  }
});

// ─────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────
process.on('warning', (e) => console.warn('⚠️', e));

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
client.login(config.token);

export { prisma };
