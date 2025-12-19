import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    PermissionFlagsBits,
    GuildMember,
    MessageFlags
} from 'discord.js';

export default {
    // 명령어 설정
    data: new SlashCommandBuilder()
        .setName('팀짜기')
        .setDescription('참여 인원을 받아 자동으로 팀을 나눕니다.')
        .addIntegerOption(option => 
            option.setName('팀수')
                .setDescription('나눌 팀의 개수를 입력하세요.')
                .setMinValue(2) // 최소 2팀 이상
                .setMaxValue(20) // 최대 20팀 (안전장치)
                .setRequired(true)
        ),

    // 명령어 실행
    async execute(interaction: ChatInputCommandInteraction) {
        const teamCount = interaction.options.getInteger('팀수', true);
        const organizer = interaction.member as GuildMember; // 주최자

        // 참여자 명단 (중복 방지를 위해 Set 사용)
        const participants = new Set<string>(); 

        // 초기 임베드 생성
        const embed = new EmbedBuilder()
            .setTitle(`📢 팀 짜기 모집 중 (총 ${teamCount}팀)`)
            .setDescription(
                `아래 **[참여하기]** 버튼을 눌러 명단에 등록하세요.\n` +
                `주최자나 관리자가 **[팀 나누기]**를 누르면 마감됩니다.\n\n` +
                `⏳ **제한시간: 5분**`
            )
            .setColor(0x00AAFF) // 하늘색
            .addFields({ name: `참여자 (0명)`, value: '아직 없음' })
            .setFooter({ text: `주최자: ${organizer.displayName}`, iconURL: organizer.user.displayAvatarURL() });

        // 버튼 생성
        const joinBtn = new ButtonBuilder()
            .setCustomId('join_team')
            .setLabel('참여하기')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✋');

        const splitBtn = new ButtonBuilder()
            .setCustomId('split_team')
            .setLabel('팀 나누기')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎲');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinBtn, splitBtn);

        // A. 초기 메세지 전송 및 fetch
        const message = await interaction.reply({ 
            embeds: [embed], 
            components: [row],
            fetchReply: true 
        });

        // 콜렉터 생성 (버튼 클릭 감지, 5분)
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 5 * 60 * 1000 // 5분
        });

        // B. 1분 전 경고 타이머 설정 (4분 뒤 실행)
        const warningTimer = setTimeout(async () => {
            try {
                if (collector.ended) return; // 이미 끝났을 경우, 리턴

                // 이때까지 참여한 인원 명단
                const nameList = Array.from(participants).map(id => `<@${id}>`).join(', ');

                const currentEmbed = EmbedBuilder.from(embed) // 기존 내용 복사
                    .setColor(0xFF0000) // 빨간색 경고
                    .setDescription(
                        `아래 **[참여하기]** 버튼을 눌러 명단에 등록하세요.\n` +
                        `주최자나 관리자가 **[팀 나누기]**를 누르면 마감됩니다.\n\n` +
                        `⚠️ **마감 1분 전입니다! 서둘러 주세요!**`
                    )
                    .setFields([{
                        name: `참여자 (${participants.size}명)`,
                        value: participants.size > 0 ? (nameList.length > 1000 ? `${participants.size}명이 참여 중...` : nameList) : '아직 없음'
                    }]);
                
                await interaction.editReply({ embeds: [currentEmbed] });
            } catch (e) {
                // 메세지가 삭제된 경우 등 무시
            }
        }, 4 * 60 * 1000);

        // 버튼 이벤트 처리
        collector.on('collect', async (i) => {
            if (i.customId === 'join_team') { // [참여하기] 버튼
                // C. 이미 참여했을 경우
                if (participants.has(i.user.id)) {
                    await i.reply({ content: '이미 명단에 등록되었습니다.', flags: [MessageFlags.Ephemeral] });
                    return;
                }

                // 명단 추가
                participants.add(i.user.id);
                
                // 임베드 업데이트 (참여자 목록 갱신)
                const nameList = Array.from(participants).map(id => `<@${id}>`).join(', ');
                
                // 임베드 필드 업데이트
                const fetchedEmbed = await interaction.fetchReply();
                const targetEmbed = fetchedEmbed.embeds[0] ?? embed;
                const newEmbed = EmbedBuilder.from(targetEmbed);
                // 기존 필드 수정
                newEmbed.setFields({ 
                    name: `참여자 (${participants.size}명)`, 
                    value: nameList.length > 1000 ? `${participants.size}명이 참여 중...` : nameList 
                });

                await i.update({ embeds: [newEmbed] });
            }
            else if (i.customId === 'split_team') { // [팀 나누기] 버튼
                const member = i.member as GuildMember;
                const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
                const isOrganizer = i.user.id === organizer.id;

                // D. 팀을 나눌 권한이 없을 경우
                if (!isOrganizer && !isAdmin) {
                    await i.reply({ content: '🚫 주최자나 관리자만 팀을 나눌 수 있습니다.', flags: [MessageFlags.Ephemeral] });
                    return;
                }

                // E. 팀을 나눌 인원이 모자를 경우
                if (participants.size < teamCount) {
                    await i.reply({ 
                        content: `🚫 인원이 부족합니다. 최소 ${teamCount}명은 있어야 팀을 나눌 수 있습니다.`, 
                        flags: [MessageFlags.Ephemeral] 
                    });
                    return;
                }

                // 팀 나누기 로직 실행!
                clearTimeout(warningTimer); // 경고 타이머 해제
                
                // 유저 ID 배열을 랜덤하게 섞음 (피셔-예이츠 셔플)
                const shuffled = Array.from(participants);
                for (let k = shuffled.length - 1; k > 0; k--) {
                    const j = Math.floor(Math.random() * (k + 1));

                    const valueAtK = shuffled[k];
                    const valueAtJ = shuffled[j];

                    if (valueAtK !== undefined && valueAtJ !== undefined) {
                        [shuffled[k], shuffled[j]] = [valueAtJ, valueAtK];
                    }
                }

                // 팀 분배
                const teams: string[][] = Array.from({ length: teamCount }, () => []);
                const leftovers: string[] = [];

                // 인원수를 팀 수로 나누기
                const memberPerTeam = Math.floor(shuffled.length / teamCount);
                
                // 정원만큼 채우기
                let cursor = 0;
                for (let t = 0; t < teamCount; t++) {
                    const currentTeam = teams[t]!;

                    for (let m = 0; m < memberPerTeam; m++) {
                        currentTeam.push(shuffled[cursor] as string);
                        cursor++;
                    }
                }

                // 남는 인원 따로 표시
                while (cursor < shuffled.length) {
                    leftovers.push(shuffled[cursor] as string);
                    cursor++;
                }

                // 결과 임베드 생성
                const resultEmbed = new EmbedBuilder()
                    .setTitle('🎉 팀 배정 결과')
                    .setColor(0x00FF00)
                    .setFooter({ text: `총 ${participants.size}명 / ${teamCount}팀` });

                // 각 팀 필드 추가
                teams.forEach((team, index) => {
                    const teamMembers = team.map(id => `<@${id}>`).join('\n');
                    resultEmbed.addFields({ name: `🏆 ${index + 1}팀`, value: teamMembers, inline: true });
                });

                // 남는 인원 필드 추가 (있을 경우만)
                if (leftovers.length > 0) {
                    resultEmbed.addFields({ 
                        name: '👀 남는 인원', 
                        value: leftovers.map(id => `<@${id}>`).join(', '), 
                        inline: false 
                    });
                }

                // F. 버튼 비활성화 및 결과 전송
                await i.update({ 
                    content: '✅ **팀 배정이 완료되었습니다!**', 
                    embeds: [resultEmbed], 
                    components: [] // 버튼 제거
                });

                collector.stop('finished'); // 종료
            }
        });

        // 시간 초과 시 처리
        collector.on('end', async (collected, reason) => {
            if (reason !== 'finished') { // 정상 종료가 아닌 경우(시간 초과)
                try {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('⏰ 시간 초과')
                        .setDescription('5분이 지나 팀 짜기가 취소되었습니다.')
                        .setColor(0x808080); // 회색

                    // G. 시간이 초과된 경우
                    await interaction.editReply({ 
                        embeds: [timeoutEmbed], 
                        components: [] // 버튼 제거
                    });
                } catch (e) {
                    // 메세지 삭제됨 등
                }
            }
            clearTimeout(warningTimer); // 타이머 정리
        });
    }
};