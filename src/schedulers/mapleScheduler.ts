import cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import pool from '../database.js'; // 경로에 맞게 수정해주세요
import { getEventNoticeList, getEventNoticeDetail, extractImageUrl } from '../utils/mapleApi.js';

let retryTimeout: NodeJS.Timeout | null = null;

// 봇이 켜질 때 즉시 실행할 상태 검증 함수
async function checkBootTimeState(client: Client) {
    const now = new Date();
    const kstTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = kstTime.getDay();
    const hour = kstTime.getHours();

    const isFetchPeriod = (day === 5 && hour >= 10) || day === 6 || day === 0;

    try {
        if (isFetchPeriod) {
            const [rows]: any = await pool.execute('SELECT COUNT(*) as cnt FROM sunday_maple');
            if (rows[0].cnt === 0) {
                console.log("🔍 [부팅 검사] 기간 내이나 데이터가 비어있습니다. 조용히 데이터를 가져옵니다.");
                // 두 번째 인자로 false를 전달하여 알림을 생략합니다.
                await attemptFetchSundayMaple(client, false); 
            } else {
                console.log("✅ [부팅 검사] 썬데이 메이플 데이터가 정상적으로 존재합니다.");
            }
        } else {
            await pool.execute('TRUNCATE TABLE sunday_maple');
            console.log("🧹 [부팅 검사] 탐색 기간이 아니므로 썬데이 메이플 데이터를 비웁니다.");
        }
    } catch (error) {
        console.error("부팅 검사 중 오류 발생:", error);
    }
}

// 봇 로그인 직후 index.ts에서 호출되는 함수
export async function initMapleScheduler(client: Client) {
    await checkBootTimeState(client);

    // 매주 금요일 오전 10시 정기 실행
    cron.schedule('0 10 * * 5', () => {
        console.log("🔍 금요일 10시: 썬데이 메이플 탐색을 시작합니다.");
        // 정기 실행 시에는 알림을 보냅니다 (기본값 true).
        attemptFetchSundayMaple(client, true);
    }, { timezone: 'Asia/Seoul' });

    // 매주 일요일 오후 11시 59분 삭제
    cron.schedule('59 23 * * 0', async () => {
        try {
            await pool.execute('TRUNCATE TABLE sunday_maple');
            console.log("🗑️ 썬데이 메이플 정기 데이터 폐기 완료.");
        } catch (error) {
            console.error("데이터 폐기 중 오류 발생:", error);
        }
    }, { timezone: 'Asia/Seoul' });
}

// shouldBroadcast 매개변수 추가 (기본값 true)
async function attemptFetchSundayMaple(client: Client, shouldBroadcast: boolean = true) {
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

        // shouldBroadcast가 true일 때만 알림 전송 로직 실행
        if (shouldBroadcast) {
            await broadcastSundayMaple(client, sundayEvent.title, sundayEvent.url, imageUrl);
        } else {
            console.log("🔇 부팅 복구로 인한 실행이므로 채팅 알림은 생략합니다.");
        }

    } catch (error) {
        console.error(`⚠️ 탐색 실패 (${(error as Error).message}). 1분 후 재시도합니다...`);
        // 재시도 시에도 알림 여부(shouldBroadcast)를 그대로 전달하여 일관성 유지
        retryTimeout = setTimeout(() => attemptFetchSundayMaple(client, shouldBroadcast), 60 * 1000);
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
                // 무시
            }
        }
        console.log(`📢 총 ${sendCount}개 채널에 썬데이 메이플 알림 전송 완료.`);
    } catch (error) {
        console.error("알림 브로드캐스팅 중 오류:", error);
    }
}