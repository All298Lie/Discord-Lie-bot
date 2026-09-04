import dotenv from 'dotenv';
dotenv.config();

const NEXON_API_KEY = process.env.NEXON_API_KEY || '';

const HEADERS = {
    'x-nxopen-api-key': NEXON_API_KEY
};

// 1. 이벤트 목록 가져오기
export async function getEventNoticeList() {
    const url = 'https://open.api.nexon.com/maplestory/v1/notice-event';
    const response = await fetch(url, { headers: HEADERS });
    
    if (!response.ok) throw new Error('이벤트 목록 API 요청 실패');
    return await response.json();
}

// 2. 이벤트 상세 내용 가져오기 (공지 ID 기반)
export async function getEventNoticeDetail(noticeId: number) {
    const url = `https://open.api.nexon.com/maplestory/v1/notice-event/detail?notice_id=${noticeId}`;
    const response = await fetch(url, { headers: HEADERS });
    
    if (!response.ok) throw new Error('이벤트 상세 API 요청 실패');
    return await response.json();
}

// 3. contents에서 이미지 URL 추출
export function extractImageUrl(htmlContents: string): string | null {
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = htmlContents.match(imgRegex);
    
    if (match && match[1]) {
        return match[1];
    }
    return null;
}