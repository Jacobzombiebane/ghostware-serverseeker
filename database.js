let Database;
let db;

try {
  Database = require('better-sqlite3');
  db = new Database('servers.db');
  
  // Initialize database
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      ip TEXT PRIMARY KEY,
      domain TEXT,
      status TEXT,
      players TEXT,
      last_checked INTEGER
    )
  `);
} catch (e) {
  console.log('\x1b[33m[WARN] better-sqlite3 failed to load. Using in-memory mock for testing.\x1b[0m');
  // Simple mock for testing without native modules
  const mockData = new Map();
  db = {
    exec: () => {},
    prepare: (sql) => {
      if (sql.includes('INSERT')) return { run: (ip, dom, st, pl, ts) => mockData.set(ip, {ip, domain: dom, status: st, players: pl, last_checked: ts}) };
      if (sql.includes('RANDOM')) return { get: () => Array.from(mockData.values())[Math.floor(Math.random() * mockData.size)] };
      if (sql.includes('DELETE')) return { run: (ip) => mockData.delete(ip) };
      if (sql.includes('LIKE')) return { all: (q) => Array.from(mockData.values()).filter(s => s.players.includes(q.replace(/%/g, ''))) };
      return { run: () => {}, get: () => null, all: () => [] };
    }
  };
}

const insertServer = db.prepare(`
  INSERT INTO servers (ip, domain, status, players, last_checked)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(ip) DO UPDATE SET
    domain = COALESCE(excluded.domain, servers.domain),
    status = excluded.status,
    players = excluded.players,
    last_checked = excluded.last_checked
`);

const getRandomServer = db.prepare(`
  SELECT * FROM servers 
  WHERE status != 'Whitelisted' 
  ORDER BY RANDOM() LIMIT 1
`);

const deleteServer = db.prepare(`
  DELETE FROM servers WHERE ip = ?
`);

const searchByPlayers = db.prepare(`
  SELECT * FROM servers 
  WHERE players LIKE ? 
  LIMIT 10
`);

module.exports = {
  db,
  insertServer,
  getRandomServer,
  deleteServer,
  searchByPlayers
};
