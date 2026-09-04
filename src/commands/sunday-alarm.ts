import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { setMapleNoti, getMapleChannel } from '../database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('썬데이알림')
        .setDescription('매주 금요일 썬데이 메이플 이벤트 자동 알림을 켜거나 끕니다.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('설정')
                .setDescription('알림 수신 여부를 선택하세요.')
                .setRequired(true)
                .addChoices(
                    { name: '허용 (ON)', value: 'allow' },
                    { name: '거부 (OFF)', value: 'deny' }
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId!;

        // 1. 메이플 채널이 설정되어 있는지 사전 검사
        const currentMapleChannel = await getMapleChannel(guildId);
        
        if (!currentMapleChannel) {
            // 채널이 없으면 경고 메시지를 보내고 명령어 종료 (ephemeral: true로 본인에게만 보이게 설정)
            return interaction.reply({
                content: '⚠️ 메이플 알림 채널이 설정되지 않았습니다. 먼저 `/채널지정 타입:메이플` 명령어를 사용해 채널을 지정해 주세요.',
                ephemeral: true 
            });
        }
        
        // 2. 채널이 존재할 경우에만 상태 변경 진행
        const setting = interaction.options.getString('설정');
        const isEnabled = setting === 'allow'; 

        await setMapleNoti(guildId, isEnabled);

        const statusText = isEnabled ? '🟢 허용 (ON)' : '🔴 거부 (OFF)';
        await interaction.reply({
            content: `🍁 서버의 썬데이 메이플 알림이 **${statusText}** 상태로 변경되었습니다.`
        });
    }
};