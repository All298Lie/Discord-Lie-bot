import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import pool, { getUser } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('출석')
        .setDescription('출석체크를 하고 포인트를 받습니다.'),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId!;
        const userId = interaction.user.id;

        // 유저 정보를 DB에서 가져오기
        const user = await getUser(guildId, userId);
        
        // 날짜 불러오기
        const today = new Date();
        const lastDate = user.last_attendance_date ? new Date(user.last_attendance_date) : null;

        // 날짜 비교
        const todayStr = today.toISOString().split('T')[0];
        const lastDateStr = lastDate ? lastDate.toISOString().split('T')[0] : '';

        // A. 오늘 출석을 이미 한 경우
        if (todayStr === lastDateStr) {
            return interaction.reply({
                content: '이미 오늘은 출석하였습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }
        
        // 보상 계산
        const dayOfWeek = today.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        let reward = isWeekend ? 10000 : 5000;

        // 어제 날짜 계산하기
        const yesterday = new Date(today);
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
                last_attenance_date = ?
            WHERE guild_id = ? AND user_id =?
            `,
            [totalPoint, newStreak, todayStr, guildId, userId]
        );

        // B. 출석을 한 경우
        return interaction.reply(
            `📅**출석 체크 완료**\n` +
            `- 출석 보상 : ${reward.toLocaleString()} P (${isWeekend} ? '주말' : '평일')\n` +
            (bonus > 0 ? `- 🔥 연속 ${newStreak}일 보너스 : +${bonus.toLocaleString()} P\n\n` : '\n') +
            `- 총 획득 : **${totalPoint.toLocaleString()} P**`
        );
    }
};