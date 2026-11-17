import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * `EXPORT_COLUMNS` is the allowlist: the only column names the export route
 * accepts from the client. Ops picks a subset (NWP-101); the card last four
 * is left out unless someone asks for it, because these files go to merchants.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/** What ships when nobody chooses: everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ColumnSelection =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validates the `columns` query param against the allowlist.
 *
 * Missing means the defaults. Otherwise a comma-separated list, kept in the
 * order given, duplicates dropped. Any unknown name, or nothing at all, is
 * rejected: an empty file is never the right answer.
 */
export function parseExportColumns(param: string | null): ColumnSelection {
  if (param === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = param
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  const unknown = requested.filter((name) => !isExportColumn(name))
  if (unknown.length > 0) {
    return { ok: false, error: "One or more requested columns are not available." }
  }

  return { ok: true, columns: [...new Set(requested as ExportColumn[])] }
}

export const EXPORT_SCOPES = ["filter", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

/** `all` or `filter`; anything else falls back to the current filter. */
export function parseExportScope(param: string | null): ExportScope {
  return param === "all" ? "all" : "filter"
}

/**
 * The scope part of the filename. Status is already allowlisted by
 * `parseFilters`, so it is safe to put in a filename; free-text filters
 * (search, merchant, dates) are summarized as "filtered" rather than echoed.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  if (columns.length === 0) {
    throw new Error("toCsv needs at least one column")
  }
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

export function exportFilename(date = new Date(), scopeLabel?: string): string {
  const day = date.toISOString().slice(0, 10)
  return scopeLabel ? `payments-${scopeLabel}-${day}.csv` : `payments-${day}.csv`
}
