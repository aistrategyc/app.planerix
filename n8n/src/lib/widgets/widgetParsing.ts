import { z } from "zod"

export type UnknownRecord = Record<string, unknown>

export type WidgetParseIssue = {
  index: number
  message: string
}

const isPlainObject = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

export const snakeToCamelKey = (key: string): string =>
  key.replace(/_([a-z0-9])/g, (_, chr: string) => chr.toUpperCase())

/**
 * Shallow camelization for widget rows.
 * We intentionally keep it shallow because widget payloads are typically flat,
 * and deep conversion risks surprising consumers (and is slower).
 */
export const camelizeRecordShallow = (input: UnknownRecord): UnknownRecord => {
  const out: UnknownRecord = {}
  for (const [key, value] of Object.entries(input)) {
    out[snakeToCamelKey(key)] = value
  }
  return out
}

export const camelizeUnknownRecordShallow = (input: unknown): UnknownRecord => {
  if (!isPlainObject(input)) return {}
  return camelizeRecordShallow(input)
}

/**
 * Add non-enumerable camelCase accessors for snake_case keys.
 *
 * Why:
 * - Keeps Object.keys() stable (no duplicate columns in generic tables)
 * - Allows legacy code to read either `row.foo_bar` or `row.fooBar`
 *
 * Note:
 * - Shallow on purpose (widget rows are typically flat).
 */
export const addCamelAccessorsShallow = (input: UnknownRecord): UnknownRecord => {
  for (const key of Object.keys(input)) {
    const camel = snakeToCamelKey(key)
    if (camel === key) continue
    if (Object.prototype.hasOwnProperty.call(input, camel)) continue

    Object.defineProperty(input, camel, {
      enumerable: false,
      configurable: true,
      get: () => input[key],
      set: (value: unknown) => {
        input[key] = value
      },
    })
  }
  return input
}

export const addCamelAccessorsUnknownRecordShallow = (input: unknown): unknown => {
  if (!isPlainObject(input)) return input
  return addCamelAccessorsShallow(input)
}

export const parseWidgetRows = <T>(
  rows: unknown,
  rowSchema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: { camelize?: boolean } = {}
): T[] => {
  const array = z.array(z.unknown()).parse(rows)
  const mapped = options.camelize
    ? array.map((row) => camelizeUnknownRecordShallow(row))
    : array
  return z.array(rowSchema).parse(mapped)
}

export const parseWidgetRowsSafe = <T>(
  rows: unknown,
  rowSchema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: { camelize?: boolean } = {}
): { items: T[]; issues: WidgetParseIssue[] } => {
  if (!Array.isArray(rows)) {
    return {
      items: [],
      issues: [{ index: -1, message: "Expected array of rows" }],
    }
  }

  const items: T[] = []
  const issues: WidgetParseIssue[] = []

  rows.forEach((row, index) => {
    const mapped = options.camelize ? camelizeUnknownRecordShallow(row) : row
    const parsed = rowSchema.safeParse(mapped)
    if (parsed.success) {
      items.push(parsed.data)
      return
    }

    const message = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ")
    issues.push({ index, message: message || "Invalid row" })
  })

  return { items, issues }
}
