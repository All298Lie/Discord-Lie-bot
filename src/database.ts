import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// .env DISCORD_TOKEN 검사
if (!process.env.DB_HOST) throw new Error("DB_HOST 토큰 값이 존재하지 않습니다.");
if (!process.env.DB_USER) throw new Error("DB_USER 토큰 값이 존재하지 않습니다.");
if (!process.env.DB_USER_PASSWORD) throw new Error("DB_USER_PASSWORD 토큰 값이 존재하지 않습니다.");
if (!process.env.DB_DATABASE) throw new Error("DB_DATABASE 토큰 값이 존재하지 않습니다.");

// 커넥션 풀 생성
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_USER_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 테이블이 없을 경우 테이블 생성하는 함수
export async function initDatabase() {
    const users = `
        CREATE TABLE IF NOT EXISTS users (
            guild_id VARCHAR(20) NOT NULL,
            user_id VARCHAR(20) NOT NULL,
            level INT UNSIGNED DEFAULT 1,
            failure_count INT UNSIGNED DEFAULT 0,
            point BIGINT UNSIGNED DEFAULT 0,
            consecutive_days INT UNSIGNED DEFAULT 0,
            last_attendance_date DATE DEFAULT NULL,
            last_level_up_at DATETIME DEFAULT NULL,
            PRIMARY KEY (guild_id, user_id)
        );
    `;
    const guildSettings = `
        CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id VARCHAR(20) PRIMARY KEY,
            dedicated_channel_id VARCHAR(20)
        );
    `;
    const systemSettings = `
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(50) PRIMARY KEY,
            setting_value TEXT
        );
    `;

    const guildMaple = `
        CREATE TABLE IF NOT EXISTS guild_maple (
            guild_id VARCHAR(20) PRIMARY KEY,
            maple_channel_id VARCHAR(20) DEFAULT NULL,
            maple_noti_enabled BOOLEAN DEFAULT FALSE
        );
    `;

    const sundayMaple = `
        CREATE TABLE IF NOT EXISTS sunday_maple (
            notice_id INT PRIMARY KEY,
            title VARCHAR(100),
            url VARCHAR(255),
            image_url TEXT,
            saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    // 데이터베이스 접속 시도
    let connected = false;
    while (!connected) {
        try {
            console.log("🔄 데이터베이스 연결 시도 중...");
            await pool.execute('SELECT 1'); // 테스트 쿼리
            await pool.execute(users); // users 테이블 생성 쿼리
            await pool.execute(guildSettings); // guild_settings 테이블 생성 쿼리
            await pool.execute(systemSettings); // system_settings 테이블 생성 쿼리
            await pool.execute(guildMaple); // guild_maple 테이블 생성 쿼리
            await pool.execute(sundayMaple); // sunday_maple 테이블 생성 쿼리

            console.log("✅ 데이터베이스 연결 및 초기화 성공!");
            connected = true
        } catch (error) {
            console.error("⚠️ 데이터베이스 연결 실패. 3초 후 재시도합니다...");
            console.error(error);
            // 3초 대기 (Promise + setTimeout)
            await new Promise(resolve => setTimeout(resolve, 3 * 1000));
        }
    }
}

// 유저 데이터 가져오는 함수
export async function getUser(guildId: string, userId: string) {
    await pool.execute(
        'INSERT IGNORE INTO users (guild_id, user_id) VALUES (?, ?)',
        [guildId, userId]
    );

    const [rows]: any = await pool.execute(
        'SELECT * FROM users WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
    );

    return rows[0];
}

// 전용 채널 설정 업데이트 함수
export async function setDedicatedChannel(guildId: string, channelId: string) {
    await pool.execute(`
        INSERT INTO guild_settings (guild_id, dedicated_channel_id)
        VALUES(?, ?)
        ON DUPLICATE KEY UPDATE dedicated_channel_id = ?
    `,
    [guildId, channelId, channelId]
    );
}

// 전용 채널 ID 가져오는 함수
export async function getDedicatedChannel(guildId: string) : Promise<string | null> {
    const [rows]: any = await pool.execute(
        'SELECT dedicated_channel_id FROM guild_settings WHERE guild_id = ?',
        [guildId]
    );

    return rows.length > 0 ? rows[0].dedicated_channel_id : null;
}

// 서버별 상위 5명 랭킹 정보를 가져오는 함수
export async function getRanking(guildId: string) {
    const [rows]: any = await pool.execute(
        `SELECT user_id, level, last_level_up_at
        FROM users
        WHERE guild_id = ?
        ORDER BY level DESC, last_level_up_at ASC
        LIMIT 5`,
        [guildId]
    );

    return rows;
}

// 메이플 알림 전용 채널을 지정하는 함수
export async function setMapleChannel(guildId: string, channelId: string) {
    await pool.execute(`
        INSERT INTO guild_maple (guild_id, maple_channel_id)
        VALUES(?, ?)
        ON DUPLICATE KEY UPDATE maple_channel_id = ?
    `, [guildId, channelId, channelId]);
}

// 메이플 썬데이 알림 허용/거부 상태를 변경하는 함수
export async function setMapleNoti(guildId: string, isEnabled: boolean) {
    await pool.execute(`
        INSERT INTO guild_maple (guild_id, maple_noti_enabled)
        VALUES(?, ?)
        ON DUPLICATE KEY UPDATE maple_noti_enabled = ?
    `, [guildId, isEnabled, isEnabled]);
}

// 메이플 전용 채널 ID 가져오는 함수 (채널 설정 여부 확인용)
export async function getMapleChannel(guildId: string): Promise<string | null> {
    const [rows]: any = await pool.execute(
        'SELECT maple_channel_id FROM guild_maple WHERE guild_id = ?',
        [guildId]
    );

    return rows.length > 0 ? rows[0].maple_channel_id : null;
}

export default pool;