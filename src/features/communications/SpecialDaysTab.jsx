
import { useCallback, useEffect, useState } from "react";
import {
  Cake,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Heart,
  LoaderCircle,
  Search,
} from "lucide-react";
import { getSpecialDays } from "../../services/communications/communicationsService";
import {
  exportSpecialDaysToExcel,
  exportSpecialDaysToPdf,
} from "./specialDaysExportService";

const MONTHS = [
  { value: "01", label: "January", days: 31 },
  { value: "02", label: "February", days: 29 },
  { value: "03", label: "March", days: 31 },
  { value: "04", label: "April", days: 30 },
  { value: "05", label: "May", days: 31 },
  { value: "06", label: "June", days: 30 },
  { value: "07", label: "July", days: 31 },
  { value: "08", label: "August", days: 31 },
  { value: "09", label: "September", days: 30 },
  { value: "10", label: "October", days: 31 },
  { value: "11", label: "November", days: 30 },
  { value: "12", label: "December", days: 31 },
];

const WEEK_OPTIONS = [
  { id: "previous", label: "Previous Week", offset: -1 },
  { id: "this", label: "This Week", offset: 0 },
  { id: "next", label: "Next Week", offset: 1 },
];

const inputClass =
  "min-h-[42px] w-full rounded-xl border border-[#e5e5e7] bg-white px-3 py-2 text-sm text-[#303139] outline-none focus:border-[#777985]";

function toMonthDay(date) {
  return {
    month: String(date.getMonth() + 1).padStart(2, "0"),
    day: String(date.getDate()).padStart(2, "0"),
  };
}

function monthDayToServiceDate(value) {
  // Leap year permits February 29. The service ignores the year.
  return `2000-${value.month}-${value.day}`;
}

function getWeekMonthDays(offset = 0) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay() + offset * 7);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  return {
    from: toMonthDay(sunday),
    to: toMonthDay(saturday),
  };
}

