import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { getUser, getDedicatedChannel } from '../database.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('정보')
        .setDescription('유저의 정보(레벨, 포인트 등)를 확인합니다.')
        .addUserOption(option => 
            option.setName('유저')
                .setDescription('정보를 확인할 유저를 선택하세요. (비워두면 내 정보 확인)')
                .setRequired(false)
        ),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
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
        
        // 확인할 유저
        const targetUser = interaction.options.getUser('유저') || interaction.user;

        // 서버에서 유저 탐색
        const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

        // DB에서 유저 정보 불러오기
        let userData = await getUser(guildId, targetUser.id);

        // DB에 없을 경우, 기본 값 설정
        if (!userData) {
            userData = { point: 0, level: 1 };
        }

        // 임베드에 사용할 변수
        const serverNick = member?.nickname || targetUser.globalName || targetUser.username;
        const tag = targetUser.discriminator === '0' ? '' : `#${targetUser.discriminator}`;
        const fullUsername = `${targetUser.username}${tag}`;

        let joinDateStr = '알수없음';
        if (member?.joinedTimestamp) {
            const ts = Math.floor(member.joinedTimestamp / 1000); // 밀리초 -> 초 변환

            joinDateStr = `<t:${ts}:D> (<t:${ts}:R>)`;
        }

        // 임베드(Embed) 생성
        const embed = new EmbedBuilder()
            .setColor(0x00FF00) // 초록색 (원하는 색상 코드 사용 가능)
            .setTitle(`📋 ${targetUser.username}님의 정보`)
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 })) // 프로필 사진 (우측 상단)
            .setDescription(
                `🏷️ **서버 닉네임** ${serverNick}\n` +
                `👤 **닉네임** ${fullUsername}\n` +
                `📅 **서버 가입일** ${joinDateStr}`
            )
            .addFields(
                { name: '\u200B', value: '\u200B', inline: false }, // 빈 줄 추가 (간격 띄우기)
                { name: '📊 레벨', value: `**${userData.level ?? 1} Lv**`, inline: true },
                { name: '💰 포인트', value: `**${(userData.point ?? 0).toLocaleString()} P**`, inline: true }
            )
            .setFooter({ 
                text: `요청자: ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp(); // 현재 시간 표시

        // A. 임베드로 정보 출력
        await interaction.reply({ embeds: [embed] });
    }
};