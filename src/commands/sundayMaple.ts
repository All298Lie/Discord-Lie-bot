import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import pool from '../database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('썬데이메이플')
        .setDescription('이번 주 썬데이 메이플 이벤트 정보를 확인합니다.'),
        
    async execute(interaction: CommandInteraction) {
        try {
            const [rows]: any = await pool.execute('SELECT * FROM sunday_maple LIMIT 1');

            if (rows.length === 0) {
                return interaction.reply({ 
                    content: '이번 주 썬데이 메이플 정보가 아직 조회되지 않았거나, 기간이 만료되었습니다.', 
                    ephemeral: true 
                });
            }

            const data = rows[0];
            const embed = new EmbedBuilder()
                .setTitle(`🍁 ${data.title}`)
                .setURL(data.url)
                .setColor(0xFFA500);

            if (data.image_url) {
                embed.setImage(data.image_url);
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("명령어 실행 중 오류:", error);
            await interaction.reply({ content: '정보를 불러오는 중 오류가 발생했습니다.', ephemeral: true });
        }
    }
};