# 베이스 이미지를 node.js 24버전으로 선택
FROM node:24-alpine

# 작업 폴더 지정
WORKDIR /app

# 패키지 정보 복사
COPY package*.json .

# 라이브러리 설치
RUN ["npm", "install"]

# 소스코드 복사
COPY . .

# 스크립트 실행 권한 부여
RUN chmod +x ./docker-entrypoint.sh

# 봇 실행
ENTRYPOINT ["./docker-entrypoint.sh"]