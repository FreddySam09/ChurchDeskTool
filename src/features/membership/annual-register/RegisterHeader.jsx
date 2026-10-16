
import { getRegisterSummary } from './annualRegisterUtils'

export default function RegisterHeader({
  register,
  entries = [],
  working = false,
  onStatusChange,
}) {
  if (!register) return null

  const summary = getRegisterSummary(entries)
  const isFinalised = register.status === 'Finalised'

  return (
    <section className="rounded-2xl border border-[#e9e9eb] bg-white p-5">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-[#e9e9eb] bg-[#f7f7f8] px-2 py-1 text-xs text-[#53555e]">
              {register.register_year}
            </span>

            <span className="rounded-md border border-[#e9e9eb] bg-[#f7f7f8] px-2 py-1 text-xs text-[#777984]">
              Annual membership register
            </span>
          </div>

          <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight text-[#131418]">
            {register.name}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777984]">
            Review membership entries, check household heads, and prepare the
            yearly register before it is finalised.
          </p>

          {register.notes && (
            <p className="mt-3 text-sm text-[#53555e]">
              {register.notes}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!isFinalised && register.status === 'Draft' && (
            <button
              type="button"
              disabled={working}
              onClick={() => onStatusChange('Under Review')}
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
            >
              Submit for review
            </button>
          )}

          {!isFinalised && register.status === 'Under Review' && (
            <button
              type="button"
              disabled={working}
              onClick={() => onStatusChange('Draft')}
              className="rounded-lg border border-[#e5e5e7] bg-white px-4 py-2 text-sm font-medium text-[#25262c] transition hover:bg-[#f7f7f8] disabled:opacity-50"
            >
              Return to draft
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard label="Included entries" value={summary.total} />
        <SummaryCard label="People assigned" value={summary.people} />
        <SummaryCard label="Removed entries" value={summary.removed} />
        <SummaryCard
          label="Heads needing review"
          value={summary.needsHeadReview}
          warning={summary.needsHeadReview > 0}
        />
      </div>

      {summary.needsHeadReview > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          {summary.needsHeadReview} included entr
          {summary.needsHeadReview === 1 ? 'y needs' : 'ies need'} a designated
          head. Review these before finalisation.
        </div>
      )}

      {isFinalised && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          This register is finalised and read-only.
        </div>
      )}
    </section>
  )
}

function SummaryCard({ label, value, warning = false }) {
  return (
    <div className="rounded-xl border border-[#eeeeef] bg-[#f8f8f9] p-4">
      <p className="text-xs text-[#777984]">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          warning ? 'text-amber-700' : 'text-[#131418]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
