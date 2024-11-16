const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { type } = require('os');

const server = http.createServer((req, res) => {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading index.html');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        }
    });
});

// WebSocket server
const wss = new WebSocket.Server({ server, maxPayload: 104857600 }); // 100 MB
const clients = new Map();

wss.on('connection', (socket) => {
    let username = null;
    let parsedMessage;

    console.log("New client connected.");

    socket.on('message', (message) => {
        // Convert buffer to string if necessary
        if (Buffer.isBuffer(message)) {
            message = message.toString();
        }

        console.log("Received message:", message);

        try {
            parsedMessage = JSON.parse(message);
        } catch (error) {
            console.error('Error parsing message:', error);
            return;
        }

        // Check if the message type is text
        if (parsedMessage.type === 'text') {
            let messageText;
            console.log("Username is string");
            console.log("Received message:", message);

            messageText = parsedMessage.content;
            // Check if this is the first message to set the username
            if (!username) {
                if (messageText.startsWith("username:")) {
                    username = messageText.replace('username:', '').trim();
                    clients.set(socket, username);
                    const send = {
                        username: username,
                        type: "text",
                        content: `Welcome, ${username}! You are now connected."`
                    }
                    socket.send(JSON.stringify(send));
                    console.log(`Username set to ${username}`);
                }
            } else {
                // Broadcast normal text message
                const messageData = {
                    username: username,
                    type: "text",
                    content: messageText,
                };

                console.log(`Broadcasting message: ${messageData}`);
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(messageData));
                    }
                });
            }
        } else if (parsedMessage.type === 'file') {
            console.log("Message received is file");

            // Handle file message as binary data

            const byteArray = new Uint8Array(parsedMessage.data);

            const buffer = Buffer.from(byteArray);

            const fileMessage = {
                username: username,
                type: "file",
                filetype: parsedMessage.filetype,
                filename: parsedMessage.name,
                data: Array.from(buffer)
            };

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(fileMessage));
                    console.log(`Broadcasting file message: ${fileMessage}`);
                }
            });
        }
    });

    socket.on('close', () => {
        console.log("Client disconnected.");
        clients.delete(socket);
    });
});

server.listen(8080, () => {
    console.log('Server is running at http://localhost:8080');
});