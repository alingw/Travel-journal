// Pure expense-splitting math for the shared "go Dutch" ledger.
// Everyone in an expense's `sharedBy` owes an equal share; balances net paid vs.
// owed, and `settle` turns those balances into the fewest sensible transfers.

import type { Expense } from '../types'

export interface Balance {
  name: string
  paid: number // total this person fronted
  share: number // total this person owes for their portions
  net: number // paid - share (positive: owed back; negative: owes)
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function totalSpent(expenses: Expense[]): number {
  return round2(expenses.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0))
}

// Balances for every participant plus anyone referenced by an expense.
export function computeBalances(participants: string[], expenses: Expense[]): Balance[] {
  const paid: Record<string, number> = {}
  const share: Record<string, number> = {}
  const ensure = (n: string) => {
    if (paid[n] === undefined) paid[n] = 0
    if (share[n] === undefined) share[n] = 0
  }
  participants.forEach(ensure)

  for (const e of expenses) {
    if (!(e.amount > 0)) continue
    ensure(e.paidBy)
    paid[e.paidBy] += e.amount
    const sharers = e.sharedBy && e.sharedBy.length ? e.sharedBy : participants
    if (!sharers.length) continue
    const per = e.amount / sharers.length
    for (const s of sharers) {
      ensure(s)
      share[s] += per
    }
  }

  return Object.keys(paid).map((name) => ({
    name,
    paid: round2(paid[name]),
    share: round2(share[name]),
    net: round2(paid[name] - share[name]),
  }))
}

// Greedy minimal-cash-flow: match the biggest debtor to the biggest creditor.
export function settle(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ name: b.name, amt: -b.net }))
    .sort((a, b) => b.amt - a.amt)
  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ name: b.name, amt: b.net }))
    .sort((a, b) => b.amt - a.amt)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const amt = round2(Math.min(d.amt, c.amt))
    if (amt > 0) transfers.push({ from: d.name, to: c.name, amount: amt })
    d.amt = round2(d.amt - amt)
    c.amt = round2(c.amt - amt)
    if (d.amt <= 0.005) i++
    if (c.amt <= 0.005) j++
  }
  return transfers
}
