import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 환경 변수 로드
dotenv.config();

// .env DISCORD_TOKEN 검사
if (!process.env.DISCORD_TOKEN) {
    throw new Error("토큰 값이 존재하지 않습니다.");
}

// 등록할 명령어 정의
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    const commandModule = await import(pathToFileURL(filePath).href);
    const command = commandModule.default;

    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());

    } else {
        console.log(`${filePath} 파일에 data 또는 execute 속성이 없습니다.`);
    }
}

// REST 모듈 준비
const rest = new REST({ version: '10' })
    .setToken(process.env.DISCORD_TOKEN);

// 디스코드 서버에 명령어 전송
(async () => {
    try {
        // .env DISCORD_CLIENT_ID 검사
        if (!process.env.DISCORD_CLIENT_ID) {
            throw new Error("클라이언트 ID 값이 존재하지 않습니다.");
        }

        console.log(`${commands.length}개의 명령어 등록을 시작합니다.`);

        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands},
        );

        console.log('명령어 등록이 성공적으로 완료되었습니다.');
        console.log('모든 서버에 명령어가 반영되기까지 최대 1시간이 걸릴 수 있습니다.');
        
    } catch (error) {
        console.error(error);
    }
})();