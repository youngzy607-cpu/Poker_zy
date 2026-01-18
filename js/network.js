class NetworkManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.isConnecting = false; // 新增：连接中状态
        this.listeners = {}; // Changed from callbacks to listeners array
    }

    connect() {
        // 如果已经连接或正在连接中，直接返回
        if (this.isConnected || this.isConnecting) return;
        
        // 如果socket存在但已断开，先清理
        if (this.socket && !this.socket.connected) {
            this.socket = null;
        }
        
        if (this.socket) return;
        
        this.isConnecting = true;
        console.log('[NetworkManager] 开始连接服务器...');
        
        // 自动判断服务器地址：生产环境使用当前域名，开发环境使用 localhost
        const serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000'
            : ''; // 空字符串表示使用当前域名
        
        this.socket = io(serverUrl);

        // Generic event handler
        const handleEvent = (event, data) => {
            if (this.listeners[event]) {
                this.listeners[event].forEach(cb => cb(data));
            }
        };

        this.socket.on('connect', () => {
            console.log('[NetworkManager] 已连接到服务器:', this.socket.id);
            this.isConnected = true;
            this.isConnecting = false;
            handleEvent('connect');
        });

        this.socket.on('disconnect', () => {
            console.log('[NetworkManager] 与服务器断开连接');
            this.isConnected = false;
            this.isConnecting = false;
            handleEvent('disconnect');
        });
        
        this.socket.on('connect_error', (err) => {
            console.error('[NetworkManager] 连接错误:', err.message);
            this.isConnecting = false;
        });

        this.socket.on('error', (msg) => {
            alert('Error: ' + msg);
            handleEvent('error', msg);
        });

        const events = [
            'roomCreated', 'updateState', 'playerAction', 
            'gameStart', 'gameOver', 'message', 
            'roomList', 'joinError',
            'loginSuccess', 'loginError',
            'registerSuccess', 'registerError'
        ];

        events.forEach(evt => {
            this.socket.on(evt, (data) => handleEvent(evt, data));
        });
    }

    // --- Auth Methods ---
    login(username, password) {
        this.socket.emit('login', { username, password });
    }

    register(username, password, avatarId) {
        this.socket.emit('register', { username, password, avatarId });
    }

    // --- Room Methods ---
    // Name is now handled by session on server
    createRoom(password) {
        if (!this.isConnected || !this.socket) {
            alert('未连接到服务器，请稍后再试');
            console.error('[NetworkManager] Cannot create room: not connected');
            return;
        }
        this.socket.emit('createRoom', { password });
    }

    joinRoom(roomId, password) {
        if (!this.isConnected || !this.socket) {
            alert('未连接到服务器，请稍后再试');
            console.error('[NetworkManager] Cannot join room: not connected');
            return;
        }
        this.socket.emit('joinRoom', { roomId, password });
    }

    getRoomList() {
        this.socket.emit('getRoomList');
    }

    sendAction(action, amount) {
        this.socket.emit('action', { action, amount });
    }

    updateBalance(amount) {
        if (this.isConnected && this.socket) {
            this.socket.emit('updateBalance', amount);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.isConnecting = false;
        }
    }

    // 新增：确保连接的方法
    ensureConnected() {
        return new Promise((resolve, reject) => {
            if (this.isConnected) {
                resolve();
                return;
            }
            
            // 设置超时
            const timeout = setTimeout(() => {
                reject(new Error('连接超时'));
            }, 5000);
            
            // 监听连接成功
            const onConnect = () => {
                clearTimeout(timeout);
                this.off('connect', onConnect);
                resolve();
            };
            
            this.on('connect', onConnect);
            
            // 尝试连接
            this.connect();
        });
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
}

const networkManager = new NetworkManager();
