# TalkReady – Interview preparation UI

Многостраничный адаптивный сайт на React + TypeScript по макетам из `screens/`.

## Стек
- Vite + React 18
- TypeScript
- React Router v6
- CSS Modules

## Соответствие страниц макетам
- `/` – **Перед собеседованием** (`screens/Before interview.png`)
- `/camera` – **Камера** (`screens/Camera.png`)
- `/microphone` – **Микрофон** (`screens/Microphone.png`)
- `/screen` – **Экран** (`screens/Screen.png`)
- `/interview` – **Интервью** (`screens/Interview.png`)
- `/modal` – **Модалка** (`screens/Модалка.png`)

## Установка и запуск
```bash
npm install
npm run dev       # локальная разработка
npm run build     # продакшн-сборка
npm run preview   # предпросмотр собранного проекта
```

## Структура
- `src/pages` – по одному файлу на экран
- `src/components` – переиспользуемые блоки (layout, UI, секции)
- `src/styles` – глобальные переменные и базовые стили

Header и footer общие для всех страниц, навигация совпадает с экранами из дизайна. Все блоки адаптивные и перестраиваются на мобильных.
