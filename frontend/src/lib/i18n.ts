import type {
  AlertSeverity,
  AlertStatus,
  ClusterStatus,
  ReviewCategory,
  Sentiment,
} from "@/lib/types"

export type SupportedLocale = "en" | "ru"

export const DEFAULT_LOCALE: SupportedLocale = "en"
export const MOSCOW_TIMEZONE = "Europe/Moscow"

export interface UiText {
  appLabel: string
  nav: {
    searchApp: string
    commandCenter: string
    issues: string
    reviews: string
    alerts: string
  }
  header: {
    updated: string
    reviewsSuffix: string
    language: string
    dateRange: string
    timezone: string
    activeRange: string
    apply: string
    reset: string
    from: string
    to: string
    invalidRange: string
  }
  datePresets: {
    "24h": string
    "7d": string
    "14d": string
    "30d": string
    "90d": string
    custom: string
  }
  common: {
    loadingDashboard: string
    loadingReviews: string
    loadingClusters: string
    loadingAlerts: string
    loadingClusterDetails: string
    backToIssues: string
    clusterNotFound: string
    showSourceData: string
    sourceApi: string
    sourceCache: string
    sourceMock: string
    reviewsCountOne: string
    reviewsCountMany: string
  }
  pages: {
    commandCenterTitle: string
    commandCenterSubtitle: string
    reviewsTitle: string
    reviewsSubtitle: string
    issuesTitle: string
    issuesSubtitle: string
    alertsTitle: string
    alertsSubtitle: string
    reportTitle: string
    reportSubtitle: string
    reportMissingUrl: string
    reportStep: string
    reportPipeline: string
    reportProcessing: string
    reportRetry: string
  }
  statusCards: {
    reputation: string
    lowRatingShare: string
    newIssues: string
    clustersSinceRelease: string
    spike: string
    critical: string
    responseCoverage: string
    withoutReply: string
    unansweredNegatives: string
    total: string
  }
  timelineChart: {
    title: string
    description: string
    negativeReviews: string
    bugReports: string
    alerts: string
  }
  topClusters: {
    title: string
    description: string
    severity: string
    reports7d: string
    top: string
  }
  actionBoard: {
    title: string
    description: string
    action: string
    rationale: string
    importance: string
  }
  reviewFilters: {
    rating: string
    allRatings: string
    language: string
    allLanguages: string
    country: string
    allCountries: string
    version: string
    allVersions: string
    category: string
    allCategories: string
    clear: string
  }
  reviewTable: {
    showing: string
    exportCsv: string
    date: string
    text: string
    originalLang: string
    sentiment: string
    severity: string
    category: string
  }
  clusterList: {
    cluster: string
    severity: string
    volume7d: string
    trend: string
    firstLastSeen: string
    status: string
    reports24h: string
  }
  clusterDetail: {
    summary: string
    volume7Days: string
    avgRating: string
    reports24h: string
    whyProblem: string
    growthRate: string
    ratingImpact: string
    severityClassification: string
    exampleReviews: string
    recentReports: string
    byVersion: string
    byCountry: string
    byLanguage: string
    recommendedAction: string
    count: string
  }
  alertList: {
    metric: string
    baseline: string
    current: string
    viewRelatedCluster: string
  }
  markdownPanel: {
    title: string
    description: string
  }
}