function formatMonthDay(value) {
  if (!value?.month || !value?.day) return "—";

  return new Date(
    `2000-${value.month}-${String(value.day).padStart(2, "0")}T12:00:00`,
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function formatRange(from, to) {
  return `${formatMonthDay(from)} – ${formatMonthDay(to)}`;
}

function dateToMonthDay(dateValue) {
  if (!dateValue || String(dateValue).length < 10) return null;

  return {
    month: String(dateValue).slice(5, 7),
    day: String(dateValue).slice(8, 10),
  };
}

function MonthDayFilter({ label, value, onChange, idPrefix }) {
  const month =
    MONTHS.find((item) => item.value === value.month) ?? MONTHS[0];

  const days = Array.from({ length: month.days }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );

  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="mb-2 text-xs font-semibold text-[#686a74]">
        {label}
      </legend>

      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0">
          <span className="sr-only">{label} month</span>
          <select
            id={`${idPrefix}-month`}
            className={inputClass}
            value={value.month}
            onChange={(event) => {
              const nextMonth = MONTHS.find(
                (item) => item.value === event.target.value,
              );

              const nextDay = String(
                Math.min(Number(value.day), nextMonth.days),
              ).padStart(2, "0");

              onChange({
                month: nextMonth.value,
                day: nextDay,
              });
            }}
          >
            {MONTHS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">{label} day</span>
          <select
            id={`${idPrefix}-day`}
            className={inputClass}
            value={value.day}
            onChange={(event) =>
              onChange({ ...value, day: event.target.value })
            }
          >
            {days.map((day) => (
              <option key={day} value={day}>
                {Number(day)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

function SpecialDaysTable({ type, rows }) {
  const isBirthday = type === "birthday";

  const headers = [
    "Membership No.",
    isBirthday ? "Name" : "Couple",
    isBirthday ? "Birthday" : "Wedding Date",
    "Phone",
    "Membership",
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8e8eb] bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-[#ededf0] px-5 py-4">
        <div
          className={`rounded-xl p-2 ${
            isBirthday
              ? "bg-orange-50 text-orange-600"
              : "bg-pink-50 text-pink-600"
          }`}
        >
          {isBirthday ? <Cake size={19} /> : <Heart size={19} />}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-[#1e1e1e]">
            {isBirthday ? "Birthdays" : "Wedding Anniversaries"}
          </h2>
          <p className="mt-0.5 text-xs text-[#858792]">
            {rows.length} {isBirthday ? "people" : "couples"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-[#f8f8f9] text-xs text-[#686a74]">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#f0f0f2]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-8 text-center text-sm text-[#858792]"
                >
                  No {isBirthday ? "birthdays" : "wedding anniversaries"} in
                  this date range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id || row.person_id || row.name}
                  className="hover:bg-[#fafafa]"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#41434b]">
                    {row.membership_number || "—"}
                  </td>

                  <td className="px-4 py-3 font-medium text-[#22232a]">
                    {isBirthday ? row.name : row.couple_name}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[#555762]">
                    {formatMonthDay(
                      dateToMonthDay(
                        isBirthday
                          ? row.date_of_birth
                          : row.date_of_marriage,
                      ),
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[#555762]">
                    {row.phone_number || "—"}
                  </td>

                  <td className="px-4 py-3 text-[#777985]">
                    {row.membership_name || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SpecialDaysTab() {
  const [activeWeek, setActiveWeek] = useState("next");
  const [fromDate, setFromDate] = useState(() => getWeekMonthDays(1).from);
  const [toDate, setToDate] = useState(() => getWeekMonthDays(1).to);

  const [data, setData] = useState({
    birthdays: [],
    anniversaries: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [appliedRange, setAppliedRange] = useState(null);

  const fetchDays = useCallback(async (from, to) => {
    setError("");
    setLoading(true);
    setLoaded(false);

    try {
      const result = await getSpecialDays({
        startDate: monthDayToServiceDate(from),
        endDate: monthDayToServiceDate(to),
      });

      setData({
        birthdays: result.birthdays ?? [],
        anniversaries: result.anniversaries ?? [],
      });

      setAppliedRange({ from, to });
      setLoaded(true);
    } catch (err) {
      setError(err.message || "Unable to load special days.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const nextWeek = getWeekMonthDays(1);

    setActiveWeek("next");
    setFromDate(nextWeek.from);
    setToDate(nextWeek.to);
    fetchDays(nextWeek.from, nextWeek.to);
  }, [fetchDays]);

  function chooseWeek(option) {
    const range = getWeekMonthDays(option.offset);

    setActiveWeek(option.id);
    setFromDate(range.from);
    setToDate(range.to);
    fetchDays(range.from, range.to);
  }

  function changeFrom(value) {
    setFromDate(value);
    setActiveWeek("");
  }

  function changeTo(value) {
    setToDate(value);
    setActiveWeek("");
  }

  function applyCustomRange(event) {
    event.preventDefault();
    fetchDays(fromDate, toDate);
  }

  function exportPdf() {
    if (!loaded || !appliedRange) return;

    exportSpecialDaysToPdf({
      startDate: monthDayToServiceDate(appliedRange.from),
      endDate: monthDayToServiceDate(appliedRange.to),
      ...data,
    });
  }

  function exportExcel() {
    if (!loaded || !appliedRange) return;

    exportSpecialDaysToExcel({
      startDate: monthDayToServiceDate(appliedRange.from),
      endDate: monthDayToServiceDate(appliedRange.to),
      ...data,
    });
  }

  const rangeLabel = appliedRange
    ? formatRange(appliedRange.from, appliedRange.to)
    : formatRange(fromDate, toDate);

  const total = data.birthdays.length + data.anniversaries.length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1b1c21] to-[#0c0d10] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#91a7ff]">
          <CalendarDays size={22} />
        </div>

        <div>
          <h2 className="text-base font-bold">
            Promise Verse for Greetings
          </h2>
          <p className="mt-1 text-sm leading-6 text-white/85">
            “For I know the plans I have for you,” declares the Lord,
            “plans to prosper you and not to harm you, plans to give you
            hope and a future.” — Jeremiah 29:11
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[#e8e8eb] bg-white p-4 sm:p-5">
        <div>
          <h2 className="font-bold text-[#1e1e1e]">Select a week</h2>
          <p className="mt-1 text-sm text-[#777985]">
            Choose a Sunday–Saturday week or set a custom date range below.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {WEEK_OPTIONS.map((option) => {
            const active = activeWeek === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseWeek(option)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-[#1e1e1e] bg-[#1e1e1e] text-white"
                    : "border-[#e5e5e7] bg-white text-[#555762] hover:bg-[#f8f8f9]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="border-t border-[#ededf0] pt-4">
          <form onSubmit={applyCustomRange} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MonthDayFilter
                label="From date"
                idPrefix="special-days-from"
                value={fromDate}
                onChange={changeFrom}
              />

              <MonthDayFilter
                label="To date"
                idPrefix="special-days-to"
                value={toDate}
                onChange={changeTo}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#858792]">
                Select the month and day only. The year is not used for
                matching.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#1e1e1e] px-5 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                {loading ? "Fetching..." : "Apply date range"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1e1e1e]">Special Days</h2>
          <p className="mt-1 text-sm text-[#777985]">
            {rangeLabel} · {total} occasions
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPdf}
            disabled={!loaded || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e2e2e6] bg-white px-3.5 py-2.5 text-sm font-semibold hover:bg-[#f8f8f9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText size={16} />
            Download PDF
          </button>

          <button
            type="button"
            onClick={exportExcel}
            disabled={!loaded || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e2e2e6] bg-white px-3.5 py-2.5 text-sm font-semibold hover:bg-[#f8f8f9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            Download Excel
          </button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-[#e8e8eb] bg-white px-5 py-14 text-center">
          <LoaderCircle
            size={25}
            className="mx-auto animate-spin text-[#777985]"
          />
          <p className="mt-3 text-sm text-[#777985]">
            Loading birthdays and wedding anniversaries…
          </p>
        </div>
      ) : loaded ? (
        <>
          <SpecialDaysTable type="birthday" rows={data.birthdays} />
          <SpecialDaysTable
            type="anniversary"
            rows={data.anniversaries}
          />
        </>
      ) : null}
    </div>
  );
}
