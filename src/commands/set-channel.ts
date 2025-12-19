import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { setDedicatedChannel } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('채널지정')
        .setDescription('봇 명령어를 사용할 수 있는 전용 채팅 채널을 설정합니다.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // 관리자만 사용 가능

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId!;

        const currentChannelId = interaction.channelId;
        const currentChannel = interaction.channel as TextChannel;

        // DB 업데이트
        await setDedicatedChannel(guildId, currentChannelId);

        // A. 전용 채널 지정
        await interaction.reply({
            content: `✅ 이제 봇 명령어는 **${currentChannel?.name || '현재'}** 채널에서만 사용할 수 있습니다.`
        });
    }
};