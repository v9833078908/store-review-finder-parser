#!/bin/bash

# Скрипт для запуска Review Analytics Dashboard с ngrok

echo "🚀 Запуск Review Analytics Dashboard..."

# Переходим в директорию frontend
cd "/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/frontend"

# Проверяем что node_modules установлены
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    npm install
fi

# Запускаем Next.js dev server в фоне
echo "▶️  Запускаем Next.js dev server на порту 51200..."
npm run dev &
DEV_PID=$!

# Ждем пока сервер запустится
sleep 8

# Проверяем что сервер работает
if curl -s http://localhost:51200 > /dev/null; then
    echo "✅ Dev server запущен (PID: $DEV_PID)"
else
    echo "❌ Dev server не запустился"
    kill $DEV_PID 2>/dev/null
    exit 1
fi

# Запускаем ngrok
echo ""
echo "🌐 Запускаем ngrok туннель..."
echo "📍 Домен: unserenaded-nonresponsibly-haydee.ngrok-free.dev"
echo ""
echo "⚠️  ВАЖНО: Перед запуском установите authtoken:"
echo "   ngrok config add-authtoken YOUR_TOKEN"
echo ""
echo "Запускаем ngrok..."
ngrok http --url=unserenaded-nonresponsibly-haydee.ngrok-free.dev 51200

# Когда ngrok завершится (Ctrl+C), останавливаем dev server
kill $DEV_PID 2>/dev/null
echo ""
echo "👋 Остановлено"
