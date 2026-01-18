// Supabase 客户端配置
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 从环境变量读取配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// 创建 Supabase 客户端实例
const supabase = createClient(supabaseUrl, supabaseKey);

// 验证连接
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('❌ Supabase 连接失败:', error.message);
            return false;
        }
        
        console.log('✅ Supabase 连接成功');
        return true;
    } catch (e) {
        console.error('❌ Supabase 连接异常:', e.message);
        return false;
    }
}

module.exports = { supabase, testConnection };
