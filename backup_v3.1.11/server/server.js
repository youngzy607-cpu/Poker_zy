const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./room_manager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the parent directory (project root)
app.use(express.static(path.join(__dirname, '../')));

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Send room list immediately
    socket.emit('roomList', roomManager.getPublicRoomList());

    // Client requests to refresh room list
    socket.on('getRoomList', () => {
        socket.emit('roomList', roomManager.getPublicRoomList());
    });

    // Client requests to create a room
    socket.on('createRoom', ({ name, password }) => {
        const roomId = roomManager.createRoom(password);
        const result = roomManager.joinRoom(roomId, socket, name, password);
        if (result.success) {
            socket.emit('roomCreated', { roomId });
        } else {
            socket.emit('error', 'Failed to create room: ' + result.error);
        }
    });

    // Client requests to join a room
    socket.on('joinRoom', ({ roomId, name, password }) => {
        const result = roomManager.joinRoom(roomId, socket, name, password);
        if (!result.success) {
            // Send specific error code if needed, for now just text
            if (result.error === 'INVALID_PASSWORD') {
                socket.emit('joinError', { code: 'INVALID_PASSWORD', msg: '密码错误' });
            } else if (result.error === 'ROOM_FULL') {
                socket.emit('error', '房间已满');
            } else {
                socket.emit('error', '房间不存在');
            }
        }
    });

    // Client sends an action (fold, call, raise, check)
    socket.on('action', (data) => {
        roomManager.handleAction(socket.id, data);
    });

    // Host starts the game
    socket.on('startGame', () => {
        roomManager.startGame(socket.id);
    });

    // Client disconnects
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        roomManager.handleDisconnect(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
