const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./room_manager');
const UserManager = require('./user_manager');
const StatsManager = require('./stats_manager');
const { testConnection } = require('./supabase_client');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 支持 JSON 请求体解析
app.use(express.json());

// Serve static files from the parent directory (project root)
app.use(express.static(path.join(__dirname, '../')));

const roomManager = new RoomManager(io);
const userManager = new UserManager();
const statsManager = new StatsManager();
roomManager.setUserManager(userManager); // Inject UserManager

// Map socket.id -> username (Session management)
const sessions = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Send room list immediately
    socket.emit('roomList', roomManager.getPublicRoomList());

    // --- Auth Events ---

    socket.on('login', async ({ username, password }) => {
        const result = await userManager.login(username, password);
        if (result.success) {
            sessions[socket.id] = result.user.username;
            socket.emit('loginSuccess', result.user);
            console.log(`User logged in: ${result.user.username}`);
        } else {
            socket.emit('loginError', result.error);
        }
    });

    socket.on('register', async ({ username, password, avatarId }) => {
        const result = await userManager.register(username, password, avatarId);
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
    socket.on('createRoom', async ({ password }) => {
        const username = sessions[socket.id];
        if (!username) {
            socket.emit('error', '请先登录');
            return;
        }
        
        const userProfile = await userManager.getUser(username);
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
    socket.on('joinRoom', async ({ roomId, password }) => {
        const username = sessions[socket.id];
        if (!username) {
            socket.emit('error', '请先登录');
            return;
        }
        
        const userProfile = await userManager.getUser(username);
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
    socket.on('updateBalance', async (amount) => {
        const username = sessions[socket.id];
        if (username) {
            await userManager.updateChips(username, amount);
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

// ===========================================
// HTTP API 接口（用于前端直接调用）
// ===========================================

// 获取用户战绩
app.get('/api/stats/:username', async (req, res) => {
    try {
        const stats = await statsManager.getStats(req.params.username);
        res.json({ success: true, data: stats });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 记录一局游戏结果
app.post('/api/stats/:username/record', async (req, res) => {
    try {
        const { profit, hand, pot, cards } = req.body;
        const success = await statsManager.recordHand(req.params.username, {
            profit, hand, pot, cards
        });
        res.json({ success });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 更新成就列表
app.post('/api/stats/:username/achievements', async (req, res) => {
    try {
        const { achievements } = req.body;
        const success = await statsManager.updateAchievements(req.params.username, achievements);
        res.json({ success });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 重置战绩
app.post('/api/stats/:username/reset', async (req, res) => {
    try {
        const success = await statsManager.resetStats(req.params.username);
        res.json({ success });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// ===========================================
// 启动服务器
// ===========================================

(async () => {
    // 测试 Supabase 连接
    console.log('\n正在连接 Supabase 数据库...');
    const connected = await testConnection();
    
    if (!connected) {
        console.error('⚠️  警告: Supabase 连接失败，请检查配置');
        console.error('请确认 .env 文件存在且配置正确');
        // 继续启动，但数据库功能会不可用
    }
    
    server.listen(PORT, () => {
        console.log(`\n✅ 服务器运行中: http://localhost:${PORT}`);
        console.log(`\ud83c� 德州扑克服务器已启动！\n`);
    });
})();
