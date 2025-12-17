import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import pool, { getUser, getDedicatedChannel } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('출석')
        .setDescription('출석체크를 하고 포인트를 받습니다.'),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId!;
        const userId = interaction.user.id;

        const currentChannelId = interaction.channelId;
        const dedicatedChannelId = await getDedicatedChannel(guildId);

        // A. 전용 채널이 설정되지 않은 경우
        if (!dedicatedChannelId) {
             return interaction.reply({
                content: '🚫 아직 봇 사용 전용 채널이 설정되지 않았습니다. 관리자가 먼저 설정해야 합니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // B. 전용 채널에 입력하지 않은 경우
        if (dedicatedChannelId !== currentChannelId) {
            return interaction.reply({
                content: `🚫 이 명령어는 <#${dedicatedChannelId}> 채널에서만 사용할 수 있습니다.`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        // 유저 정보를 DB에서 가져오기
        const user = await getUser(guildId, userId);
        
        // KST 시간(+09:00) 계산 오프셋
        const kstOffset = 9 * 60 * 60 * 1000;

        // 한국시간 기준 오늘 날짜 불러오기
        const now = new Date(); // YYYY-MM-DDThh:mm:ss.msZ (밀리초 단위 3자리)
        const kstNow = new Date(now.getTime() + kstOffset);
        const todayStr = kstNow.toISOString().split('T')[0];

        // 마지막 출석일 불러오기
        let lastDateStr = '';
        if (user.last_attendance_date) {
            const lastDate = new Date(user.last_attendance_date);
            const kstLastDate = new Date(lastDate.getTime() + kstOffset)
            lastDateStr = kstLastDate.toISOString().split('T')[0]!;
        }

        // C. 오늘 출석을 이미 한 경우
        if (todayStr === lastDateStr) {
            return interaction.reply({
                content: '이미 오늘은 출석하였습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }
        
        // 보상 계산
        const dayOfWeek = kstNow.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        let reward = isWeekend ? 10000 : 5000;

        // 어제 날짜 계산하기
        const yesterday = new Date(kstNow);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = 1;

        // 연속 출석 계산을 위해 전날과 DB에 저장된 마지막 출석일 비교
        if (lastDateStr === yesterdayStr) {
            newStreak = user.consecutive_days + 1;
        }
        
        // 5일 연속으로 출석체크 중일 경우
        let bonus = 0;
        if (newStreak % 5 === 0) {
            bonus = newStreak * 500;
        }

        const totalPoint = reward + bonus;

        // DB에 갱신
        await pool.execute(
            `
            UPDATE users SET
                point = point + ?,
                consecutive_days = ?,
                last_attendance_date = ?
            WHERE guild_id = ? AND user_id =?
            `,
            [totalPoint, newStreak, todayStr, guildId, userId]
        );

        // D. 출석을 한 경우
        return interaction.reply(
            `📅**출석 체크 완료**\n` +
            `- 출석 보상 : ${reward.toLocaleString()} P (${isWeekend ? '주말' : '평일'})\n` +
            (bonus > 0 ? `- 🔥 연속 ${newStreak}일 보너스 : +${bonus.toLocaleString()} P\n\n` : '\n') +
            `- 총 획득 : **${totalPoint.toLocaleString()} P**`
        );
    }
};