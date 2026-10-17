const EVENT_LABELS = {
  DRAFT_CREATED: "Draft created",
  REGISTER_READY: "Register prepared",
  SNAPSHOT_CREATED: "Membership snapshot created",
  STATUS_CHANGED: "Register status changed",
  ENTRIES_REORDERED: "Entries reordered",
  BRANCH_SPLIT_IN_DRAFT: "Branch marked for independent split",
  DRAFT_RESYNCED: "Draft resynced",
  PROPOSED_NUMBER_CHANGED: "Membership number changed",
  BRANCH_SPLIT_UNDONE: "Branch restored",
};

export default function RegisterHistory({ history = [], loading = false }) {
  return (
    <section className="rounded-2xl border border-[#e9e9eb] bg-white">
      <div className="border-b border-[#e9e9eb] p-4">
        <h2 className="text-sm font-semibold text-[#131418]">
          Register activity
        </h2>
        <p className="mt-1 text-xs text-[#777984]">
          Recent recorded changes to this register.
        </p>
      </div>

      <div className="p-4">
        {loading ? (
          <p className="text-sm text-[#777984]">Loading activity…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-[#92939b]">
            No activity has been recorded yet.
          </p>
        ) : (
          <ol className="space-y-4">
            {history.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#92939b]" />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#25262c]">
                    {EVENT_LABELS[event.event_type] || event.event_type}
                  </p>

                  <p className="mt-1 text-xs text-[#92939b]">
                    {event.created_at
                      ? new Date(event.created_at).toLocaleString()
                      : "Time unavailable"}
                  </p>

                  {event.details && Object.keys(event.details).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-[#777984] hover:text-[#25262c]">
                        View details
                      </summary>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#f4f4f5] p-3 text-xs text-[#53555e]">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
