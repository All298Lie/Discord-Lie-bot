import cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import pool from '../database.js'; // 경로에 맞게 수정해주세요
import { getEventNoticeList, getEventNoticeDetail, extractImageUrl } from '../utils/mapleApi.js';

let retryTimeout: NodeJS.Timeout | null = null;

// 봇이 켜질 때 즉시 실행할 상태 검증 함수
async function checkBootTimeState(client: Client) {
    const now = new Date();
    // 안전하게 한국 시간(KST) 객체로 변환
    const kstTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = kstTime.getDay(); // 0(일) ~ 6(토)
    const hour = kstTime.getHours();

    // 금요일(5) 10시 이후, 토요일(6), 일요일(0)인지 확인
    const isFetchPeriod = (day === 5 && hour >= 10) || day === 6 || day === 0;

    try {
        if (isFetchPeriod) {
            const [rows]: any = await pool.execute('SELECT COUNT(*) as cnt FROM sunday_maple');
            if (rows[0].cnt === 0) {
                console.log("🔍 [부팅 검사] 기간 내이나 데이터가 비어있습니다. 즉시 탐색을 시작합니다.");
                await attemptFetchSundayMaple(client);
            } else {
                console.log("✅ [부팅 검사] 썬데이 메이플 데이터가 정상적으로 존재합니다.");
            }
        } else {
            // 그 외의 시간 (월~목, 금 오전 10시 이전)
            await pool.execute('TRUNCATE TABLE sunday_maple');
            console.log("🧹 [부팅 검사] 탐색 기간이 아니므로 썬데이 메이플 데이터를 비웁니다.");
        }
    } catch (error) {
        console.error("부팅 검사 중 오류 발생:", error);
    }
}

// 봇 로그인 직후 index.ts에서 호출되는 함수
export async function initMapleScheduler(client: Client) {
    // 1. 부팅 시점에 누락된 데이터가 있는지 먼저 검사
    await checkBootTimeState(client);

    // 2. 매주 금요일 오전 10시 정기 실행 (한국 시간 기준)
    cron.schedule('0 10 * * 5', () => {
        console.log("🔍 금요일 10시: 썬데이 메이플 탐색을 시작합니다.");
        attemptFetchSundayMaple(client);
    }, { timezone: 'Asia/Seoul' });

    // 3. 매주 일요일 오후 11시 59분 삭제 (한국 시간 기준)
    cron.schedule('59 23 * * 0', async () => {
        try {
            await pool.execute('TRUNCATE TABLE sunday_maple');
            console.log("🗑️ 썬데이 메이플 정기 데이터 폐기 완료.");
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

        await pool.execute(
            `INSERT INTO sunday_maple (notice_id, title, url, image_url) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE title=?, url=?, image_url=?`,
            [sundayEvent.notice_id, sundayEvent.title, sundayEvent.url, imageUrl, 
             sundayEvent.title, sundayEvent.url, imageUrl]
        );

        console.log("✅ 썬데이 메이플 데이터를 성공적으로 저장했습니다.");

        await broadcastSundayMaple(client, sundayEvent.title, sundayEvent.url, imageUrl);

    } catch (error) {
        console.error(`⚠️ 탐색 실패 (${(error as Error).message}). 1분 후 재시도합니다...`);
        retryTimeout = setTimeout(() => attemptFetchSundayMaple(client), 60 * 1000);
    }
}

async function broadcastSundayMaple(client: Client, title: string, url: string, imageUrl: string | null) {
    try {
        const [rows]: any = await pool.execute(
            'SELECT maple_channel_id FROM guild_maple WHERE maple_noti_enabled = TRUE AND maple_channel_id IS NOT NULL'
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
                // 채널을 찾을 수 없거나 권한 부족
            }
        }
        console.log(`📢 총 ${sendCount}개 채널에 썬데이 메이플 알림 전송 완료.`);
    } catch (error) {
        console.error("알림 브로드캐스팅 중 오류:", error);
    }
}