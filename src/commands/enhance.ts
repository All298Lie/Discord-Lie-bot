import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import pool, { getUser, getDedicatedChannel } from '../database.js';

// 로그 함수 기반 강화 확률 계산 함수
function calculateChance(level: number): number {
    const calculatedChance = 100 - (15.3 * Math.log(level));

    // 최소치 5%
    return Math.max(5, Math.floor(calculatedChance));
}

// 레벨별 천장 횟수 계산 함수
function getPityMax(level: number): number {
    if (level < 50) return 10;
    if (level < 150) return 20;
    if (level < 300) return 30;
    if (level < 450) return 40;
    return 50;
}

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('강화')
        .setDescription('포인트를 사용하여 캐릭터 레벨을 강화합니다. 비용 1,000 P'),

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

        const user = await getUser(guildId, userId);
        const MAX_LEVEL = 500;

        // 캐릭터 레벨이 만렙일 경우
        if (user.level >= MAX_LEVEL) {
            return interaction.reply({
                content: `이미 최고 레벨(**Lv.${MAX_LEVEL}**)에 도달하여 강화할 수 없습니다.`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        // 강화 비용
        const cost = 1000;
        
        // C. 강화에 필요한 비용이 모자를 경우
        if (BigInt(user.point) < BigInt(cost)) {
            return interaction.reply({ 
                content: '포인트가 부족합니다!',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // 천장 체크 및 강화 확률 계산
        const currentLevel = user.level;
        const successChance = calculateChance(currentLevel);
        const maxFailures = getPityMax(currentLevel);
        
        let isSuccess = false;
        let isPity = false;

        if (user.failure_count + 1 >= maxFailures) {
            isSuccess = true;
            isPity = true;
        } else {
            const random = Math.random() * 100;
            if (random < successChance) {
                isSuccess = true;
            }
        }

        // DB 업데이트 준비
        let newLevel = user.level;
        let newFailCount = user.failure_count;
        
        if (isSuccess) {
            newLevel += 1;
            newFailCount = 0; // 성공 시 실패 횟수 초기화
        } else {
            newFailCount += 1;
        }

        // DB 업데이트
        await pool.execute(
            `
            UPDATE users SET
            point = point - ?,
            level = ?,
            failure_count = ?
            WHERE guild_id = ? AND user_id = ?
            `,
            [cost, newLevel, newFailCount, guildId, userId]
        );

        if (isSuccess) {
            if (newLevel >= MAX_LEVEL) { // D. 최대 레벨에 달성한 경우
                 return interaction.reply(
                    `🎆 **전설의 탄생!** 강화 대성공!\n` +
                    `최고 레벨 **Lv.${MAX_LEVEL}**을 달성하셨습니다! 🏆`
                );
            }

            // E. 강화에 성공한 경우
            return interaction.reply(
                `✨ **강화 성공!** ${isPity ? '(천장 발동🔥)' : ''}\n` +
                `📊 확률: **${successChance}%**\n` +
                `🔼 레벨: ${currentLevel} ➔ **${newLevel}** (+1)`
            );

        } else {
            // F. 강화에 실패한 경우
            return interaction.reply(
                `💥 **강화 실패...**\n` +
                `📊 확률: **${successChance}%**\n` +
                `🔨 누적 실패: ${newFailCount} / ${maxFailures}회 (확정까지 ${maxFailures - newFailCount}회)`
            );
        }
    },
};