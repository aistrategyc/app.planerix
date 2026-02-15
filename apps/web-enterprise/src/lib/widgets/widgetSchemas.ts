import { z } from "zod"

const coerceOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  const str = String(value).trim()
  return str ? str : undefined
}

const coerceOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : undefined
}

const zOptString = z.preprocess(coerceOptionalString, z.string().optional())
const zOptNumber = z.preprocess(coerceOptionalNumber, z.number().finite().optional())

// Note: widget rows are often "wide" and can evolve. We keep schemas permissive via `.passthrough()`,
// but strongly type fields we compute with in the UI.

export const campaignsTopMetricsRowSchema = z
  .object({
    dateKey: zOptString,
    dayKey: zOptString,
    asOfDate: zOptString,
    platform: zOptString,
    channel: zOptString,
    product: zOptString,

    adsSpendTotal: zOptNumber,
    spend: zOptNumber,
    metaSpend: zOptNumber,
    gadsSpend: zOptNumber,

    crmPaidSum: zOptNumber,
    paidSum: zOptNumber,
    paymentsSum: zOptNumber,
    revenue: zOptNumber,
    contractsSum: zOptNumber,

    crmContracts: zOptNumber,
    contractsCnt: zOptNumber,
    contracts: zOptNumber,
    gadsContracts: zOptNumber,

    crmLeads: zOptNumber,
    crmRequests: zOptNumber,
    leadsCnt: zOptNumber,
    metaLeads: zOptNumber,
    gadsLeads: zOptNumber,

    metaPaidSum: zOptNumber,
  })
  .passthrough()

export const crmFunnelRowSchema = z
  .object({
    dateKey: zOptString,
    requestsCnt: zOptNumber,
    requests: zOptNumber,
    leadsCnt: zOptNumber,
    leads: zOptNumber,
    crmLeads: zOptNumber,
    contractsCnt: zOptNumber,
    contracts: zOptNumber,
    crmContracts: zOptNumber,
    paymentsCnt: zOptNumber,
    paymentsSum: zOptNumber,
    paidSum: zOptNumber,
  })
  .passthrough()

export const creativesTableRowSchema = z
  .object({
    creativeId: zOptString,
    adId: zOptString,
    creativeName: zOptString,
    creativeTitle: zOptString,
    adName: zOptString,
    permalinkUrl: zOptString,
    linkUrl: zOptString,
    creativeUrl: zOptString,

    impressions: zOptNumber,
    clicks: zOptNumber,
    spend: zOptNumber,
    conversions: zOptNumber,
    leads: zOptNumber,
    contracts: zOptNumber,
    revenue: zOptNumber,
    ctr: zOptNumber,
    cpc: zOptNumber,
    cpm: zOptNumber,
    roas: zOptNumber,
    cvr: zOptNumber,
  })
  .passthrough()

export const metaCreativeFatigue7dRowSchema = z
  .object({
    creativeId: zOptString,
    creativeName: zOptString,
    adName: zOptString,
    baselineDays: zOptNumber,
    ctrPrev7d: zOptNumber,
    ctr7d: zOptNumber,
    fatigueScore: zOptNumber,
  })
  .passthrough()

export const adsKpiTotalRowSchema = z
  .object({
    dateKey: zOptString,
    dayKey: zOptString,
    platform: zOptString,
    currencyCode: zOptString,

    impressions: zOptNumber,
    clicks: zOptNumber,
    spend: zOptNumber,
    conversions: zOptNumber,
    platformLeads: zOptNumber,
    conversionValue: zOptNumber,

    crmRequestsCnt: zOptNumber,
    contractsCnt: zOptNumber,
    revenueSum: zOptNumber,
    revenueTotalCost: zOptNumber,
    paymentsSum: zOptNumber,
    paidSum: zOptNumber,

    ctr: zOptNumber,
    cpc: zOptNumber,
    cpa: zOptNumber,
    cpm: zOptNumber,
    cpl: zOptNumber,
    cac: zOptNumber,
    roas: zOptNumber,
    paybackRate: zOptNumber,

    spendSharePct: zOptNumber,
    leadsSharePct: zOptNumber,
    contractsSharePct: zOptNumber,
    revenueSharePct: zOptNumber,
    effShareRatioContracts: zOptNumber,
  })
  .passthrough()

export const adsChannelMixDailyRowSchema = z
  .object({
    dateKey: zOptString,
    dayKey: zOptString,
    channel: zOptString,
    platform: zOptString,

    spend: zOptNumber,
    leadsCnt: zOptNumber,
    contractsCnt: zOptNumber,
    revenueSum: zOptNumber,
    paymentsSum: zOptNumber,

    spendSharePct: zOptNumber,
    leadsSharePct: zOptNumber,
    contractsSharePct: zOptNumber,
    revenueSharePct: zOptNumber,

    cpl: zOptNumber,
    cac: zOptNumber,
    roas: zOptNumber,
    paybackRate: zOptNumber,
    kefCommercial: zOptNumber,
  })
  .passthrough()

export const sourcesRevenueSplitRowSchema = z
  .object({
    dateKey: zOptString,
    dayKey: zOptString,

    sourceName: zOptString,
    sourceUserName: zOptString,
    sourceTypeName: zOptString,
    sourceOwner: zOptString,
    sourceType: zOptString,

    contractsCnt: zOptNumber,
    contracts: zOptNumber,
    revenueSum: zOptNumber,
    contractsSum: zOptNumber,
    revenueTotalCost: zOptNumber,
    paymentsSum: zOptNumber,
    paidSum: zOptNumber,
    prepaymentSum: zOptNumber,
    prepayment: zOptNumber,
    crmRequestsCnt: zOptNumber,
    leadsCnt: zOptNumber,
    spend: zOptNumber,
  })
  .passthrough()

export const widgetRowSchemasByKey = {
  "campaigns.top_metrics": campaignsTopMetricsRowSchema,
  "ads.kpi_total": adsKpiTotalRowSchema,
  "ads.channel_mix_daily": adsChannelMixDailyRowSchema,
  "sources.revenue_split": sourcesRevenueSplitRowSchema,
  "crm.funnel": crmFunnelRowSchema,
  "creatives.table": creativesTableRowSchema,
  "ads.meta_creative_fatigue_7d": metaCreativeFatigue7dRowSchema,
} as const

export const getWidgetRowSchema = (widgetKey: string): z.ZodTypeAny | undefined => {
  return widgetRowSchemasByKey[widgetKey as keyof typeof widgetRowSchemasByKey]
}
