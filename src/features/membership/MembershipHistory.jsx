
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, History } from "lucide-react";
import { getMembershipHistory } from "../../services/membershipService";

function formatDateTime(value) {
  if (!value) return "Time unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventType(value) {
  if (!value) return "Membership update";

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDetails(details) {
  if (!details) return null;

  if (typeof details === "string") {
    return details;
  }

  if (typeof details === "object") {
    return JSON.stringify(details, null, 2);
  }

  return String(details);
}

export default function MembershipHistory({ membershipRowId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    if (!membershipRowId) {
      setHistory([]);
      setError("Membership record ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const events = await getMembershipHistory({ membershipRowId });
      setHistory(Array.isArray(events) ? events : []);
    } catch (err) {
      setError(err.message || "Unable to load membership history.");
    } finally {
      setLoading(false);
    }
  }, [membershipRowId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <section className="mt-5 overflow-hidden rounded-[18px] border border-[#ececed] bg-white shadow-[0_1px_2px_rgba(15,15,20,0.03)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f1] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f1f2f5] text-[#53555e]">
            <History size={17} />
          </span>

          <div>
            <h2 className="text-[14px] font-bold text-[#131418]">
              Membership History
            </h2>
            <p className="mt-1 text-[11.5px] text-[#92939b]">
              Recorded events for this membership.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#e5e5e7] px-3 py-2 text-[11px] font-semibold text-[#53555e] transition hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <div className="p-5">
        {loading ? (
          <p className="text-[12px] text-[#777984]">
            Loading membership history...
          </p>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-5 text-red-700"
          >
            {error}
            <button
              type="button"
              onClick={loadHistory}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="py-5 text-center">
            <History
              size={22}
              className="mx-auto mb-2 text-[#b0b1b8]"
            />
            <p className="text-[12px] font-medium text-[#53555e]">
              No history recorded yet
            </p>
            <p className="mt-1 text-[11px] text-[#92939b]">
              Recorded membership events will appear here.
            </p>
          </div>
        ) : (
          <ol className="space-y-5">
            {history.map((event, index) => {
              const eventType =
                event.event_type ||
                event.event_name ||
                event.action ||
                event.title;

              const details = formatDetails(
                event.details ??
                  event.description ??
                  event.notes ??
                  event.reason,
              );

              return (
                <li
                  key={event.id || `${event.created_at}-${index}`}
                  className="relative flex gap-3"
                >
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#7c89c9]" />

                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-[#25262c]">
                      {formatEventType(eventType)}
                    </p>

                    <p className="mt-1 text-[10.5px] text-[#92939b]">
                      {formatDateTime(event.created_at)}
                    </p>

                    {details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-[#626575] hover:text-[#25262c]">
                          View event details
                        </summary>

                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#f6f6f7] p-3 text-[10.5px] leading-5 text-[#53555e]">
                          {details}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
