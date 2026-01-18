class NetworkManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.listeners = {}; // Changed from callbacks to listeners array
    }

    connect() {
        if (this.socket) return;
        
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
            console.log('Connected to server:', this.socket.id);
            this.isConnected = true;
            handleEvent('connect');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            handleEvent('disconnect');
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
        this.socket.emit('createRoom', { password });
    }

    joinRoom(roomId, password) {
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
        }
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
