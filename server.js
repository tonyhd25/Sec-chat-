const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (let iface in interfaces) {
        for (let alias of interfaces[iface]) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

const localIp = getLocalIp();
app.use(express.static(path.join(__dirname, 'public')));

let clients = [];

wss.on('connection', (ws) => {
    console.log('Neuer Client verbunden.');
    clients.push(ws);

    ws.on('message', (message) => {
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        clients = clients.filter(c => c !== ws);
        console.log('Client getrennt.');
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server läuft auf http://${localIp}:${PORT}`);
});