const EN_TEXT: UiText = {
  appLabel: "Review Analytics",
  nav: {
    searchApp: "Search App",
    commandCenter: "Command Center",
    issues: "Issues",
    reviews: "Reviews",
    alerts: "Alerts",
  },
  header: {
    updated: "Updated",
    reviewsSuffix: "reviews",
    language: "Language",
    dateRange: "Date Range",
    timezone: "Moscow Time",
    activeRange: "Active",
    apply: "Apply",
    reset: "Reset",
    from: "From",
    to: "To",
    invalidRange: 'Set a valid range: "From" date must be earlier than "To".',
  },
  datePresets: {
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "14d": "Last 14 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    custom: "Custom",
  },
  common: {
    loadingDashboard: "Loading dashboard data...",
    loadingReviews: "Loading reviews...",
    loadingClusters: "Loading clusters...",
    loadingAlerts: "Loading alerts...",
    loadingClusterDetails: "Loading cluster details...",
    backToIssues: "Back to Issues",
    clusterNotFound: "Cluster not found for id",
    showSourceData: "Showing",
    sourceApi: "API",
    sourceCache: "cached",
    sourceMock: "mock",
    reviewsCountOne: "review",
    reviewsCountMany: "reviews",
  },
  pages: {
    commandCenterTitle: "Command Center",
    commandCenterSubtitle: "Real-time overview of your app health and user sentiment",
    reviewsTitle: "Reviews Explorer",
    reviewsSubtitle: "Manual analysis and filtering of all user reviews",
    issuesTitle: "Issue Clusters",
    issuesSubtitle: "Grouped problems identified from user reviews",
    alertsTitle: "Alerts",
    alertsSubtitle: "Signal feed with actionable context from anomaly detection",
    reportTitle: "Generating Unified Report",
    reportSubtitle: "It may take up to 5-10 minutes to complete. You will be redirected to the dashboard when it completes.",
    reportMissingUrl: "Missing `url` query parameter.",
    reportStep: "Step",
    reportPipeline: "Pipeline",
    reportProcessing: "Processing reviews and generating dashboard artifact...",
    reportRetry: "Retry",
  },
  statusCards: {
    reputation: "Reputation",
    lowRatingShare: "1-2★ share",
    newIssues: "New Issues",
    clustersSinceRelease: "clusters since last release",
    spike: "spike",
    critical: "critical",
    responseCoverage: "Response Coverage",
    withoutReply: "without reply",
    unansweredNegatives: "unanswered negatives",
    total: "total",
  },
  timelineChart: {
    title: "Timeline",
    description: "Negative reviews, bug reports, and alerts with release markers",
    negativeReviews: "Negative Reviews",
    bugReports: "Bug Reports",
    alerts: "Alerts",
  },
  topClusters: {
    title: "Top Issue Clusters",
    description: "Highest impact problems in the selected period",
    severity: "Severity",
    reports7d: "reports",
    top: "Top",
  },
  actionBoard: {
    title: "Action Board",
    description: "Recommended actions based on review analysis",
    action: "Action",
    rationale: "Rationale",
    importance: "Importance",
  },
  reviewFilters: {
    rating: "Rating",
    allRatings: "All Ratings",
    language: "Original Language",
    allLanguages: "All Languages",
    country: "Country",
    allCountries: "All Countries",
    version: "Version",
    allVersions: "All Versions",
    category: "Category",
    allCategories: "All Categories",
    clear: "Clear Filters",
  },
  reviewTable: {
    showing: "Showing",
    exportCsv: "Export CSV",
    date: "Date",
    text: "Text",
    originalLang: "Original Lang",
    sentiment: "Sentiment",
    severity: "Severity",
    category: "Category",
  },
  clusterList: {
    cluster: "Cluster",
    severity: "Severity",
    volume7d: "Volume",
    trend: "Trend",
    firstLastSeen: "First / Last Seen",
    status: "Status",
    reports24h: "24h",
  },
  clusterDetail: {
    summary: "Auto-generated cluster summary",
    volume7Days: "Volume (selected period)",
    avgRating: "Avg Rating",
    reports24h: "Reports (24h)",
    whyProblem: "Why we think this is a problem",
    growthRate: "Growth rate",
    ratingImpact: "Rating impact",
    severityClassification: "Severity classification based on frequency, sentiment, and user frustration indicators",
    exampleReviews: "Example Reviews",
    recentReports: "Recent reports from affected users",
    byVersion: "By Version",
    byCountry: "By Country",
    byLanguage: "By Language",
    recommendedAction: "Recommended Action",
    count: "Count",
  },
  alertList: {
    metric: "Metric",
    baseline: "Baseline",
    current: "Current",
    viewRelatedCluster: "View Related Cluster",
  },
  markdownPanel: {
    title: "Report Export (Markdown)",
    description: "Secondary export view from the unified synthesis output.",
  },
}

