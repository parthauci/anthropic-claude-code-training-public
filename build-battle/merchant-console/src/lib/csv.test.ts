import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("quotes a bare carriage return so it does not split the row", () => {
    const cr = { ...payment, description: "Order 1180\rsecond line" }
    expect(toCsv([cr], ["description"])).toBe(
      ["description", '"Order 1180\rsecond line"'].join("\n"),
    )
  })

  it("defuses text cells that a spreadsheet would run as a formula", () => {
    for (const lead of ["=", "+", "-", "@"]) {
      const risky = { ...payment, description: `${lead}SUM(A1:A9)` }
      expect(toCsv([risky], ["description"])).toBe(
        ["description", `'${lead}SUM(A1:A9)`].join("\n"),
      )
    }
    const hyperlink = { ...payment, description: '=HYPERLINK("http://x","y")' }
    expect(toCsv([hyperlink], ["description"])).toBe(
      ["description", `"'=HYPERLINK(""http://x"",""y"")"`].join("\n"),
    )
  })

  it("leaves a refund's minus sign on the amount alone", () => {
    const refund = { ...payment, amount: -500 }
    expect(toCsv([refund], ["amount"])).toBe(["amount", "-$5.00"].join("\n"))
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

describe("column selection (NWP-101)", () => {
  it("keeps a requested subset in the order requested, not the allowlist order", () => {
    const selection = parseExportColumns("currency,amount,id")
    expect(selection).toEqual({ ok: true, columns: ["currency", "amount", "id"] })
    if (!selection.ok) throw new Error("expected a valid selection")
    expect(toCsv([payment], selection.columns)).toBe(
      ["currency,amount,id", "USD,$250.00,pay_0001"].join("\n"),
    )
  })

  it("drops duplicate and blank names without reordering", () => {
    expect(parseExportColumns("amount, id,,amount")).toEqual({
      ok: true,
      columns: ["amount", "id"],
    })
  })

  it("leaves the card last four out by default", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )

    const selection = parseExportColumns(null)
    if (!selection.ok) throw new Error("expected the defaults")
    const csv = toCsv([payment], selection.columns)
    expect(csv.split("\n")[0]).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("includes the last four only when asked for", () => {
    const selection = parseExportColumns("id,last4")
    if (!selection.ok) throw new Error("expected a valid selection")
    expect(toCsv([payment], selection.columns)).toBe(
      ["id,last4", "pay_0001,4242"].join("\n"),
    )
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("")).toEqual({
      ok: false,
      error: expect.any(String),
    })
    expect(parseExportColumns(" , ,").ok).toBe(false)
    expect(() => toCsv([payment], [])).toThrow()
  })

  it("rejects a column that is not on the allowlist", () => {
    expect(parseExportColumns("id,card_number").ok).toBe(false)
    expect(parseExportColumns("id,AMOUNT").ok).toBe(false)
  })
})

describe("export scope", () => {
  it("defaults to the current filter and only accepts 'all' otherwise", () => {
    expect(parseExportScope(null)).toBe("filter")
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("everything")).toBe("filter")
  })

  it("labels the file by scope, using the allowlisted status when filtered", () => {
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
    expect(exportScopeLabel("filter", { status: "disputed" })).toBe("disputed")
    expect(exportScopeLabel("filter", { status: "all", search: "x" })).toBe("filtered")
    expect(exportScopeLabel("filter", { status: "all" })).toBe("all")
  })
})

describe("exportFilename", () => {
  it("puts the scope before the UTC date", () => {
    expect(
      exportFilename(new Date("2026-08-13T23:30:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })
})
