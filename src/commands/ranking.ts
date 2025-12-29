import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getRanking } from '../database.js'; // ⚠️ 사용하시는 DB 연결 객체 경로로 수정하세요!

export default {
    data: new SlashCommandBuilder()
        .setName('랭킹')
        .setDescription('서버의 레벨 랭킹 TOP 5를 확인합니다.'),

    async execute(interaction: ChatInputCommandInteraction) {
        // A. 서버에서 명령어를 입력하지 않은 경우
        if (!interaction.guildId) {
            await interaction.reply('이 명령어는 서버에서만 사용할 수 있습니다.');
            return;
        }

        await interaction.deferReply();

        try {
            const rows = await getRanking(interaction.guildId);

            let rankingDescription = '';
            
            for (let i = 0; i < 5; i++) {
                const rank = i + 1;
                const userData = rows[i];

                if (userData) { // 유저가 존재할 경우
                    let rankIcon = `${rank}등`;
                    if (rank === 1) rankIcon = '🥇';
                    if (rank === 2) rankIcon = '🥈';
                    if (rank === 3) rankIcon = '🥉';

                    rankingDescription += `${rankIcon} : <@${userData.id}> (Lv. ${userData.level})\n`;
                } else {
                    rankingDescription += `${rank}등 : -\n`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('🏆 서버 레벨 랭킹 TOP 5')
                .setColor(0xFFD700) // 금색
                .setDescription(rankingDescription)
                .setFooter({ 
                    text: `요청자: ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })

            // 불러온 유저 순위를 임베드 형태로 출력
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);

            // B. 랭킹을 불러오는 도중 오류가 발생한 경우
            await interaction.editReply('랭킹을 불러오는 도중 오류가 발생했습니다.');
        }
    },
};