const RU_TEXT: UiText = {
  appLabel: "Аналитика Отзывов",
  nav: {
    searchApp: "Поиск Приложений",
    commandCenter: "Командный Центр",
    issues: "Проблемы",
    reviews: "Отзывы",
    alerts: "Алерты",
  },
  header: {
    updated: "Обновлено",
    reviewsSuffix: "отзывов",
    language: "Язык",
    dateRange: "Период",
    timezone: "Московское время",
    activeRange: "Активный",
    apply: "Применить",
    reset: "Сброс",
    from: "С",
    to: "По",
    invalidRange: 'Укажите корректный диапазон: дата "С" должна быть раньше даты "По".',
  },
  datePresets: {
    "24h": "Последние 24 часа",
    "7d": "Последние 7 дней",
    "14d": "Последние 14 дней",
    "30d": "Последние 30 дней",
    "90d": "Последние 90 дней",
    custom: "Свой период",
  },
  common: {
    loadingDashboard: "Загружаем данные дашборда...",
    loadingReviews: "Загружаем отзывы...",
    loadingClusters: "Загружаем кластеры...",
    loadingAlerts: "Загружаем алерты...",
    loadingClusterDetails: "Загружаем детали кластера...",
    backToIssues: "Назад к проблемам",
    clusterNotFound: "Кластер не найден для id",
    showSourceData: "Показаны данные источника",
    sourceApi: "API",
    sourceCache: "кэш",
    sourceMock: "мок",
    reviewsCountOne: "отзыв",
    reviewsCountMany: "отзывов",
  },
  pages: {
    commandCenterTitle: "Командный Центр",
    commandCenterSubtitle: "Оперативный обзор здоровья приложения и тональности отзывов",
    reviewsTitle: "Просмотр Отзывов",
    reviewsSubtitle: "Ручной анализ и фильтрация всех пользовательских отзывов",
    issuesTitle: "Кластеры Проблем",
    issuesSubtitle: "Сгруппированные проблемы, выявленные в отзывах",
    alertsTitle: "Алерты",
    alertsSubtitle: "Лента сигналов с контекстом для действий",
    reportTitle: "Формируем единый отчёт",
    reportSubtitle: "Пайплайн запущен. После завершения произойдет переход в дашборд.",
    reportMissingUrl: "Отсутствует query-параметр `url`.",
    reportStep: "Шаг",
    reportPipeline: "Пайплайн",
    reportProcessing: "Обрабатываем отзывы и формируем артефакт дашборда...",
    reportRetry: "Повторить",
  },
  statusCards: {
    reputation: "Репутация",
    lowRatingShare: "Доля 1-2★",
    newIssues: "Новые Проблемы",
    clustersSinceRelease: "кластеров с последнего релиза",
    spike: "всплеск",
    critical: "критичный",
    responseCoverage: "Покрытие Ответами",
    withoutReply: "без ответа",
    unansweredNegatives: "негативов без ответа",
    total: "всего",
  },
  timelineChart: {
    title: "Таймлайн",
    description: "Негативные отзывы, баг-репорты и алерты с маркерами релизов",
    negativeReviews: "Негативные Отзывы",
    bugReports: "Баг-Репорты",
    alerts: "Алерты",
  },
  topClusters: {
    title: "Топ Кластеров Проблем",
    description: "Проблемы с максимальным влиянием в выбранном периоде",
    severity: "Серьёзность",
    reports7d: "репортов",
    top: "Топ",
  },
  actionBoard: {
    title: "Доска Действий",
    description: "Рекомендуемые действия на основе анализа отзывов",
    action: "Действие",
    rationale: "Обоснование",
    importance: "Важность",
  },
  reviewFilters: {
    rating: "Рейтинг",
    allRatings: "Все рейтинги",
    language: "Язык оригинала",
    allLanguages: "Все языки",
    country: "Страна",
    allCountries: "Все страны",
    version: "Версия",
    allVersions: "Все версии",
    category: "Категория",
    allCategories: "Все категории",
    clear: "Сбросить фильтры",
  },
  reviewTable: {
    showing: "Показано",
    exportCsv: "Экспорт CSV",
    date: "Дата",
    text: "Текст",
    originalLang: "Ориг. яз",
    sentiment: "Тональность",
    severity: "Серьёзность",
    category: "Категория",
  },
  clusterList: {
    cluster: "Кластер",
    severity: "Серьёзность",
    volume7d: "Объём",
    trend: "Тренд",
    firstLastSeen: "Первое / Последнее",
    status: "Статус",
    reports24h: "24ч",
  },
  clusterDetail: {
    summary: "Автосформированное резюме кластера",
    volume7Days: "Объём (выбранный период)",
    avgRating: "Средний рейтинг",
    reports24h: "Репортов (24ч)",
    whyProblem: "Почему это проблема",
    growthRate: "Темп роста",
    ratingImpact: "Влияние на рейтинг",
    severityClassification: "Классификация серьёзности на основе частоты, тональности и признаков фрустрации пользователей",
    exampleReviews: "Примеры Отзывов",
    recentReports: "Недавние сообщения от затронутых пользователей",
    byVersion: "По Версии",
    byCountry: "По Стране",
    byLanguage: "По Языку",
    recommendedAction: "Рекомендуемое Действие",
    count: "Количество",
  },
  alertList: {
    metric: "Метрика",
    baseline: "База",
    current: "Текущее",
    viewRelatedCluster: "Открыть связанный кластер",
  },
  markdownPanel: {
    title: "Экспорт Отчета (Markdown)",
    description: "Дополнительное представление экспорта из единого синтеза.",
  },
}

