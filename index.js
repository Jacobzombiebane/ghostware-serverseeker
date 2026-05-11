require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { spawn } = require('child_process');
const { insertServer, getRandomServer, deleteServer, searchByPlayers } = require('./database');
const { checkServer } = require('./checker');
const fs = require('fs');

// --- Visual & CLI Config ---
const ASCII_ART = `
\x1b[35m   ____ _               _                       
  / ___| |__   ___  ___| |_      ____ _ _ __ ___ 
 | |  _| '_ \\ / _ \\/ __| __|    / / _\` | '__/ _ \\
 | |_| | | | | (_) \\__ \\ |_    / / (_| | | |  __/
  \\____|_| |_|\\___/|___/\\__|  /_/ \\__,_|_|  \\___|
\x1b[34m        S E R V E R    S E E K E R\x1b[0m
`;

const isTestMode = process.argv.includes('--test');

// NOTE: Enable "Message Content Intent" in the Discord Developer Portal 
// under Bot -> Privileged Gateway Intents for !commands to work.
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const SCAN_RATE = process.env.SCAN_RATE || 750;
const USERNAME = process.env.USERNAME || 'ghostwareserverseeker';

let queue = [];
let processing = false;

function log(type, message) {
  const colors = {
    info: '\x1b[36m[INFO]\x1b[0m',
    success: '\x1b[32m[OK]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
    scan: '\x1b[35m[SCAN]\x1b[0m'
  };
  console.log(`${colors[type] || '[LOG]'} ${message}`);
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const ip = queue.shift();
    log('info', `Checking ${ip}...`);
    try {
      const result = await checkServer(ip, USERNAME);
      insertServer.run(ip, result.domain, result.status, result.players + (result.playerList ? " | " + result.playerList : ""), Date.now());
      
      const statusColor = result.status === 'Offline-no-whitelist' ? '\x1b[32m' : '\x1b[33m';
      log('success', `${ip} -> ${statusColor}${result.status}\x1b[0m`);
    } catch (e) {
      log('error', `Checking ${ip}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  processing = false;
}

function startScanner() {
  if (isTestMode) {
    log('warn', 'Test mode active. Masscan will NOT be started.');
    return;
  }

  log('scan', `Starting masscan at ${SCAN_RATE} pps...`);
  const masscan = spawn('masscan', [
    '-p25565',
    '0.0.0.0/0',
    '--rate', SCAN_RATE.toString(),
    '--excludefile', 'exclusion.txt',
    '--oL', '-'
  ]);

  masscan.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('open tcp 25565')) {
        const parts = line.split(' ');
        if (parts.length >= 4) {
          const ip = parts[3];
          if (!queue.includes(ip)) {
            queue.push(ip);
            if (!processing) processQueue();
          }
        }
      }
    }
  });

  masscan.stderr.on('data', (data) => {
    // Masscan often outputs progress to stderr, don't log it all to save RAM/Console
    if (data.toString().includes('error')) log('error', `Masscan: ${data}`);
  });

  masscan.on('close', (code) => {
    log('warn', `Masscan exited (${code}). Restarting in 10s...`);
    setTimeout(startScanner, 10000);
  });
}

client.once('ready', () => {
  process.stdout.write('\x1Bc'); // Clear screen
  console.log(ASCII_ART);
  log('success', `Bot logged in as ${client.user.tag}`);
  startScanner();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.split(' ');
  const command = args[0].toLowerCase();

  if (command === '!random') {
    const server = getRandomServer.get();
    if (!server) return message.reply('No servers found in DB yet.');

    const embed = new EmbedBuilder()
      .setTitle('Random Server Found')
      .addFields(
        { name: 'IP', value: server.ip },
        { name: 'Domain', value: server.domain || 'None' },
        { name: 'Status', value: server.status },
        { name: 'Players', value: server.players || 'None' }
      )
      .setColor(server.status === 'Offline-no-whitelist' ? 0x00ff00 : 0xffa500)
      .setTimestamp();

    const row = {
      content: 'Do you want to remove this server from DB?',
      components: [
        {
          type: 1,
          components: [
            { type: 2, label: 'Remove', style: 4, custom_id: `remove_${server.ip}` }
          ]
        }
      ]
    };

    message.reply({ embeds: [embed], components: row.components });
  }

  if (command === '!search') {
    const query = args.slice(1).join(' ');
    if (!query) return message.reply('Usage: !search <player_name_or_count>');

    const results = searchByPlayers.all(`%${query}%`);
    if (results.length === 0) return message.reply('No matches found.');

    const description = results.map(s => `**${s.ip}** - ${s.status} (${s.players})`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle(`Search results for "${query}"`)
      .setDescription(description.substring(0, 4000))
      .setColor(0x3498db);

    message.reply({ embeds: [embed] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('remove_')) {
    const ip = interaction.customId.replace('remove_', '');
    deleteServer.run(ip);
    await interaction.reply({ content: `Removed ${ip} from database.`, ephemeral: true });
  }
});

client.login(TOKEN);
