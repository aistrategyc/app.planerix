type FormatOptions = {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

type MoneyOptions = FormatOptions & {
  currencyCode?: string
  compact?: boolean
  compactDigits?: number
}

const DEFAULT_CURRENCY_CODE = "UAH"
const DEFAULT_COMPACT_DIGITS = 1

const detectCurrencyCode = (raw: string): string | null => {
  const lower = raw.toLowerCase()
  if (raw.includes("€") || lower.includes("eur")) return "EUR"
  if (raw.includes("₴") || lower.includes("uah") || lower.includes("грн")) return "UAH"
  if (raw.includes("$") || lower.includes("usd")) return "USD"
  return null
}

export const parseNumeric = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === "number") return Number.isNaN(value) ? null : value
  if (typeof value !== "string") return null

  const cleaned = value.replace(/[^\d.,-]/g, "")
  if (!cleaned) return null

  const lastDot = cleaned.lastIndexOf(".")
  const lastComma = cleaned.lastIndexOf(",")
  const decimalSep = lastDot > lastComma ? "." : lastComma > lastDot ? "," : null

  let normalized = cleaned
  if (decimalSep) {
    const parts = cleaned.split(decimalSep)
    const intPart = parts.slice(0, -1).join(decimalSep).replace(/[.,]/g, "")
    const fracPart = parts[parts.length - 1]
    normalized = `${intPart}.${fracPart}`
  } else {
    normalized = cleaned.replace(/[.,]/g, "")
  }

  const parsed = Number(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

const numberFormatter = (options?: FormatOptions) =>
  new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  })

const formatCompactValue = (value: number, digits: number = DEFAULT_COMPACT_DIGITS) => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(digits)}B`
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(digits)}M`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(digits)}K`
  }
  return numberFormatter({ maximumFractionDigits: digits }).format(value)
}

const currencySymbol = (currencyCode: string) => {
  switch (currencyCode) {
    case "UAH":
      return "₴"
    case "USD":
      return "$"
    case "EUR":
      return "€"
    case "RUB":
      return "₽"
    default:
      return `${currencyCode} `
  }
}

export const formatNumber = (value: number | string | null | undefined, options?: FormatOptions) => {
  const parsed = parseNumeric(value)
  if (parsed == null) return "—"
  return numberFormatter(options).format(parsed)
}

export const formatCompactNumber = (
  value: number | string | null | undefined,
  options?: { digits?: number }
) => {
  const parsed = parseNumeric(value)
  if (parsed == null) return "—"
  return formatCompactValue(parsed, options?.digits ?? DEFAULT_COMPACT_DIGITS)
}

export const formatCurrency = (value: number | string | null | undefined, options?: MoneyOptions) => {
  const parsed = parseNumeric(value)
  if (parsed == null) return "—"
  let currencyCode = options?.currencyCode ?? DEFAULT_CURRENCY_CODE
  if (typeof value === "string") {
    currencyCode = detectCurrencyCode(value) ?? currencyCode
  }
  if (options?.compact) {
    const compactDigits = options.compactDigits ?? DEFAULT_COMPACT_DIGITS
    return `${currencySymbol(currencyCode)}${formatCompactValue(parsed, compactDigits)}`
  }
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(parsed)
}

export const formatPercent = (
  value: number | string | null | undefined,
  options?: number | { digits?: number; assumeRatio?: boolean }
) => {
  const parsed = parseNumeric(value)
  if (parsed == null) return "—"
  const normalizedOptions = typeof options === "number" ? { digits: options } : options
  const digits = normalizedOptions?.digits ?? 1
  const assumeRatio = normalizedOptions?.assumeRatio ?? true
  const normalized = assumeRatio && Math.abs(parsed) <= 1 ? parsed * 100 : parsed
  return `${normalized.toFixed(digits)}%`
}
