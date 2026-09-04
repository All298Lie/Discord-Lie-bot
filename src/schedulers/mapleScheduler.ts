import cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import pool from '../database.js'; // 경로에 맞게 수정해주세요
import { getEventNoticeList, getEventNoticeDetail, extractImageUrl } from '../utils/mapleApi.js';

let retryTimeout: NodeJS.Timeout | null = null;

export function initMapleScheduler(client: Client) {
    // 매주 금요일 오전 10시 실행 (한국 시간 기준)
    cron.schedule('0 10 * * 5', () => {
        console.log("🔍 금요일 10시: 썬데이 메이플 탐색을 시작합니다.");
        attemptFetchSundayMaple(client);
    }, { timezone: 'Asia/Seoul' });

    // 매주 일요일 오후 11시 59분 삭제 (한국 시간 기준)
    cron.schedule('59 23 * * 0', async () => {
        try {
            await pool.execute('TRUNCATE TABLE sunday_maple');
            console.log("🗑️ 썬데이 메이플 데이터 폐기 완료.");
        } catch (error) {
            console.error("데이터 폐기 중 오류 발생:", error);
        }
    }, { timezone: 'Asia/Seoul' });
}

async function attemptFetchSundayMaple(client: Client) {
    try {
        const listData = await getEventNoticeList();
        const sundayEvent = listData.event_notice.find((n: any) => n.title.includes('썬데이 메이플'));

        if (!sundayEvent) {
            throw new Error("목록에 썬데이 메이플이 아직 없습니다.");
        }

        const detailData = await getEventNoticeDetail(sundayEvent.notice_id);
        const imageUrl = extractImageUrl(detailData.contents);

        // 데이터베이스에 저장
        await pool.execute(
            `INSERT INTO sunday_maple (notice_id, title, url, image_url) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE title=?, url=?, image_url=?`,
            [sundayEvent.notice_id, sundayEvent.title, sundayEvent.url, imageUrl, 
             sundayEvent.title, sundayEvent.url, imageUrl]
        );

        console.log("✅ 썬데이 메이플 데이터를 성공적으로 저장했습니다.");

        // 서버 알림 전송
        await broadcastSundayMaple(client, sundayEvent.title, sundayEvent.url, imageUrl);

    } catch (error) {
        console.error(`⚠️ 탐색 실패 (${(error as Error).message}). 1분 후 재시도합니다...`);
        // 재시도 로직 (1분 후 다시 자기 자신 호출)
        retryTimeout = setTimeout(() => attemptFetchSundayMaple(client), 60 * 1000);
    }
}
async function broadcastSundayMaple(client: Client, title: string, url: string, imageUrl: string | null) {
    try {
        // guild_maple 테이블에서 알람이 활성화된 채널 정보만 조회
        const [rows]: any = await pool.execute(
            `SELECT maple_channel_id
            FROM guild_maple
            WHERE maple_noti_enabled = TRUE
                AND maple_channel_id IS NOT NULL
            `
        );

        const embed = new EmbedBuilder()
            .setTitle(`🍁 ${title}`)
            .setURL(url)
            .setColor(0xFFA500)
            .setTimestamp();

        if (imageUrl) embed.setImage(imageUrl);

        let sendCount = 0;
        for (const row of rows) {
            try {
                const channel = await client.channels.fetch(row.maple_channel_id) as TextChannel;
                if (channel) {
                    await channel.send({ embeds: [embed] });
                    sendCount++;
                }
            } catch (e) {
                // 채널을 찾을 수 없거나 권한 부족 시 무시
            }
        }
        console.log(`📢 총 ${sendCount}개 채널에 썬데이 메이플 알림 전송 완료.`);
    } catch (error) {
        console.error("알림 브로드캐스팅 중 오류:", error);
    }
}