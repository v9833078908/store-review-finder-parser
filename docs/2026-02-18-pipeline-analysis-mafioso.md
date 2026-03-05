# Анализ длительности пайплайна на примере `Mafioso: Mafia strategy PvP`

Дата анализа: 2026-02-18  
Среда запуска: `review-api` (Docker), источник данных: runtime-логи `docker logs review-api`  
Идентификаторы прогона:
- `trace_id`: `2aa79cdba5a788d08051397ca45ac2f5`
- `run_id`: `4b78d0ce4a2d`
- `app_id`: `com.herocraft.game.mafioso.gangster.paradise.pvp`
- `period`: `14d`
- `country`: `all` (21 регион)

## Короткий вывод
- Полный цикл генерации отчета занял `1,094,587 ms` (`18м 14.6с`).
- Основное время ушло в сбор отзывов по регионам: `~96.8%` total time.
- LLM-часть пайплайна заняла `35,374 ms` (`3.23%` от total).
- Главный bottleneck: последовательный fetch 21 региона при почти одинаковых отзывах (после merge `9261 -> 441`).

## Детальные метрики

### 1) End-to-end
- `dashboard_generation_started`: `07:27:56.872`
- `dashboard_generation_completed`: `07:46:11.546`
- Итоговая длительность: `1094.67s` (`1,094,587 ms`)

### 2) Fetch-фаза (Google Play)
- Количество регионов в режиме `all`: `21`
- Количество событий `reviews_fetch_completed`: `21`
- Средняя длительность одного fetch: `50,434 ms`
- Минимум: `49,613 ms`
- Максимум: `51,920 ms`
- Длительность fetch-фазы между первым и последним регионом: `1007.33s`
- Время от старта генерации до завершения последнего fetch: `1059.25s`

### 3) Merge + Date window filtering
- До merge: `9261` отзыв
- После dedup merge: `441` отзыв
- После фильтра окна `14d`: `29` отзывов
- `sample_limit`: `1000` (не достигнут в этом прогоне)
- Время между окончанием fetch и стартом pipeline: `0.12s`

### 4) LLM pipeline
- `pipeline_started`: `07:45:36.238`
- `pipeline_finished`: `07:46:11.537`
- Длительность pipeline: `35.30s` (`35,374 ms`)

LLM вызовы:
- `analyze_batch`: `11,202 ms`
- `classify_batch`: `23,806 ms`
- `unified_report`: `11,371 ms`

Параметры LLM:
- provider: `anthropic`
- model: `claude-haiku-4-5`
- tools: `tools_enabled=false`

### 5) Финализация
- Время после `pipeline_finished` до `dashboard_generation_completed`: `~0.01s`
- Записаны артефакты:
- `reports/Mafioso_Mafia_strategy_PvP_dashboard_2026-02-18.md`
- `data/runs/Mafioso_Mafia_strategy_PvP_20260218T074611Z_4b78d0ce4a2d.json`

## Хронология ключевых шагов
| Время UTC | Событие | Комментарий |
|---|---|---|
| 07:27:56.872 | `dashboard_generation_started` | Запуск окна `14d`, режим `country=all` |
| 07:28:48.795 | 1-й `reviews_fetch_completed` (`us`) | Первый fetch завершен через ~51.9с |
| 07:45:36.121 | последний `reviews_fetch_completed` (`pl`) | Завершен последовательный сбор 21 региона |
| 07:45:36.156 | `reviews_merged` | `9261 -> 441` |
| 07:45:36.157 | `reviews_window_filtered` | `441 -> 29` в окне `14d` |
| 07:45:36.238 | `pipeline_started` | Старт LLM-этапа |
| 07:46:11.537 | `pipeline_finished` | LLM pipeline завершен |
| 07:46:11.546 | `dashboard_generation_completed` | End-to-end завершение |

## Оценка адекватности текущей длительности
- Для текущей архитектуры (последовательный fetch по 21 региону) длительность `~18 минут` ожидаема и технически объяснима.
- Для UX Command Center это уже долго: пользователь воспринимает процесс как «подвисание», особенно при `country=all`.
- LLM-часть не является узким местом в этом кейсе; оптимизировать нужно оркестрацию сбора отзывов.

## Основные узкие места
- Последовательный региональный fetch c почти одинаковой latency на каждом регионе (~50с).
- Сильное дублирование между регионами (`9261 -> 441`), то есть большая часть сетевого времени уходит на сбор дублей.
- Фильтр окна дат применяется после merge; до фильтра тянется заметно больше данных, чем реально попадает в анализ.

## Рекомендации (приоритет)
1. Перевести fetch регионов в controlled parallelism (`concurrency` 3-5) с rate-limit защитой.
2. Добавить раннюю остановку fetch по окну дат (как только страницы уходят за `window_from`).
3. Для `country=all` добавить heuristic stop при высоком duplicate ratio после первых N регионов.
4. Добавить live ETA в UI (`regions_done/regions_total`, current avg fetch duration).
5. Логировать `cache hit rate` и latency per country в итоговых метриках run, чтобы видеть тренды деградации.

## Минимальный target SLA после оптимизаций
- `country=single`, `14d`: до `60-120s`.
- `country=all`, `14d`: до `3-6 min` при controlled parallel fetch.

## Приложение: команды для live-мониторинга
```bash
cd review-parser
docker logs -f --since 3s review-api 2>&1 \
  | sed -n 's/^[^{]*//p' \
  | jq -cr 'select(.event? != null)'
```

```bash
cd review-parser
docker logs --since 90m review-api 2>&1 \
  | rg '2aa79cdba5a788d08051397ca45ac2f5'
```
