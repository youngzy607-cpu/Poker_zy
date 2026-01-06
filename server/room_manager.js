const GameServer = require('./game_server');

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> GameServer instance
        this.socketToRoom = new Map(); // socketId -> roomId
        this.userManager = null;
    }

    setUserManager(manager) {
        this.userManager = manager;
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    createRoom(password = null) {
        let roomId = this.generateRoomId();
        while (this.rooms.has(roomId)) {
            roomId = this.generateRoomId();
        }
        
        const game = new GameServer(roomId, this.io, this.userManager);
        // Store password on the game instance or handle it here?
        // GameServer doesn't need to know about password, but we can attach it.
        game.password = password; 
        
        this.rooms.set(roomId, game);
        console.log(`Room created: ${roomId} (Password: ${password ? 'Yes' : 'No'})`);
        this.broadcastRoomList();
        return roomId;
    }

    joinRoom(roomId, socket, playerName, password = null, userProfile = null) {
        const game = this.rooms.get(roomId);
        if (!game) return { success: false, error: 'ROOM_NOT_FOUND' };

        // Password check
        if (game.password && game.password !== password) {
            return { success: false, error: 'INVALID_PASSWORD' };
        }

        // Limit to 8 players
        if (game.players.length >= 8) return { success: false, error: 'ROOM_FULL' };

        // Join socket room
        socket.join(roomId);
        this.socketToRoom.set(socket.id, roomId);

        // Add player to game
        game.addPlayer(socket.id, playerName, userProfile);
        
        this.broadcastRoomList();
        return { success: true };
    }

    getPublicRoomList() {
        const list = [];
        this.rooms.forEach((game, id) => {
            list.push({
                id: id,
                count: game.players.length,
                max: 8,
                hasPassword: !!game.password
            });
        });
        console.log(`[RoomManager] getPublicRoomList returning ${list.length} rooms`);
        return list;
    }

    broadcastRoomList() {
        const list = this.getPublicRoomList();
        console.log(`[RoomManager] Broadcasting list of ${list.length} rooms to all clients.`);
        this.io.emit('roomList', list);
    }

    handleAction(socketId, actionData) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return;

        const game = this.rooms.get(roomId);
        if (game) {
            game.handlePlayerAction(socketId, actionData);
        }
    }

    startGame(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return;

        const game = this.rooms.get(roomId);
        if (game) {
            game.startGame(socketId);
        }
    }

    handleDisconnect(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return;

        const game = this.rooms.get(roomId);
        if (game) {
            game.removePlayer(socketId);
            if (game.players.length === 0) {
                this.rooms.delete(roomId);
                console.log(`Room destroyed: ${roomId}`);
            }
            this.broadcastRoomList();
        }
        this.socketToRoom.delete(socketId);
    }
}

module.exports = RoomManager;
