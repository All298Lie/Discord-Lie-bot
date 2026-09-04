import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { setDedicatedChannel, setMapleChannel } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('채널지정')
        .setDescription('봇 관련 기능이 작동할 전용 채팅 채널을 설정합니다.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // 관리자 전용
        .addStringOption(option => 
            option.setName('타입')
                .setDescription('어떤 채널을 설정할지 선택하세요.')
                .setRequired(true)
                .addChoices(
                    { name: '라이봇 (기본 명령어 채널)', value: 'main' },
                    { name: '메이플 (알림 전용 채널)', value: 'maple' }
                )
        ),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId!;
        const currentChannelId = interaction.channelId;
        const currentChannel = interaction.channel as TextChannel;
        
        // 유저가 선택한 타입 ('main' 또는 'maple') 가져오기
        const type = interaction.options.getString('타입');

        if (type === 'main') {
            await setDedicatedChannel(guildId, currentChannelId);
            await interaction.reply({
                content: `✅ 이제 라이봇 기본 명령어는 **${currentChannel?.name || '현재'}** 채널에서 주로 작동합니다.`
            });
        } 
        else if (type === 'maple') {
            await setMapleChannel(guildId, currentChannelId);
            await interaction.reply({
                content: `🍁 이제 메이플 관련 알림은 **${currentChannel?.name || '현재'}** 채널로 전송됩니다.\n(알림을 켜려면 \`/썬데이알림 허용\` 명령어를 사용해주세요)`
            });
        }
    }
};