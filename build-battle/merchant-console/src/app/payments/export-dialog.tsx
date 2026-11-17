"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * Options for the payments export. The file itself is built by
 * `GET /api/payments/export`, which validates every choice made here; this
 * component only assembles the URL.
 */
export function ExportDialog({
  filterQuery,
  filteredCount,
  allCount,
}: {
  /** The active filters as a query string, without paging. */
  filterQuery: string
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<ExportScope>("filter")

  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "all" ? allCount : filteredCount

  const toggle = (column: ExportColumn) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })

  const params = new URLSearchParams(filterQuery)
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="text-sm text-gray-500">
            Choose what goes into the CSV. Amounts are formatted, with the
            currency in its own column.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6 py-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              <ScopeOption
                value="filter"
                checked={scope === "filter"}
                onSelect={setScope}
                label="Current filter"
                count={filteredCount}
              />
              <ScopeOption
                value="all"
                checked={scope === "all"}
                onSelect={setScope}
                label="All payments"
                count={allCount}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {columns.length === 0 && (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-500">
                Choose at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>
        <DrawerFooter className="mt-auto items-center justify-between gap-3 sm:justify-between">
          <p className="text-sm text-gray-500" aria-live="polite">
            {rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"}
          </p>
          <div className="flex gap-2">
            <DrawerClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DrawerClose>
            {columns.length === 0 ? (
              <Button disabled>Download</Button>
            ) : (
              <Button asChild>
                <a href={href} download>
                  Download
                </a>
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ScopeOption({
  value,
  checked,
  onSelect,
  label,
  count,
}: {
  value: ExportScope
  checked: boolean
  onSelect: (value: ExportScope) => void
  label: string
  count: number
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="radio"
        name="scope"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="size-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
      />
      {label}
      <span className="text-gray-500 tabular-nums">
        ({count.toLocaleString()} {count === 1 ? "row" : "rows"})
      </span>
    </label>
  )
}
