import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { setDedicatedChannel, getDedicatedChannel } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('채널지정')
        .setDescription('봇 명령어를 사용할 수 있는 전용 채팅 채널을 설정합니다.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // 관리자만 사용 가능
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('전용으로 사용할 채널을 선택하세요.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.options.getChannel('channel', true);
        const guildId = interaction.guildId!;

        // DB 업데이트
        await setDedicatedChannel(guildId, channel.id);

        // A. 전용 채널 지정
        await interaction.reply({
            content: `✅ 이제 봇 명령어는 **${channel.name}** 채널에서만 사용할 수 있습니다.`,
            flags: [MessageFlags.Ephemeral] 
        });
    }
};