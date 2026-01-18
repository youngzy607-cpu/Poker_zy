// 用户管理器 - Supabase 版本
const { supabase } = require('./supabase_client');

class UserManager {
    constructor() {
        console.log('UserManager 已初始化（使用 Supabase 数据库）');
    }

    // 注册用户
    async register(username, password, avatarId) {
        try {
            // 检查用户是否已存在
            const { data: existing } = await supabase
                .from('user_profiles')
                .select('username')
                .eq('username', username)
                .single();

            if (existing) {
                return { success: false, error: 'USERNAME_EXISTS' };
            }

            // 创建新用户
            const { data, error } = await supabase
                .from('user_profiles')
                .insert([{
                    username: username,
                    password: password, // 生产环境需要加密
                    avatar: avatarId || 0,
                    chips: 10000, // 默认起始筹码
                }])
                .select()
                .single();

            if (error) {
                console.error('注册失败:', error);
                return { success: false, error: 'DATABASE_ERROR' };
            }

            // 为新用户创建空战绩记录
            await supabase
                .from('game_statistics')
                .insert([{ username: username }]);

            console.log(`✅ 用户注册成功: ${username}`);
            return { 
                success: true, 
                user: this._toPublicProfile(data) 
            };

        } catch (e) {
            console.error('注册异常:', e);
            return { success: false, error: 'SYSTEM_ERROR' };
        }
    }

    // 登录验证
    async login(username, password) {
        try {
            const { data: user, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !user) {
                return { success: false, error: 'USER_NOT_FOUND' };
            }

            if (user.password !== password) {
                return { success: false, error: 'WRONG_PASSWORD' };
            }

            console.log(`✅ 用户登录成功: ${username}`);
            return { 
                success: true, 
                user: this._toPublicProfile(user) 
            };

        } catch (e) {
            console.error('登录异常:', e);
            return { success: false, error: 'SYSTEM_ERROR' };
        }
    }

    // 获取用户信息
    async getUser(username) {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('username', username)
                .single();

            return error ? null : data;
        } catch (e) {
            console.error('获取用户信息异常:', e);
            return null;
        }
    }

    // 获取公开资料
    async getPublicProfile(username) {
        const user = await this.getUser(username);
        return user ? this._toPublicProfile(user) : null;
    }

    // 更新筹码余额
    async updateChips(username, amount) {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ chips: amount })
                .eq('username', username);

            if (error) {
                console.error('更新筹码失败:', error);
                return false;
            }

            console.log(`💰 筹码已更新: ${username} -> ${amount}`);
            return true;
        } catch (e) {
            console.error('更新筹码异常:', e);
            return false;
        }
    }

    // 转换为公开资料（不包含密码）
    _toPublicProfile(user) {
        return {
            username: user.username,
            avatar: user.avatar,
            chips: user.chips
        };
    }
}

module.exports = UserManager;
