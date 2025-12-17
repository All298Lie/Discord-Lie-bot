import { VoiceState } from 'discord.js';
import pool from './database.js';

// 접속 중인 유저 관리 맵 (Key: 유저ID, Value: { 서버ID, 마지막보상받은시간 })
const voiceUserMap = new Map<string, { guildId: string, lastRewardTime: number }>();

const CHECK_INTERVAL = 60 * 1000;   // 1분마다 검사
const REWARD_TIME = 20 * 60 * 1000; // 20분 (밀리초 단위)
const REWARD_POINT = 200;           // 지급할 포인트

// 타이머 시작 함수 (index.ts에서 실행)
export function startVoiceRewardLoop() {
    console.log('음성 채널 접속 포인트 지급 시스템이 시작되었습니다.');

    setInterval(async () => {
        const now = Date.now();
        const updates: Promise<any>[] = [];

        // 추적 중인 모든 유저 검사
        for (const [userId, data] of voiceUserMap.entries()) {
            if (now - data.lastRewardTime >= REWARD_TIME) { // (현재시간 - 마지막보상시간)이 20분을 넘었는지 확인
                // DB 업데이트 준비
                updates.push(
                    pool.execute(
                        'UPDATE users SET point = point + ? WHERE guild_id = ? AND user_id = ?',
                        [REWARD_POINT, data.guildId, userId]
                    ).then(() => {
                        console.log(`[포인트 지급] ${userId}님에게 ${REWARD_POINT}P 지급 완료`);
                    }).catch(e => {
                        console.error(`포인트 지급 실패 (${userId}):`, e);
                    })
                );

                // 지급 완료 후, 기준 시간을 현재로 초기화 (다시 0분부터 카운트)
                data.lastRewardTime = now;
            }
        }

        // DB 업데이트 병렬 처리 (속도 향상)
        if (updates.length > 0) await Promise.all(updates);

    }, CHECK_INTERVAL);
}

// 유저/봇 입장/퇴장 감지 함수
export function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const client = newState.client;
    const botId = client.user?.id;
    const member = newState.member;

    if (!member || !botId) return;

    // 봇의 움직임을 감지한 경우
    if (member.id === botId) {
        if (newState.channelId) { // A. 봇이 음성 채널에 입장한 경우 (/입장)
            console.log(`[${newState.guild.name}(${newState.guild.id})] 봇이 음성채널(${newState.channel?.name})에 입장했습니다.`);
            
            // 해당 음성채널에 입장되어있는 유저 전부 추적 리스트에 추가
            newState.channel?.members.forEach((m) => {
                if (!m.user.bot) {
                    voiceUserMap.set(m.id, {
                        guildId: newState.guild.id,
                        lastRewardTime: Date.now() // 지금부터 시간 카운트 시작
                    });
                }
            });
        }
        else if (oldState.channelId && !newState.channelId) { // B. 봇이 음성 채널에 퇴장한 경우 (/퇴장)
            console.log(`[${newState.guild.name}(${newState.guild.id})] 봇이 음성채널에서 퇴장했습니다.`);

            // 해당 서버의 추적 중인 유저들 리스트에서 제거
            for (const [uid, data] of voiceUserMap.entries()) {
                if (data.guildId === oldState.guild.id) {
                    voiceUserMap.delete(uid);
                }
            }
        }

        return;
    }
    
    const botChannelId = newState.guild.members.me?.voice.channelId;
    if (!botChannelId) return; // 봇이 없으면 무시

    if (newState.channelId === botChannelId && oldState.channelId !== botChannelId) { // C. 유저가 봇이 있는 음성 채널에 입장한 경우
        if (!member.user.bot) {
            voiceUserMap.set(member.id, {
                guildId: newState.guild.id,
                lastRewardTime: Date.now()
            });
        }
    }
    else if (oldState.channelId === botChannelId && newState.channelId !== botChannelId) { // D. 유저가 봇이 있는 음성 채널에서 퇴장한 경우
        voiceUserMap.delete(member.id);
    }
}