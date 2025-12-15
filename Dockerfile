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

# 봇 실행
CMD ["./docker-entrypoint.sh"]