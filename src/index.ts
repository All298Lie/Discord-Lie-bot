import { Client, GatewayIntentBits, Collection, Events, MessageFlags, EmbedBuilder, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pool, { initDatabase } from './database.js';
import { startVoiceRewardLoop, handleVoiceStateUpdate } from './voiceManager.js';

// 환경 변수 로드
dotenv.config();

// .env DISCORD_TOKEN 검사
if (!process.env.DISCORD_TOKEN) throw new Error("토큰 값이 존재하지 않습니다.");

// 봇 클라이언트 생성 (권한 설정)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// command 목록 가져오기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = new Collection<string, any>();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    const commandModule = await import(pathToFileURL(filePath).href);
    const command = commandModule.default;

    if ('data' in command && 'execute' in command) {
        commands.set(command.data.name, command);
    }
}

// A. 봇 로그인 감지 이벤트
client.once(Events.ClientReady, async c => {
    console.log(`🤖 봇이 준비되었습니다! 로그인: ${c.user.tag}`);

    // DB 초기화
    await initDatabase();

    // 패치 노트 예약 확인
    try {
        const [rows]: any = await pool.execute(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'patch_note'"
        );

        if (rows.length > 0 && rows[0].setting_value) {
            const patchNote = rows[0].setting_value;

            // guild_settings 테이블에서 채널 ID들 가져오기
            const [channels]: any = await pool.execute("SELECT dedicated_channel_id FROM guild_settings");

            const embed = new EmbedBuilder()
                .setTitle('🛠️ 봇 업데이트 알림')
                .setDescription(patchNote)
                .setColor(0x00FF00)
                .setTimestamp();

            let sendCount = 0;
            for (const row of channels) {
                const channelId = row.dedicated_channel_id;
                try {
                    const channel = await client.channels.fetch(channelId) as TextChannel;
                    if (channel) {
                        await channel.send({ embeds: [embed] });
                        sendCount++;
                    }
                } catch (e) {
                    // 채널이 삭제되었거나 권한이 없는 경우 무시
                    console.error(`채널(${channelId}) 전송 실패`);
                }
            }
            console.log(`📢 총 ${sendCount}개 채널에 패치 노트 전송 완료.`);

            // 전송 후 DB에서 내용 삭제
            await pool.execute("UPDATE system_settings SET setting_value = NULL WHERE setting_key = 'patch_note'");
        }
    } catch (error) {
        console.error("패치 노트 확인 중 오류 발생:", error);
    }

    // 음성 채널 접속 보상 지급 함수 실행
    startVoiceRewardLoop();
});

// B. 명령어 입력 감지 이벤트
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);

    } catch (error) {
        console.error(error);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '명령어 실행 중 오류가 났습니다.', flags: [MessageFlags.Ephemeral] });

        } else {
            await interaction.reply({ content: '명령어 실행 중 오류가 났습니다.', flags: [MessageFlags.Ephemeral] });
        }
    }
});

// C. 채팅 채널 채팅 감지 이벤트
client.on(Events.MessageCreate, (message) => {
    if (message.content === '!핑') {
        message.reply('퐁!');
    }
});

// D. 음성 채널 접속 감지 이벤트
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    handleVoiceStateUpdate(oldState, newState);
});

// 봇 로그인 (환경변수에서 토큰 가져옴)
client.login(process.env.DISCORD_TOKEN);

// 안전한 종료를 위한 함수
const handleExit= async (signal: string) => {
    console.log(`\n⚠️ ${signal} 신호를 받았습니다. 봇을 종료합니다...`);

    // 디스코드 봇 로그아웃
    try {
        console.log('🔌 Discord 연결 종료 중...');
        await client.destroy(); 
        console.log('✅ Discord 연결 종료 완료');

    } catch (error) {
        console.error('❌ Discord 연결 종료 실패:', error);
    }

    // 데이터베이스 연결 종료
    try {
        console.log('💾 Database 연결 종료 중...');
        await pool.end(); 
        console.log('✅ Database 연결 종료 완료');

    } catch (error) {
        console.error('❌ Database 연결 종료 실패:', error);
    }

    console.log('👋 봇이 안전하게 종료되었습니다.');
    process.exit(0); // 프로그램 정상 종료
}

// 도커가 컨테이너에게 종료 신호를 보낸 경우
process.on('SIGTERM', () => 
    handleExit('SIGTERM')
);

// 터미널을 통해 종료 신호를 받은 경우
process.on('SIGINT', () =>
    handleExit('SIGINT')
);