# Настройка публичного доступа через ngrok

## 🔑 Шаг 1: Получите валидный authtoken

1. Откройте: https://dashboard.ngrok.com/get-started/your-authtoken
2. Если нужно, нажмите **"Reset authtoken"** для генерации нового
3. Скопируйте полный токен (должен быть ~50 символов, начинается с цифр)

## ⚙️ Шаг 2: Настройте ngrok

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

Замените `YOUR_TOKEN_HERE` на токен из dashboard.

## 🚀 Шаг 3: Запустите дашборд

### Вариант A: Используя готовый скрипт (рекомендуется)

```bash
cd "/Users/eli/Documents/PythonProjects/gamedev tools/review-parser"
./start-dashboard.sh
```

Скрипт автоматически:
- ✅ Запустит Next.js dev server на порту 51200
- ✅ Запустит ngrok туннель
- ✅ Подключит ваш постоянный домен

### Вариант B: Вручную (2 терминала)

**Терминал 1** — Next.js dev server:
```bash
cd "/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/frontend"
npm run dev
```

**Терминал 2** — ngrok туннель:
```bash
ngrok http --url=unserenaded-nonresponsibly-haydee.ngrok-free.dev 51200
```

## 🌐 Доступ к дашборду

После успешного запуска дашборд будет доступен по адресу:

**https://unserenaded-nonresponsibly-haydee.ngrok-free.dev**

Этот домен **постоянный** — можете делиться ссылкой с коллегами.

## 📱 Страницы дашборда

- https://unserenaded-nonresponsibly-haydee.ngrok-free.dev/search-app
- https://unserenaded-nonresponsibly-haydee.ngrok-free.dev/command-center
- https://unserenaded-nonresponsibly-haydee.ngrok-free.dev/issues
- https://unserenaded-nonresponsibly-haydee.ngrok-free.dev/reviews
- https://unserenaded-nonresponsibly-haydee.ngrok-free.dev/alerts

## 🛑 Остановка

Нажмите `Ctrl+C` в терминале с ngrok — скрипт автоматически остановит оба процесса.

## ⚠️ Troubleshooting

### "authentication failed: authtoken is invalid"

Ваш токен невалиден. Решение:
1. Сгенерируйте новый токен: https://dashboard.ngrok.com/get-started/your-authtoken
2. Запустите: `ngrok config add-authtoken NEW_TOKEN`
3. Перезапустите скрипт

### "port 51200 already in use"

Останов��те процесс на порту:
```bash
lsof -ti:51200 | xargs kill
```

### Ngrok показывает другой домен

Убедитесь что используете флаг `--url` (не `--domain`):
```bash
ngrok http --url=unserenaded-nonresponsibly-haydee.ngrok-free.dev 51200
```

## 📝 Примечания

- Dev server работает на http://localhost:51200 (локально)
- Ngrok пробрасывает его на https://unserenaded-nonresponsibly-haydee.ngrok-free.dev (публично)
- Домен статичный и привязан к вашему аккаунту ngrok
- При остановке ngrok публичный доступ прекращается