const CATEGORY_LABELS: Record<SupportedLocale, Record<ReviewCategory, string>> = {
  en: {
    bug: "bug",
    feature: "feature",
    praise: "praise",
    noise: "noise",
    complaint: "complaint",
  },
  ru: {
    bug: "баг",
    feature: "фича",
    praise: "похвала",
    noise: "шум",
    complaint: "жалоба",
  },
}

const SENTIMENT_LABELS: Record<SupportedLocale, Record<Sentiment, string>> = {
  en: {
    positive: "positive",
    negative: "negative",
    mixed: "mixed",
    neutral: "neutral",
  },
  ru: {
    positive: "позитив",
    negative: "негатив",
    mixed: "смешанный",
    neutral: "нейтральный",
  },
}

const CLUSTER_STATUS_LABELS: Record<SupportedLocale, Record<ClusterStatus, string>> = {
  en: {
    active: "active",
    monitoring: "monitoring",
    resolved: "resolved",
  },
  ru: {
    active: "активный",
    monitoring: "наблюдение",
    resolved: "решен",
  },
}

const ALERT_STATUS_LABELS: Record<SupportedLocale, Record<AlertStatus, string>> = {
  en: {
    active: "active",
    acknowledged: "acknowledged",
    resolved: "resolved",
  },
  ru: {
    active: "активный",
    acknowledged: "подтвержден",
    resolved: "решен",
  },
}

const ALERT_SEVERITY_LABELS: Record<SupportedLocale, Record<AlertSeverity, string>> = {
  en: {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
  },
  ru: {
    critical: "критичный",
    high: "высокий",
    medium: "средний",
    low: "низкий",
  },
}

const LANGUAGE_NAMES: Record<SupportedLocale, Record<string, string>> = {
  en: {
    en: "English",
    ru: "Russian",
    de: "German",
    es: "Spanish",
    pt: "Portuguese",
    id: "Indonesian",
    ph: "Filipino",
    fr: "French",
    it: "Italian",
    tr: "Turkish",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    ar: "Arabic",
    hi: "Hindi",
  },
  ru: {
    en: "Английский",
    ru: "Русский",
    de: "Немецкий",
    es: "Испанский",
    pt: "Португальский",
    id: "Индонезийский",
    ph: "Филиппинский",
    fr: "Французский",
    it: "Итальянский",
    tr: "Турецкий",
    zh: "Китайский",
    ja: "Японский",
    ko: "Корейский",
    ar: "Арабский",
    hi: "Хинди",
  },
}

const UI_TEXT: Record<SupportedLocale, UiText> = {
  en: EN_TEXT,
  ru: RU_TEXT,
}

export function getUiText(locale: SupportedLocale): UiText {
  return UI_TEXT[locale]
}

export function toIntlLocale(locale: SupportedLocale): string {
  return locale === "ru" ? "ru-RU" : "en-US"
}

export function detectLocaleFromBrowser(): SupportedLocale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE
  }
  const lang = navigator.language.toLowerCase()
  return lang.startsWith("ru") ? "ru" : "en"
}

export function parseLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null
  if (value === "ru" || value === "en") return value
  return null
}

export function formatCategory(category: ReviewCategory, locale: SupportedLocale): string {
  return CATEGORY_LABELS[locale][category]
}

export function formatSentiment(sentiment: Sentiment, locale: SupportedLocale): string {
  return SENTIMENT_LABELS[locale][sentiment]
}

export function formatClusterStatus(status: ClusterStatus, locale: SupportedLocale): string {
  return CLUSTER_STATUS_LABELS[locale][status]
}

export function formatAlertStatus(status: AlertStatus, locale: SupportedLocale): string {
  return ALERT_STATUS_LABELS[locale][status]
}

export function formatAlertSeverity(severity: AlertSeverity, locale: SupportedLocale): string {
  return ALERT_SEVERITY_LABELS[locale][severity]
}

export function formatLanguageCode(langCode: string, locale: SupportedLocale): string {
  const normalized = langCode.toLowerCase()
  return LANGUAGE_NAMES[locale][normalized] || normalized.toUpperCase()
}
