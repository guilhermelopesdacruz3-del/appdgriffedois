@echo off
cd /d C:\Users\yasmi\Downloads\loja-integrada-conectada\loja-integrada-conectada
set ADMIN_PASSWORD=demo123
set ADMIN_MOCK=1
start node server/index.mjs
start cmd /c npm run dev
