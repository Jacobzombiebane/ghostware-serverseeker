const mineflayer = require('mineflayer');
const mc = require('minecraft-protocol');
const dns = require('dns').promises;

async function checkServer(ip, username) {
  // Try to resolve domain
  let domain = null;
  try {
    const hostnames = await dns.reverse(ip);
    if (hostnames.length > 0) domain = hostnames[0];
  } catch (e) {
    // Reverse DNS failed, no domain found
  }

  // First, get basic info via ping
  let pingResult = null;
  try {
    pingResult = await mc.ping({ host: ip, port: 25565, timeout: 5000 });
  } catch (e) {
    // Ping failed
  }

  return new Promise((resolve) => {
    const bot = mineflayer.createBot({
      host: ip,
      port: 25565,
      username: username,
      auth: 'offline',
      hideErrors: true,
      connectTimeout: 10000
    });

    let result = {
      status: 'Unknown',
      players: pingResult ? `${pingResult.players.online}/${pingResult.players.max}` : '0/0',
      playerList: pingResult && pingResult.players.sample ? pingResult.players.sample.map(p => p.name).join(', ') : ''
    };

    bot.on('login', () => {
      result.status = 'Offline-no-whitelist';
      bot.quit();
      resolve({ ...result, domain });
    });

    bot.on('error', (err) => {
      if (result.status === 'Unknown') result.status = 'Unreachable';
      resolve({ ...result, domain });
    });

    bot.on('kicked', (reason) => {
      const kickReason = typeof reason === 'string' ? reason : JSON.stringify(reason);
      
      if (kickReason.toLowerCase().includes('whitelist')) {
        result.status = 'Whitelisted';
      } else if (kickReason.toLowerCase().includes('authentication') || 
                 kickReason.toLowerCase().includes('microsoft') || 
                 kickReason.toLowerCase().includes('online mode') ||
                 kickReason.toLowerCase().includes('session')) {
        result.status = 'Online mode';
      } else {
        result.status = 'Kicked: ' + kickReason.substring(0, 50);
      }
      resolve({ ...result, domain });
    });

    setTimeout(() => {
      bot.end();
      resolve({ ...result, domain });
    }, 12000);
  });
}

module.exports = { checkServer };
