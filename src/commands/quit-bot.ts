import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('퇴장')
        .setDescription('현재 봇이 접속 중인 통화방에서 퇴장합니다.'),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const connection = getVoiceConnection(interaction.guildId!);

        // A. 봇이 음성 채널에 접속 중이지 않을 경우
        if (!connection) {
            return interaction.reply({
                content: '봇이 현재 음성 채널에 들어가있지 않습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // B. 봇이 음성 채널에 접속 중일 경우
        connection.destroy();

        return interaction.reply('음성 채널에서 퇴장했습니다.');
    }
};