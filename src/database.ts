import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// .env DISCORD_TOKEN 검사
if (!process.env.DB_HOST) throw new Error("DB_HOST 토큰 값이 존재하지 않습니다.");
if (!process.env.MYSQL_USER) throw new Error("MYSQL_USER 토큰 값이 존재하지 않습니다.");
if (!process.env.DB_USER_PASSWORD) throw new Error("DB_USER_PASSWORD 토큰 값이 존재하지 않습니다.");
if (!process.env.MYSQL_DATABASE) throw new Error("MYSQL_DATABASE 토큰 값이 존재하지 않습니다.");

// 커넥션 풀 생성
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.DB_USER_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 테이블이 없을 경우 테이블 생성하는 함수
export async function initDatabase() {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            guild_id VARCHAR(20) NOT NULL,
            user_id VARCHAR(20) NOT NULL,
            level INT UNSIGNED DEFAULT 0,
            failure_count INT UNSIGNED DEFAULT 0,
            point BIGINT UNSIGNED DEFAULT 0,
            consecutive_days INT UNSIGNED DEFAULT 0,
            last_attendance_date DATE DEFAULT NULL,
            PRIMARY KEY (guild_id, user_id)
        );
    `;
    await pool.execute(sql);
    console.log('데이터베이스 테이블 확인 완료');
}

// 유저 데이터 가져오기 (없을 경우 생성)
export async function getUser(guildId: string, userId: string) {
    await pool.execute(
        'INSERT IGNORE INTO users (guild_id, user_id) VALUSES (?, ?)',
        [guildId, userId]
    );

    const [rows]: any = await pool.execute(
        'SELECT * FROM users WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
    );

    return rows[0];
}

export default pool;