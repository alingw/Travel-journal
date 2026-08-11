import { useMemo, useState } from 'react'
import { useTrip } from '../store/tripStore'
import { getMyName, setMyName } from '../utils/settings'
import { computeBalances, settle, totalSpent } from '../services/split'
import { todayIso, dayNumLabel } from '../utils/dates'

// Shared "go Dutch" ledger: anyone with the trip code opens this page, says who
// they are, logs what they paid, and everyone sees the running who-owes-whom.
export function SplitView() {
  const trip = useTrip((s) => s.trip)
  const setCurrency = useTrip((s) => s.setCurrency)
  const addParticipant = useTrip((s) => s.addParticipant)
  const removeParticipant = useTrip((s) => s.removeParticipant)
  const addExpense = useTrip((s) => s.addExpense)
  const updateExpense = useTrip((s) => s.updateExpense)
  const deleteExpense = useTrip((s) => s.deleteExpense)

  const participants = trip?.participants ?? []
  const expenses = trip?.expenses ?? []
  const cur = trip?.currency || '$'
  const money = (n: number) => `${cur}${n.toFixed(2)}`

  const [myName, setMyNameState] = useState(getMyName())
  const chooseMe = (name: string) => {
    setMyNameState(name)
    setMyName(name)
  }

  // ---- People management ----
  const [newPerson, setNewPerson] = useState('')
  function addPerson() {
    const nm = newPerson.trim()
    if (!nm) return
    addParticipant(nm)
    if (!myName) chooseMe(nm)
    setNewPerson('')
  }

  // ---- Expense form (add / edit) ----
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState(todayIso())
  // People NOT sharing an expense (empty = everyone splits it). Storing the
  // *exclusions* keeps new participants included by default and preserves opt-outs.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')

  const defaultPayer = participants.includes(myName) ? myName : participants[0] ?? ''
  const payer = paidBy || defaultPayer
  const sharedBy = participants.filter((p) => !excluded.has(p))

  function toggleShare(name: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setAmount('')
    setExcluded(new Set())
    setErr('')
    // keep payer + date — you usually log several in a row
  }

  function startEdit(id: string) {
    const e = expenses.find((x) => x.id === id)
    if (!e) return
    setEditingId(e.id)
    setTitle(e.title)
    setAmount(String(e.amount))
    setPaidBy(e.paidBy)
    setDate(e.date || todayIso())
    setExcluded(new Set(participants.filter((p) => !e.sharedBy.includes(p))))
    setErr('')
  }

  function submit() {
    const amt = Math.round(parseFloat(amount) * 100) / 100
    if (!isFinite(amt) || amt <= 0) return setErr('Enter an amount greater than 0')
    if (!payer) return setErr('Pick who paid')
    if (sharedBy.length === 0) return setErr('Pick at least one person to split with')
    const data = {
      title: title.trim() || 'Expense',
      amount: amt,
      paidBy: payer,
      sharedBy,
      date,
      createdBy: myName || undefined,
    }
    if (editingId) updateExpense(editingId, data)
    else addExpense(data)
    resetForm()
  }

  const balances = useMemo(() => computeBalances(participants, expenses), [participants, expenses])
  const transfers = useMemo(() => settle(balances), [balances])
  const total = totalSpent(expenses)
  const perPerson = participants.length ? total / participants.length : 0

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [expenses],
  )

  return (
    <div className="split-wrap">
      <div className="split-head">
        <div>
          <h2 className="today-head">Split &amp; settle</h2>
          <div className="tray-hint">
            Everyone logs what they paid; the app works out who owes whom, split evenly.
          </div>
        </div>
        <label className="split-cur">
          <span className="u-label">Currency</span>
          <input
            type="text"
            value={cur}
            maxLength={4}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency symbol"
          />
        </label>
      </div>

      {/* People + who am I */}
      <section className="split-card">
        <div className="section-title">People</div>
        <div className="tray-hint">Add everyone sharing costs. Your pick sets who “you” are.</div>
        <div className="person-chips">
          {participants.length === 0 && <span className="day-empty">No one yet — add people below.</span>}
          {participants.map((p) => (
            <span key={p} className={`person-chip ${p === myName ? 'me' : ''}`}>
              <button
                className="person-name"
                title="This is me"
                onClick={() => chooseMe(p)}
              >
                {p === myName ? '★ ' : ''}
                {p}
              </button>
              <button
                className="person-x"
                title="Remove person"
                onClick={() => removeParticipant(p)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="split-add-person">
          <input
            type="text"
            placeholder="Add a person…"
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPerson()}
          />
          <button className="btn ghost" onClick={addPerson}>
            ＋ Add
          </button>
        </div>
      </section>

      {/* Add / edit an expense */}
      <section className="split-card">
        <div className="section-title">{editingId ? 'Edit expense' : 'Add what you paid'}</div>
        {participants.length === 0 ? (
          <div className="tray-hint">Add at least one person first.</div>
        ) : (
          <>
            {err && <div className="banner">{err}</div>}
            <div className="split-form">
              <div className="field">
                <label>What for</label>
                <input
                  type="text"
                  placeholder="Dinner, taxi, hotel…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="field-row">
                <div className="field" style={{ flex: '0 0 120px' }}>
                  <label>Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Paid by</label>
                  <select value={payer} onChange={(e) => setPaidBy(e.target.value)}>
                    {participants.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: '0 0 150px' }}>
                  <label>Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Split between ({sharedBy.length})</label>
                <div className="share-toggles">
                  {participants.map((p) => (
                    <button
                      key={p}
                      className={`share-toggle ${excluded.has(p) ? '' : 'on'}`}
                      onClick={() => toggleShare(p)}
                    >
                      {excluded.has(p) ? '○' : '●'} {p}
                    </button>
                  ))}
                </div>
                {sharedBy.length > 0 && amount && parseFloat(amount) > 0 && (
                  <div className="split-each">
                    = {money(Math.round((parseFloat(amount) / sharedBy.length) * 100) / 100)} each
                  </div>
                )}
              </div>
              <div className="modal-actions">
                {editingId && (
                  <button className="btn ghost" onClick={resetForm}>
                    Cancel
                  </button>
                )}
                <div className="spacer" />
                <button className="btn" onClick={submit}>
                  {editingId ? 'Save' : '＋ Add expense'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* The ledger */}
      {expenses.length > 0 && (
        <section className="split-card">
          <div className="section-title">
            Expenses · {money(total)} total
            {participants.length > 0 && <span className="split-avg"> · {money(perPerson)} / person avg</span>}
          </div>
          <div className="expense-list">
            {sortedExpenses.map((e) => (
              <div key={e.id} className="expense-row">
                <div className="expense-main">
                  <div className="expense-title">{e.title}</div>
                  <div className="expense-meta">
                    {e.paidBy} paid · split {e.sharedBy.length}{' '}
                    {e.sharedBy.length === 1 ? 'way' : 'ways'}
                    {e.date ? ` · ${dayNumLabel(e.date)}` : ''}
                  </div>
                </div>
                <div className="expense-amt">{money(e.amount)}</div>
                <div className="expense-actions">
                  <button className="mini-btn" title="Edit" onClick={() => startEdit(e.id)}>
                    ✎
                  </button>
                  <button className="mini-btn" title="Delete" onClick={() => deleteExpense(e.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Balances */}
      {balances.length > 0 && (
        <section className="split-card">
          <div className="section-title">Balances</div>
          <div className="balance-list">
            {balances.map((b) => (
              <div key={b.name} className="balance-row">
                <span className="balance-name">
                  {b.name === myName ? '★ ' : ''}
                  {b.name}
                </span>
                <span className="balance-detail">
                  paid {money(b.paid)} · owes {money(b.share)}
                </span>
                <span
                  className={`balance-net ${b.net > 0.005 ? 'pos' : b.net < -0.005 ? 'neg' : ''}`}
                >
                  {b.net > 0.005
                    ? `gets back ${money(b.net)}`
                    : b.net < -0.005
                    ? `owes ${money(-b.net)}`
                    : 'settled'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Who pays whom */}
      {transfers.length > 0 && (
        <section className="split-card">
          <div className="section-title">Settle up</div>
          <div className="tray-hint">The simplest set of payments to square everyone up.</div>
          <div className="settle-list">
            {transfers.map((t, i) => (
              <div key={i} className="settle-row">
                <span className="settle-from">{t.from}</span>
                <span className="settle-arrow">→</span>
                <span className="settle-to">{t.to}</span>
                <span className="settle-amt">{money(t.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
