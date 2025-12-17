import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import pool, { getUser, getDedicatedChannel } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('랜덤박스')
        .setDescription('포인트를 사용하여 대박을 노려보세요!')
        .addIntegerOption(option => 
            option.setName('단계')
                .setDescription('구매할 박스 단계 (1단계 [500P], 2단계 [5,000P], 3단계 [50,000P])')
                .setRequired(true)
                .addChoices(
                    { name: '1', value: 1 },
                    { name: '2', value: 2 },
                    { name: '3', value: 3 },
                )
        ),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const tier = interaction.options.getInteger('단계', true);
        const costs = { 1: 500, 2: 5000, 3: 50000 };
        const cost = costs[tier as 1 | 2 | 3];

        const guildId = interaction.guildId!;
        const userId = interaction.user.id;
        const user = await getUser(guildId, userId);
        
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

        // C. 랜덤박스를 구매하는데 필요한 비용이 모자른 경우
        if (BigInt(user.point) < BigInt(cost)) {
            return interaction.reply({
                content: '포인트가 부족합니다!',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // 확률 로직 (누적 확률 사용)
        const rand = Math.random() * 100; // 0.0 ~ 100.0
        let multiplier = 0;

        if (rand < 45) multiplier = 0.5; // 45% (0~45) : x0.5
        else if (rand < 70) multiplier = 0.8; // 25% (45~70) : x0.8
        else if (rand < 85) multiplier = 1.0; // 15% (70~85) : x1.0
        else if (rand < 95) multiplier = 1.2; // 10% (85~95) : x1.2
        else if (rand < 98) multiplier = 2.0; // 3% (95~98) : x2.0
        else if (rand < 99.5) multiplier = 5.0; // 1.5% (98~99.5) : x5.0
        else multiplier = 10.0; // 0.5% (99.5~100) : x10.0

        const reward = Math.floor(cost * multiplier);
        const profit = reward - cost; // 순수익

        // DB 업데이트
        await pool.execute(
            `
            UPDATE users SET
            point = point + ?
            WHERE guild_id = ? AND user_id = ?
            `,
            [profit, guildId, userId]
        );

        let emoji = '😐';
        if (multiplier < 1) emoji = '😭';
        if (multiplier >= 2) emoji = '🎉';
        if (multiplier >= 10) emoji = '💎';

        // D. 랜덤박스 결과 출력
        return interaction.reply(
            `🎁 **랜덤박스 결과** (${multiplier}배)\n` +
            `${emoji} ${reward.toLocaleString()} P를 획득했습니다!`
        );
    },
};