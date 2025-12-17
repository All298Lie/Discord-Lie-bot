import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    GuildMember,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    MessageFlags,
    PermissionFlagsBits
 } from 'discord.js';
 import {
    joinVoiceChannel,
    getVoiceConnection
 } from '@discordjs/voice';
 import { voiceSessions } from '../botState.js';
 import { getDedicatedChannel } from '../database.js';

export default {
    // 명령어 정보
    data: new SlashCommandBuilder()
        .setName('입장')
        .setDescription('봇이 유저가 접속 중인 통화방으로 입장합니다.'),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId!;
        const member = interaction.member as GuildMember;
        const userChannel = member.voice.channel;
        
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

        // 명령어를 친 유저가 음성 채널에 있는지 확인
        if (!userChannel) {
            return interaction.reply({ 
                content: '음성 채널에 접속 중에만 사용할 수 있습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // 봇이 이미 음성 채널에 있는지 확인
        const currentConnection = getVoiceConnection(guildId);
        const isAdminUser = member.permissions.has(PermissionFlagsBits.Administrator)

        // C. 봇이 음성 채널에 들어가있지 않을 경우
        if (!currentConnection) {
            joinVoiceChannel({
                channelId: userChannel.id,
                guildId: userChannel.guild.id,
                adapterCreator: userChannel.guild.voiceAdapterCreator
            });

            voiceSessions.set(guildId, { isAdmin: isAdminUser });

            return interaction.reply(`**${userChannel.name}** 채널에 접속했습니다.`);
        }

        // D. 봇이 유저가 위치한 음성 채널에 있을 경우
        if (currentConnection.joinConfig.channelId === userChannel.id) {
            return interaction.reply({
                content: '이미 유저가 위치한 통화방에 접속 중입니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // E. 봇을 이전에 입장시킨 유저는 관리자고, 명령어를 입력한 유저는 아닐 경우
        const session = voiceSessions.get(guildId);
        if (session?.isAdmin && !isAdminUser) {
            return interaction.reply({
                content: '🔒 현재 관리자 권한으로 봇이 사용 중입니다. 관리자만 이동시킬 수 있습니다.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // F. 봇이 다른 음성 채널에 이미 접속해 있는 경우
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

            voiceSessions.set(guildId, { isAdmin: isAdminUser });

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