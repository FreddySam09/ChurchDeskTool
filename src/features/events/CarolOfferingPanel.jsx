
import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import {
  getCarolOfferingsForVisits,
  postCarolOffering,
  saveCarolOffering,
  verifyCarolOffering,
} from '../../services/events/carolOfferingService'

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:ring-4 focus:ring-gray-100 disabled:bg-gray-50 disabled:text-gray-500'

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusStyle(status) {
  if (status === 'Posted') {
    return 'border-blue-200 bg-blue-50 text-blue-700'
  }
  if (status === 'Verified') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export default function CarolOfferingPanel({ visit }) {
  const [offering, setOffering] = useState(null)
  const [amount, setAmount] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadOffering = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const records = await getCarolOfferingsForVisits([visit.id])
      const record = records[0] ?? null

      setOffering(record)
      setAmount(record ? String(record.amount) : '')
    } catch (err) {
      setError(err.message || 'Unable to load the offering.')
    } finally {
      setLoading(false)
    }
  }, [visit.id])

  useEffect(() => {
    loadOffering()
  }, [loadOffering])

  const locked = Boolean(
    offering && offering.verification_status !== 'Unverified',
  )

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const saved = await saveCarolOffering(visit.id, { amount })
      setOffering(saved)
      setAmount(String(saved.amount))
      setNotice('Offering saved.')
    } catch (err) {
      setError(err.message || 'Unable to save the offering.')
    } finally {
      setSaving(false)
    }
  }

  async function handleVerify() {
    if (!offering?.id) return

    if (
      !window.confirm(
        `Verify the offering of ${formatAmount(offering.amount)}?`,
      )
    ) {
      return
    }

    setAction('verify')
    setError('')
    setNotice('')

    try {
      setOffering(await verifyCarolOffering(offering.id))
      setNotice('Offering verified.')
    } catch (err) {
      setError(err.message || 'Unable to verify the offering.')
      await loadOffering()
    } finally {
      setAction('')
    }
  }

  async function handlePost() {
    if (!offering?.id) return

    if (
      !window.confirm(
        `Mark ${formatAmount(offering.amount)} as posted? This does not automatically create a church finance entry.`,
      )
    ) {
      return
    }

    setAction('post')
    setError('')
    setNotice('')

    try {
      setOffering(await postCarolOffering(offering.id))
      setNotice('Offering marked as posted.')
    } catch (err) {
      setError(err.message || 'Unable to post the offering.')
      await loadOffering()
    } finally {
      setAction('')
    }
  }

  const busy = loading || saving || Boolean(action)

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50 sm:px-5"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
            <CircleDollarSign size={19} />
          </span>

          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">
              Offering
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">
              {loading
                ? 'Loading offering…'
                : offering
                  ? formatAmount(offering.amount)
                  : 'No offering recorded'}
            </span>
          </span>

          {offering && (
            <span
              className={`hidden rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${statusStyle(
                offering.verification_status,
              )}`}
            >
              {offering.verification_status}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2 text-gray-500">
          {loading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : expanded ? (
            <ChevronUp size={18} />
          ) : (
            <ChevronDown size={18} />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <RefreshCw size={16} className="animate-spin" />
              Loading offering details…
            </div>
          ) : (
            <>
              {offering && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Recorded amount
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">
                      {formatAmount(offering.amount)}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyle(
                      offering.verification_status,
                    )}`}
                  >
                    {offering.verification_status}
                  </span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Offering amount (₹)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Enter amount (use 0 if none)"
                    disabled={locked || busy}
                    className={inputClass}
                  />
                  <span className="mt-1.5 block text-xs text-gray-500">
                    Enter 0 if the family did not give an offering.
                  </span>
                </label>

                {offering?.verified_at && (
                  <p className="text-xs text-gray-500">
                    Verified {formatDateTime(offering.verified_at)}
                  </p>
                )}

                {offering?.posted_at && (
                  <p className="text-xs text-gray-500">
                    Posted {formatDateTime(offering.posted_at)}
                  </p>
                )}

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
                  >
                    {error}
                  </p>
                )}

                {notice && (
                  <p
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
                  >
                    {notice}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {!locked && (
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save amount'}
                    </button>
                  )}

                  {offering?.verification_status === 'Unverified' && (
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <ShieldCheck size={16} />
                      {action === 'verify' ? 'Verifying…' : 'Verify'}
                    </button>
                  )}

                  {offering?.verification_status === 'Verified' && (
                    <button
                      type="button"
                      onClick={handlePost}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      {action === 'post' ? 'Posting…' : 'Mark as posted'}
                    </button>
                  )}

                  {offering?.verification_status === 'Posted' && (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700">
                      <LockKeyhole size={15} />
                      Record locked
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={loadOffering}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  )
}
