type FormatOptions = {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

type MoneyOptions = FormatOptions & {
  currencyCode?: string
}

const DEFAULT_CURRENCY_CODE = "UAH"

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

export const formatNumber = (value: number | string | null | undefined, options?: FormatOptions) => {
  const parsed = parseNumeric(value)
  if (parsed == null) return "—"
  return numberFormatter(options).format(parsed)
}

export const formatCurrency = (value: number | string | null | undefined, options?: MoneyOptions) => {
  const parsed = parseNumeric(value)
  if (parsed == null) return "—"
  let currencyCode = options?.currencyCode ?? DEFAULT_CURRENCY_CODE
  if (typeof value === "string") {
    currencyCode = detectCurrencyCode(value) ?? currencyCode
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
  options?: { digits?: number; assumeRatio?: boolean }
) => {
  const parsed = parseNumeric(value)
  if (parsed == null) return "—"
  const digits = options?.digits ?? 1
  const assumeRatio = options?.assumeRatio ?? true
  const normalized = assumeRatio && Math.abs(parsed) <= 1 ? parsed * 100 : parsed
  return `${normalized.toFixed(digits)}%`
}
