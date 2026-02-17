import type { DashboardData } from "@/lib/dashboard-types"
import type { SupportedLocale } from "@/lib/i18n"

const RU_CLUSTER_COPY: Record<
  string,
  {
    title: string
    summary: string
    recommendedAction: string
  }
> = {
  "cl-1": {
    title: "Агрессивная монетизация и принудительная реклама",
    summary:
      "Игроки сообщают о навязчивой рекламе после 10-15 уровня, включая непропускаемые ролики по 30 секунд после каждого боя и пакет отключения рекламы за $16. Часть пользователей также сообщает о множественных списаниях после внутриигровых покупок.",
    recommendedAction:
      "Срочно пересмотреть частоту рекламы и ограничить показ. Проверить жалобы на несанкционированные списания как риск для доверия и юридической безопасности.",
  },
  "cl-2": {
    title: "Pay-to-Win и дисбаланс матчмейкинга",
    summary:
      "Прогресс для free-to-play игроков становится почти невозможным в мидгейме. Игроки низкого уровня попадают против более сильных соперников, а PvP воспринимается как нечестный.",
    recommendedAction:
      "Перебалансировать экономику F2P, улучшить подбор соперников и проверить алгоритм матчмейкинга версии v1.38.2.",
  },
  "cl-3": {
    title: "Краши и нестабильность сервера",
    summary:
      "Наблюдаются частые вылеты во время апгрейдов и боев, разрывы соединения после матчей и пропадающие награды после рекламы. Проблема усилилась после релиза v1.38.2.",
    recommendedAction:
      "Подготовить хотфикс для синхронизации после боя и крашей при апгрейде. Приоритетно проверить стабильность на устройствах среднего класса.",
  },
  "cl-4": {
    title: "Ошибки боевой логики",
    summary:
      "Игроки сообщают о некорректных результатах боев: прокачанные корабли проигрывают более слабым. Часть пользователей считает PvP подстроенным.",
    recommendedAction:
      "Проверить боевые формулы в v1.38.2, верифицировать коэффициенты tier-ов и подготовить прозрачное объяснение механики урона.",
  },
  "cl-5": {
    title: "Дисбаланс событий",
    summary:
      "События слишком сложны для новых и средних игроков. Ценные награды чаще доступны только высокодонатящим пользователям.",
    recommendedAction:
      "Скорректировать кривую сложности событий и добавить уровневые награды для mid-core аудитории.",
  },
  "cl-6": {
    title: "Проблемы UX и полировки интерфейса",
    summary:
      "Пользователи жалуются на маленькие кнопки, наложение текста и сложную навигацию по меню, особенно на небольших экранах.",
    recommendedAction:
      "Провести QA-проверку адаптивности, увеличить зоны нажатия и устранить визуальные конфликты на маленьких устройствах.",
  },
  "cl-7": {
    title: "Сбои входа и авторизации",
    summary:
      "Критично: часть игроков не может запустить игру после обновления v1.38.2. На ряде Samsung-устройств появляется черный экран и краш.",
    recommendedAction:
      "Срочный хотфикс: воспроизвести проблему на Samsung Galaxy S23 и проверить совместимость инициализации клиента.",
  },
}

const RU_ALERT_COPY: Record<
  string,
  {
    title: string
    description: string
  }
> = {
  "al-1": {
    title: "Сбои входа после v1.38.2",
    description:
      "Обнаружен новый критичный кластер: игроки не могут запустить игру после обновления. Черный экран и краш на устройствах Samsung.",
  },
  "al-2": {
    title: "Всплеск жалоб на матчмейкинг",
    description:
      "Жалобы на матчмейкинг и баланс выросли до 5 за 48 часов (база: ~1 в день). Есть корреляция с релизом v1.38.2.",
  },
  "al-3": {
    title: "Рост крашей после обновления",
    description:
      "Количество жалоб на краши и серверную нестабильность выросло в 3 раза после v1.38.2: 10 за 7 дней против базовых 3.",
  },
  "al-4": {
    title: "Рейтинг снижается",
    description:
      "Средний рейтинг за неделю снизился с 4.52 до 4.49. Доля 1-2★ отзывов выросла с 10% до 12%.",
  },
  "al-5": {
    title: "Всплеск негатива в RU-регионе",
    description:
      "За последние 3 дня негативных отзывов из России стало в 4 раза больше. Основные причины: краши и проблемы матчмейкинга.",
  },
  "al-6": {
    title: "Повышенный уровень жалоб на рекламу",
    description:
      "Жалобы на рекламу держатся на уровне 2x от базового значения. Порог критичности не достигнут, но тренд растет.",
  },
}

const RU_ACTION_COPY: Record<
  string,
  {
    title: string
    rationale: string
  }
> = {
  "act-1": {
    title: "Исправить краш при логине на Samsung",
    rationale: "Краши на Galaxy S23 с v1.38.2, подозрение на race condition при инициализации.",
  },
  "act-2": {
    title: "Починить server sync после боя",
    rationale: "Сбои синхронизации результатов боя на 5G-соединениях, вызывающие потерю данных.",
  },
  "act-3": {
    title: "Проверить несанкционированные списания",
    rationale: "Риск для доверия — пользователи сообщают о несанкционированных списаниях после покупки.",
  },
  "act-4": {
    title: "Проверить алгоритм матчмейкинга v1.38.2",
    rationale: "Жалобы на баланс резко выросли после обновления v1.38.2.",
  },
  "act-5": {
    title: "Обновить FAQ по отключению рекламы",
    rationale: "Повторяющиеся жалобы на частоту рекламы и ценность пакета за $16.",
  },
}

export function localizeMockDashboardData(data: DashboardData, locale: SupportedLocale): DashboardData {
  if (locale === "en") return data

  return {
    ...data,
    clusters: data.clusters.map((cluster) => {
      const localized = RU_CLUSTER_COPY[cluster.id]
      if (!localized) return cluster
      return {
        ...cluster,
        title: localized.title,
        summary: localized.summary,
        recommendedAction: localized.recommendedAction,
      }
    }),
    alerts: data.alerts.map((alert) => {
      const localized = RU_ALERT_COPY[alert.id]
      if (!localized) return alert
      return {
        ...alert,
        title: localized.title,
        description: localized.description,
      }
    }),
    actionItems: data.actionItems.map((action) => {
      const localized = RU_ACTION_COPY[action.id]
      if (!localized) return action
      return {
        ...action,
        title: localized.title,
        rationale: localized.rationale,
      }
    }),
    reportLayers: {
      ...data.reportLayers,
      summary: {
        ...data.reportLayers.summary,
        title: "Сводка",
      },
      signals: {
        ...data.reportLayers.signals,
        title: "Сигналы",
      },
      issues: {
        ...data.reportLayers.issues,
        title: "Проблемы",
      },
      actions: {
        ...data.reportLayers.actions,
        title: "Действия",
      },
    },
  }
}
