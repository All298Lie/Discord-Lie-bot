import { Client, GatewayIntentBits, Collection, Events, MessageFlags } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initDatabase } from './database.js';
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

// DB 테이블 생성
(async () => {
    await initDatabase();
})();

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
client.once(Events.ClientReady, () => {
    console.log(`로그인 성공! ${client.user?.tag}`);

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

// 도커가 컨테이너에게 종료 신호를 보낸 경우
process.on('SIGTERM', () => {
    // 
});

// 터미널을 통해 종료 신호를 받은 경우
process.on('SIGINT', () => {
    // 
});