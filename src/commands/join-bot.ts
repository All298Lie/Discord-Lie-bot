import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    GuildMember,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    MessageFlags
 } from 'discord.js';
 import {
    joinVoiceChannel,
    getVoiceConnection
 } from '@discordjs/voice';

export default {
    // 명령어 정보
    data: new SlashCommandBuilder()
        .setName('입장')
        .setDescription('봇이 유저가 접속 중인 통화방으로 입장합니다.'),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        const userChannel = member.voice.channel;
        
        // 명령어를 친 유저가 음성 채널에 있는지 확인
        if (!userChannel) {
            return interaction.reply({ 
                content: '음성 채널에 접속 중에만 사용할 수 있습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // 봇이 이미 음성 채널에 있는지 확인
        const currentConnection = getVoiceConnection(interaction.guildId!);

        // A. 봇이 음성 채널에 들어가있지 않을 경우
        if (!currentConnection) {
            joinVoiceChannel({
                channelId: userChannel.id,
                guildId: userChannel.guild.id,
                adapterCreator: userChannel.guild.voiceAdapterCreator
            });

            return interaction.reply(`**${userChannel.name}** 채널에 접속했습니다.`);
        }

        // B. 봇이 유저가 위치한 음성 채널에 있을 경우
        if (currentConnection.joinConfig.channelId === userChannel.id) {
            return interaction.reply({
                content: '이미 유저가 위치한 통화방에 접속 중입니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // C. 봇이 다른 음성 채널에 이미 접속해 있는 경우
        const moveButton = new ButtonBuilder()
            .setCustomId('move_voice')
            .setLabel('이동하기')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(moveButton);
        
        await interaction.reply({
            content: `봇이 이미 다른 채널에 위치해 있습니다.\n **${userChannel.name}** 채널로 이동시키겠습니까?`,
            components: [row]
        });

        // 버튼 클릭 기다리기 (60초)
        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60_000
        });

        // 버튼을 클릭했을 경우
        collector.on('collect', async (i) => {
            // 명령어를 친 유저가 아닐 경우, 무시
            if (i.user.id !== interaction.user.id) return;

            joinVoiceChannel({
                channelId: userChannel.id,
                guildId: userChannel.guild.id,
                adapterCreator: userChannel.guild.voiceAdapterCreator
            });

            await i.update({
                content: `**${userChannel.name}** 채널로 이동했습니다.`,
                components: []
            });
            collector.stop();
        });

        // 시간이 초과되었을 경우
        collector.on('end', async (collected) => {
            // 버튼을 누르지 않았을 경우, 버튼 비활성화 및 기존 메세지 수정
            if (collected.size === 0) {
                try {
                    await interaction.editReply({ 
                        content: '채널 이동이 취소되었습니다.',
                        components: []
                    });

                } catch (error) {
                    // 메세지가 삭제된 경우 무시
                }
            }
        });
    }
};