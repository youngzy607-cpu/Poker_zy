const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'users.json');

class UserManager {
    constructor() {
        this.users = {};
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const data = fs.readFileSync(DATA_FILE, 'utf8');
                this.users = JSON.parse(data);
            } else {
                // Initialize empty if not exists
                this.save();
            }
        } catch (e) {
            console.error('Error loading users:', e);
            this.users = {};
        }
    }

    save() {
        try {
            // Ensure directory exists
            const dir = path.dirname(DATA_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.users, null, 2));
        } catch (e) {
            console.error('Error saving users:', e);
        }
    }

    register(username, password, avatarId) {
        if (this.users[username]) {
            return { success: false, error: 'USERNAME_EXISTS' };
        }

        this.users[username] = {
            username: username,
            password: password, // In a real app, hash this!
            avatar: avatarId || 0,
            chips: 10000, // Default starting chips
            regDate: new Date().toISOString()
        };

        this.save();
        return { success: true, user: this.getPublicProfile(username) };
    }

    login(username, password) {
        const user = this.users[username];
        if (!user) {
            return { success: false, error: 'USER_NOT_FOUND' };
        }
        if (user.password !== password) {
            return { success: false, error: 'WRONG_PASSWORD' };
        }
        return { success: true, user: this.getPublicProfile(username) };
    }

    getUser(username) {
        return this.users[username];
    }

    getPublicProfile(username) {
        const user = this.users[username];
        if (!user) return null;
        return {
            username: user.username,
            avatar: user.avatar,
            chips: user.chips
        };
    }

    updateChips(username, amount) {
        if (this.users[username]) {
            this.users[username].chips = amount;
            this.save();
            return true;
        }
        return false;
    }
}

module.exports = UserManager;
