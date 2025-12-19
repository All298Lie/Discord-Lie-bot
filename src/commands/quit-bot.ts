import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { voiceSessions } from '../botState.js';
import { getDedicatedChannel } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('퇴장')
        .setDescription('현재 봇이 접속 중인 통화방에서 퇴장합니다.'),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const connection = getVoiceConnection(interaction.guildId!);
        const guildId = interaction.guildId!;

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

        // C. 봇이 음성 채널에 접속 중이지 않을 경우
        if (!connection) {
            return interaction.reply({
                content: '봇이 현재 음성 채널에 들어가있지 않습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const member = interaction.member as GuildMember;
        const isAdminUser = member.permissions.has(PermissionFlagsBits.Administrator);
        const session = voiceSessions.get(guildId);

        // D. 관리자 세션 상태의 봇을 권한이 없는 유저가 퇴장 시도할 경우
        if (session?.isAdmin && !isAdminUser) {
            return interaction.reply({
                content: '🔒 현재 관리자 권한으로 봇이 사용 중입니다. 관리자만 퇴장시킬 수 있습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // E. 봇이 음성 채널에 접속 중일 경우
        connection.destroy();
        voiceSessions.delete(guildId);

        return interaction.reply('음성 채널에서 퇴장했습니다.');
    }
};