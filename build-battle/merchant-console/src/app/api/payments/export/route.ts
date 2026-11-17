import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Query params (all validated here, never trusted from the client):
 * - the usual payment filters, via `parseFilters`
 * - `scope`: `filter` (default) or `all`
 * - `columns`: comma-separated subset of `EXPORT_COLUMNS`; omitted means the
 *   defaults, which leave out the card last four
 *
 * Rows come from the shared query builder, unpaginated, so the file holds
 * every matching payment rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const selection = parseExportColumns(params.get("columns"))
  if (!selection.ok) {
    return NextResponse.json({ error: selection.error }, { status: 400 })
  }

  const scope = parseExportScope(params.get("scope"))
  const parsed = parseFilters(params)
  const filters: PaymentFilters =
    scope === "all"
      ? { sort: parsed.sort, direction: parsed.direction }
      : parsed

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportScopeLabel(scope, filters))

  return new Response(toCsv(rows, selection.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
