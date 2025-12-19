import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export default {
    // 명령어 속성
    data: new SlashCommandBuilder()
        .setName('주사위')
        .setDescription('주사위를 굴립니다.')
        .addIntegerOption(option => 
            option.setName('종류')
                .setDescription('굴릴 주사위의 종류를 선택하세요.')
                .setRequired(true)
                .addChoices(
                    { name: '🎲 1 ~ 6', value: 6 },
                    { name: '💯 1 ~ 100', value: 100 },
                )
        ),

    // 명령어 작동 함수
    async execute(interaction: ChatInputCommandInteraction) {
        const max = interaction.options.getInteger('종류', true);

        // 확률 로직
        const result = Math.floor(Math.random() * max) + 1;

        // A. 랜덤박스 결과 출력
        const embed = new EmbedBuilder()
            .setColor(0xFFA500) // 주황색
            .setTitle('🎲 주사위 결과')
            .setDescription(`**1 ~ ${max}** 주사위를 굴렸습니다!`)
            .addFields({ name: '결과', value: `🎲 ${result}`, inline: true });

        return interaction.reply({ embeds: [embed] });
    },
};