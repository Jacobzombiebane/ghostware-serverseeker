# Ghostware Serverseeker

Discord bot that scans for Minecraft servers using masscan and checks their status.

## Features
- Active scanning with `masscan`.
- Automatic login attempts to check status (Online, Whitelisted, Offline).
- Database storage with SQLite.
- Search by player names/counts.
- Random server selection.

## Commands
- `!random`: Get a random non-whitelisted server.
- `!search <query>`: Search for servers by player names or counts.

## Setup for Hostbrr (Linux VPS)

### 1. Update and install dependencies
```bash
sudo apt update
sudo apt install -y git curl build-essential libpcap-dev nodejs npm masscan
```

### 2. Clone and install project
```bash
git clone <your-repo-url>
cd ghostware-serverseeker
npm install
```

### 3. Configure environment
Create a `.env` file:
```env
DISCORD_TOKEN=your_token_here
SCAN_RATE=750
USERNAME=ghostwareserverseeker
```

### 4. Setup Masscan Permissions
Masscan needs root or specific capabilities to run:
```bash
sudo setcap cap_net_raw+ep $(which masscan)
```

### 5. Run the bot
Using PM2 is recommended for 24/7 uptime:
```bash
sudo npm install -g pm2
pm2 start index.js --name "serverseeker"
pm2 save
pm2 startup
```

## Optimization for 2GB RAM
- Uses `better-sqlite3` for low memory footprint.
- Sequential processing of found IPs to prevent CPU/RAM spikes.
- Lightweight `masscan` list output parsing.

## Security & Best Practices
- **Firewall:** Only open SSH (port 22) and the ports you actually need.
  ```bash
  sudo ufw allow 22/tcp
  sudo ufw enable
  ```
- **Masscan Rate:** 750 pps is conservative. Higher rates might get your VPS flagged by Hostbrr. Check their ToS.
- **Bot Token:** Never share your `.env` file.
- **Resource Monitoring:** Use `htop` to monitor memory usage. If it exceeds 2GB, reduce the concurrency in `index.js`.

## How to Export to Hostbrr
1. **Push to a Private GitHub/GitLab Repo:**
   - Create a repo.
   - `git init && git add . && git commit -m "initial"`
   - `git remote add origin <url>`
   - `git push -u origin main`
2. **On Hostbrr VPS:**
   - Follow the "Setup for Hostbrr" instructions above to clone and run.
3. **If Hostbrr provides a Web Panel (Pterodactyl):**
   - Upload all files via SFTP.
   - Set the startup command to `node index.js`.
   - Ensure the "Node.js" egg/image is used.
   - **Note:** You might need to ask Hostbrr support to enable `libpcap` or provide a `masscan` binary if it's not in the default container image. VPS is always better for `masscan`.
