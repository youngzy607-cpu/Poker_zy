const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./room_manager');
const UserManager = require('./user_manager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the parent directory (project root)
app.use(express.static(path.join(__dirname, '../')));

const roomManager = new RoomManager(io);
const userManager = new UserManager();
roomManager.setUserManager(userManager); // Inject UserManager

// Map socket.id -> username (Session management)
const sessions = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Send room list immediately
    socket.emit('roomList', roomManager.getPublicRoomList());

    // --- Auth Events ---

    socket.on('login', ({ username, password }) => {
        const result = userManager.login(username, password);
        if (result.success) {
            sessions[socket.id] = result.user.username;
            socket.emit('loginSuccess', result.user);
            console.log(`User logged in: ${result.user.username}`);
        } else {
            socket.emit('loginError', result.error);
        }
    });

    socket.on('register', ({ username, password, avatarId }) => {
        const result = userManager.register(username, password, avatarId);
        if (result.success) {
            sessions[socket.id] = result.user.username;
            socket.emit('registerSuccess', result.user);
            console.log(`New user registered: ${result.user.username}`);
        } else {
            socket.emit('registerError', result.error);
        }
    });

    // Auto-login / Reconnect check (if needed later)
    // For now, client sends 'login' with saved creds

    // --- Game Events ---

    // Client requests to refresh room list
    socket.on('getRoomList', () => {
        socket.emit('roomList', roomManager.getPublicRoomList());
    });

    // Client requests to create a room
    socket.on('createRoom', ({ password }) => {
        const username = sessions[socket.id];
        if (!username) {
            socket.emit('error', '请先登录');
            return;
        }
        
        const userProfile = userManager.getUser(username);
        // Sync chips from server to room? Or room uses its own logic?
        // Plan: Room takes user's current chips.
        
        const roomId = roomManager.createRoom(password);
        // Note: joinRoom now expects just roomId and password, user info comes from session/server
        const result = roomManager.joinRoom(roomId, socket, userProfile.username, password, userProfile);
        
        if (result.success) {
            socket.emit('roomCreated', { roomId });
        } else {
            socket.emit('error', 'Failed to create room: ' + result.error);
        }
    });

    // Client requests to join a room
    socket.on('joinRoom', ({ roomId, password }) => {
        const username = sessions[socket.id];
        if (!username) {
            socket.emit('error', '请先登录');
            return;
        }
        
        const userProfile = userManager.getUser(username);
        const result = roomManager.joinRoom(roomId, socket, userProfile.username, password, userProfile);
        
        if (!result.success) {
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

    // Client updates balance (e.g. from single player mode)
    socket.on('updateBalance', (amount) => {
        const username = sessions[socket.id];
        if (username) {
            userManager.updateChips(username, amount);
            // Optionally broadcast or confirm
            // console.log(`Updated balance for ${username}: ${amount}`);
        }
    });

    // Client requests to rebuy chips (online mode)
    socket.on('rebuy', ({ amount }) => {
        const username = sessions[socket.id];
        if (!username) {
            socket.emit('error', '请先登录');
            return;
        }
        
        // 简化处理：直接允许买入（实际应该验证账户余额）
        roomManager.handleRebuy(socket.id, amount);
    });

    // Client disconnects
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const username = sessions[socket.id];
        if (username) {
            // Optional: Handle user "offline" status if needed
            delete sessions[socket.id];
        }
        roomManager.handleDisconnect(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
