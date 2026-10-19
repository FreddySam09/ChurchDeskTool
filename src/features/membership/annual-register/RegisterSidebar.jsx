import { Trash2 } from "lucide-react";
const STATUS_STYLES = {
  Draft: "border-[#dedfe3] bg-[#f1f1f3] text-[#53555e]",
  "Under Review": "border-amber-200 bg-amber-50 text-amber-800",
  Finalised: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function StatusBadge({ status }) {
  const style =
    STATUS_STYLES[status] ?? "border-[#e5e5e7] bg-[#f1f1f3] text-[#53555e]";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {status || "Unknown"}
    </span>
  );
}

export default function RegisterSidebar({
  registers = [],
  selectedRegisterId,
  onSelect,
  onCreate,
  onDelete,
  loading = false,
  working = false,
}) {
  return (
    <aside className="flex h-[360px] min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e9e9eb] bg-white">
      <div className="border-b border-[#e9e9eb] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#131418]">
              Annual registers
            </h2>
            <p className="mt-1 text-xs text-[#777984]">
              Manage yearly membership records
            </p>
          </div>

          <button
            type="button"
            onClick={onCreate}
            disabled={working}
            className="shrink-0 rounded-lg bg-[#191a1f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#33343a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + New draft
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && registers.length === 0 ? (
          <p className="p-4 text-sm text-[#777984]">Loading registers…</p>
        ) : registers.length === 0 ? (
          <div className="p-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7f7f8] text-[#777984]">
              <span aria-hidden="true">▤</span>
            </div>
            <p className="text-sm font-medium text-[#25262c]">
              No registers yet
            </p>
            <p className="mt-1 text-xs leading-5 text-[#92939b]">
              Create a draft to start preparing an annual register.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {registers.map((register) => {
              const isSelected = register.id === selectedRegisterId;
              const canDelete = register.status === "Draft";

              return (
                <li
                  key={register.id}
                  className={`rounded-xl border p-3 transition ${
                    isSelected
                      ? "border-[#d9dadd] bg-[#f2f3f5]"
                      : "border-transparent hover:border-[#e9e9eb] hover:bg-[#f8f8f9]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(register.id)}
                      aria-current={isSelected ? "page" : undefined}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-[#131418]">
                          {register.name}
                        </p>

                        <span className="shrink-0 text-xs font-semibold tabular-nums text-[#777984]">
                          {register.register_year}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-[#777984]">
                        Register year: {register.register_year}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <StatusBadge status={register.status} />

                        <span className="text-[11px] text-[#92939b]">
                          {register.created_at
                            ? new Date(register.created_at).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        title={`Delete draft ${register.name}`}
                        aria-label={`Delete draft ${register.name}`}
                        disabled={working}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(register);
                        }}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#92939b] transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-[#e9e9eb] p-3">
        <p className="text-[11px] leading-5 text-[#92939b]">
          Finalised registers are locked against further changes.
        </p>
      </div>
    </aside>
  );
}
