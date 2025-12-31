import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, GuildMember, EmbedBuilder } from 'discord.js';
import pool, { getUser, getDedicatedChannel } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('출석')
        .setDescription('출석체크를 하고 포인트를 받습니다.'),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // A. 서버에서 명령어를 입력하지 않은 경우
        if (!guildId) {
            await interaction.editReply('이 명령어는 서버에서만 사용할 수 있습니다.');
            return;
        }

        const currentChannelId = interaction.channelId;
        const dedicatedChannelId = await getDedicatedChannel(guildId);

        // B. 전용 채널이 설정되지 않은 경우
        if (!dedicatedChannelId) {
             return interaction.editReply({
                content: '🚫 아직 봇 사용 전용 채널이 설정되지 않았습니다. 관리자가 먼저 설정해야 합니다.'
            });
        }

        // C. 전용 채널에 입력하지 않은 경우
        if (dedicatedChannelId !== currentChannelId) {
            return interaction.editReply({
                content: `🚫 이 명령어는 <#${dedicatedChannelId}> 채널에서만 사용할 수 있습니다.`
            });
        }

        // 유저 정보를 DB에서 가져오기
        const user = await getUser(guildId, userId);

        const now = new Date();

        // 한국시간 기준 오늘 날짜 문자열
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

        // 한국시간 기준 요일 계산을 위해 사용할 Date 불러오기
        const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const dayOfWeek = kstDate.getDay();

        // 한국시간 기준 어제 날짜 계산
        const yesterdayDate = new Date(kstDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

        // 마지막 출석일 불러오기
        let lastDateStr = '';
        if (user.last_attendance_date) {
            const dbDate = new Date(user.last_attendance_date);
            lastDateStr = dbDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        }

        // D. 오늘 출석을 이미 한 경우
        if (todayStr === lastDateStr) {
            return interaction.reply({
                content: '이미 오늘은 출석하였습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }
        
        // 평일/주간 보상 계산
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        let reward = isWeekend ? 10000 : 5000;

        // 서버 부스트 여부 계산
        const member = interaction.member as GuildMember;
        let boost = 0;
        let isBooster = false;
        let boostMonths = 0;

        if (member && member.premiumSince) {
            isBooster = true;

            const now = new Date();
            const boostStart = member.premiumSince;
            const diffTime = now.getTime() - boostStart.getTime();

            const oneMonthInMs = 30 * 24 * 60 * 60 * 1000;

            boostMonths = Math.floor(diffTime / oneMonthInMs);

            // 기본 50 + (개월 수  * 50)
            boost = 50 + (boostMonths * 50);
        }
        
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

        const totalPoint = reward + boost + bonus;

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

        const embed = new EmbedBuilder()
            .setTitle('📅 출석 체크 완료!')
            .setColor(isWeekend ? 0xFF69B4 : 0x00FF00) // 주말이면 핫핑크, 평일이면 초록
            .setThumbnail(interaction.user.displayAvatarURL()) // 유저 프사 표시
            .addFields(
                { 
                    name: '기본 보상', 
                    value: `${reward.toLocaleString()} P (${isWeekend ? '주말 🏖️' : '평일 🏢'})`, 
                    inline: true 
                },
                { 
                    name: '연속 출석', 
                    value: `${newStreak}일차 🔥 ${bonus > 0 ? `(+${bonus.toLocaleString()} P)` : ''}`, 
                    inline: true 
                }
            );

        // 부스트 보너스가 있을 때만 필드 추가
        if (isBooster) {
            embed.addFields({
                name: '🚀 서버 부스트 보너스',
                value: `+${boost.toLocaleString()} P (${boostMonths}개월 차)`,
                inline: false
            });
        }

        // 총 획득 포인트 강조
        embed.addFields({
            name: '💰 총 획득 포인트',
            value: `**+${totalPoint.toLocaleString()} P**`,
            inline: false
        });

        embed.setFooter({ text: `${interaction.user.username}님의 현재 포인트가 갱신되었습니다.` });
        embed.setTimestamp();

        // E. 출석을 한 경우
        return interaction.editReply({ embeds: [embed] });
    }
};