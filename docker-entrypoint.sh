#!/bin/sh

set -e

echo "명령어 등록 중"
npx tsx src/deploy-commands.ts

echo "봇 실행 중"
exec npx tsx src/index.ts