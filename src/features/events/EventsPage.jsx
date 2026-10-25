
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'

import {
  createChurchEvent,
  deleteChurchEvent,
  getChurchEvents,
  updateChurchEvent,
} from '../../services/events/eventService'

const TABS = [
  {
    label: 'Church Calendar',
    path: '/events/church-calendar',
    type: null,
  },
  {
    label: 'Christmas Carols',
    path: '/events/christmas-carols',
    type: 'carol',
  },
  {
    label: 'Special Events',
    path: '/events/special-events',
    type: 'special',
  },
]

const EVENT_TYPES = [
  { value: 'church', label: 'Church Event' },
  { value: 'carol', label: 'Christmas Carol' },
  { value: 'special', label: 'Special Event' },
]

const EVENT_COLORS = {
  church: 'bg-[#eeeeef] text-[#17181b]',
  carol: 'bg-[#e8edff] text-[#3156df]',
  special: 'bg-[#e4f5e9] text-[#237345]',
}

const EMPTY_FORM = {
  title: '',
  event_type: 'special',
  event_date: '',
  start_time: '09:00',
  end_time: '',
  location: '',
  description: '',
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function dateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function todayKey() {
  const now = new Date()

  return dateKey(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )
}

function formatDate(value) {
  if (!value) return 'Date not set'

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function formatLongDate(value) {
  if (!value) return 'Date not set'

  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function formatMonth(value) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(value)
}

function formatTime(value) {
  if (!value) return 'Time not set'

  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  const date = new Date(2000, 0, 1, hours, minutes)

  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getEventStatus(event) {
  const now = new Date()
  const start = new Date(
    `${event.event_date}T${event.start_time || '00:00'}`
  )

  const end = event.end_time
    ? new Date(`${event.event_date}T${event.end_time}`)
    : start

  if (now < start) {
    return 'Upcoming'
  }

  if (event.end_time && now < end) {
    return 'Ongoing'
  }

  return 'Completed'
}

function getStatusClass(status) {
  if (status === 'Completed') {
    return 'bg-[#f0f0f1] text-[#666873]'
  }

  if (status === 'Ongoing') {
    return 'bg-[#e4f5e9] text-[#237345]'
  }

  return 'bg-[#e8edff] text-[#3156df]'
}

function getTypeLabel(type) {
  return EVENT_TYPES.find((item) => item.value === type)?.label
    || 'Church Event'
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const dateOrder = a.event_date.localeCompare(b.event_date)

    if (dateOrder !== 0) return dateOrder

    return (a.start_time || '').localeCompare(b.start_time || '')
  })
}

function EventModal({
  event,
  defaultType,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => {
    if (event) {
      return {
        title: event.title || '',
        event_type: event.event_type || defaultType,
        event_date: event.event_date || todayKey(),
        start_time: event.start_time?.slice(0, 5) || '09:00',
        end_time: event.end_time?.slice(0, 5) || '',
        location: event.location || '',
        description: event.description || '',
      }
    }

    return {
      ...EMPTY_FORM,
      event_type: defaultType,
      event_date: todayKey(),
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    const { name, value } = e.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.title.trim()) {
      setError('Enter an event name.')
      return
    }

    if (!form.event_date || !form.start_time) {
      setError('Select the event date and start time.')
      return
    }

    if (
      form.end_time &&
      form.end_time <= form.start_time
    ) {
      setError('End time must be later than start time.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        ...form,
        title: form.title.trim(),
      }

      const saved = event
        ? await updateChurchEvent(event.id, payload)
        : await createChurchEvent(payload)

      onSaved(saved)
    } catch (err) {
      setError(err.message || 'Unable to save the event.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        className="my-auto w-full max-w-lg rounded-2xl border border-[#e9e9ec] bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#92949c]">
              Event Management
            </p>

            <h2
              id="event-modal-title"
              className="mt-2 text-xl font-semibold text-[#131418]"
            >
              {event ? 'Modify Event' : 'Create Event'}
            </h2>

            <p className="mt-1 text-sm text-[#777b88]">
              Event details are shared with the Church Calendar.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close event form"
            className="rounded-lg p-2 text-[#777b88] hover:bg-[#f4f4f5]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="event-title"
              className="mb-1.5 block text-xs font-medium text-[#555966]"
            >
              Event name *
            </label>

            <input
              id="event-title"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              maxLength={150}
              placeholder="e.g. Church Anniversary"
              className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2.5 text-sm outline-none focus:border-[#687ee8]"
            />
          </div>

          <div>
            <label
              htmlFor="event-type"
              className="mb-1.5 block text-xs font-medium text-[#555966]"
            >
              Event category *
            </label>

            <select
              id="event-type"
              name="event_type"
              value={form.event_type}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#687ee8]"
            >
              {EVENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="event-date"
              className="mb-1.5 block text-xs font-medium text-[#555966]"
            >
              Event date *
            </label>

            <input
              id="event-date"
              type="date"
              name="event_date"
              value={form.event_date}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2.5 text-sm outline-none focus:border-[#687ee8]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="event-start-time"
                className="mb-1.5 block text-xs font-medium text-[#555966]"
              >
                Start time *
              </label>

              <input
                id="event-start-time"
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2.5 text-sm outline-none focus:border-[#687ee8]"
              />
            </div>

            <div>
              <label
                htmlFor="event-end-time"
                className="mb-1.5 block text-xs font-medium text-[#555966]"
              >
                End time
              </label>

              <input
                id="event-end-time"
                type="time"
                name="end_time"
                value={form.end_time}
                min={form.start_time}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2.5 text-sm outline-none focus:border-[#687ee8]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="event-location"
              className="mb-1.5 block text-xs font-medium text-[#555966]"
            >
              Location
            </label>

            <input
              id="event-location"
              name="location"
              value={form.location}
              onChange={handleChange}
              maxLength={200}
              placeholder="e.g. Main Church Hall"
              className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2.5 text-sm outline-none focus:border-[#687ee8]"
            />
          </div>

          <div>
            <label
              htmlFor="event-description"
              className="mb-1.5 block text-xs font-medium text-[#555966]"
            >
              Description
            </label>

            <textarea
              id="event-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              maxLength={5000}
              placeholder="Additional event details..."
              className="w-full resize-y rounded-lg border border-[#e4e4e7] px-3 py-2.5 text-sm outline-none focus:border-[#687ee8]"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-[#fff0ee] px-3 py-2.5 text-xs text-[#b9382b]"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-[#eeeeef] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[#e4e4e7] px-4 py-2.5 text-sm font-medium text-[#555966] hover:bg-[#f7f7f8]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#202126] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#35363d] disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}

              {saving
                ? 'Saving...'
                : event
                  ? 'Save changes'
                  : 'Create event'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function EventDetailsModal({ event, onClose, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${event.title}"? This cannot be undone.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setError('')

    try {
      await onDelete(event)
    } catch (err) {
      setError(err.message || 'Unable to delete this event.')
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
        className="w-full max-w-md rounded-2xl border border-[#e9e9ec] bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <span
              className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium ${EVENT_COLORS[event.event_type]}`}
            >
              {getTypeLabel(event.event_type)}
            </span>

            <h2
              id="event-detail-title"
              className="mt-3 text-xl font-semibold text-[#131418]"
            >
              {event.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close event details"
            className="rounded-lg p-2 text-[#777b88] hover:bg-[#f4f4f5]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays size={17} className="mt-0.5 text-[#92949c]" />
            <div>
              <p className="text-xs text-[#92949c]">Date</p>
              <p className="mt-1 font-medium text-[#292a30]">
                {formatLongDate(event.event_date)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock3 size={17} className="mt-0.5 text-[#92949c]" />
            <div>
              <p className="text-xs text-[#92949c]">Time</p>
              <p className="mt-1 font-medium text-[#292a30]">
                {formatTime(event.start_time)}
                {event.end_time
                  ? ` – ${formatTime(event.end_time)}`
                  : ''}
              </p>
            </div>
          </div>

          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin size={17} className="mt-0.5 text-[#92949c]" />
              <div>
                <p className="text-xs text-[#92949c]">Location</p>
                <p className="mt-1 font-medium text-[#292a30]">
                  {event.location}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-[#92949c]">Description</p>
            <p className="mt-1 whitespace-pre-wrap leading-6 text-[#60626d]">
              {event.description || 'No description provided.'}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs text-[#b9382b]">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#eeeeef] pt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#bd3e32] hover:bg-[#fff0ee] disabled:opacity-60"
          >
            <Trash2 size={14} />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(event)}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#202126] px-3 py-2 text-sm font-medium text-white hover:bg-[#35363d]"
            >
              <Pencil size={14} />
              Modify
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="rounded-lg border border-[#e4e4e7] px-3 py-2 text-sm font-medium text-[#555966] hover:bg-[#f7f7f8]"
            >
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function CalendarEvent({ event, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      title={`${formatTime(event.start_time)} — ${event.title}`}
      className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] font-medium leading-4 hover:brightness-95 sm:text-[11px] ${EVENT_COLORS[event.event_type]}`}
    >
      <span className="mr-1 opacity-70">
        {formatTime(event.start_time)}
      </span>
      {event.title}
    </button>
  )
}

function ChurchCalendar({ events, loading, month, setMonth, onSelect }) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const cells = []

  for (let i = 0; i < firstDay; i += 1) {
    cells.push({ key: `empty-${i}`, day: null })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: dateKey(year, monthIndex, day),
      day,
      date: dateKey(year, monthIndex, day),
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `end-${cells.length}`, day: null })
  }

  const eventsByDate = {}

  for (const event of events) {
    if (!eventsByDate[event.event_date]) {
      eventsByDate[event.event_date] = []
    }

    eventsByDate[event.event_date].push(event)
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#e9e9ec] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[#eeeeef] px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-[#131418]">
            {formatMonth(month)}
          </h2>
          <p className="mt-1 text-xs text-[#92949c]">
            All church events, ordered by date and time
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              setMonth((current) =>
                new Date(
                  current.getFullYear(),
                  current.getMonth() - 1,
                  1,
                ),
              )
            }
            aria-label="Previous month"
            className="rounded-lg border border-[#e5e5e8] p-2 hover:bg-[#f7f7f8]"
          >
            <ChevronLeft size={17} />
          </button>

          <button
            type="button"
            onClick={() =>
              setMonth((current) =>
                new Date(
                  current.getFullYear(),
                  current.getMonth() + 1,
                  1,
                ),
              )
            }
            aria-label="Next month"
            className="rounded-lg border border-[#e5e5e8] p-2 hover:bg-[#f7f7f8]"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[#777b88]">
          <RefreshCw size={16} className="animate-spin" />
          Loading calendar...
        </div>
      ) : (
        <div className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
              (day) => (
                <div
                  key={day}
                  className="py-2 text-center text-[10px] font-medium text-[#92949c] sm:text-xs"
                >
                  {day}
                </div>
              ),
            )}

            {cells.map((cell) => {
              const dayEvents = cell.date
                ? eventsByDate[cell.date] || []
                : []

              return (
                <div
                  key={cell.key}
                  className={`min-h-[78px] min-w-0 rounded-lg border p-1 sm:min-h-[112px] sm:rounded-xl sm:p-2 ${
                    cell.day === null
                      ? 'border-transparent bg-[#fafafa]'
                      : 'border-[#eeeeef] bg-white'
                  }`}
                >
                  {cell.day !== null && (
                    <>
                      <p className="mb-1 text-[10px] text-[#555966] sm:mb-2 sm:text-xs">
                        {cell.day}
                      </p>

                      <div className="space-y-1">
                        {dayEvents.map((event) => (
                          <CalendarEvent
                            key={event.id}
                            event={event}
                            onClick={onSelect}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[#eeeeef] px-4 py-3 text-[11px] text-[#777b88] sm:px-6">
        {EVENT_TYPES.map((type) => (
          <span key={type.value} className="inline-flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-sm ${EVENT_COLORS[type.value].split(' ')[0]}`}
            />
            {type.label}
          </span>
        ))}
      </div>
    </section>
  )
}

function SpecialEventsTable({ events, onSelect }) {
  if (!events.length) {
    return (
      <div className="rounded-2xl border border-[#e9e9ec] bg-white px-5 py-14 text-center">
        <CalendarDays size={28} className="mx-auto mb-3 text-[#b0b2ba]" />
        <h3 className="text-sm font-semibold text-[#292a30]">
          No special events yet
        </h3>
        <p className="mt-1 text-xs text-[#858894]">
          Create a special event to add it to the list and calendar.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#e9e9ec] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] border-collapse text-left">
          <thead>
            <tr className="bg-[#f8f8f9] text-[13px] font-medium text-[#555966]">
              <th className="border-b border-[#e9e9ec] px-5 py-4">
                Event
              </th>
              <th className="border-b border-[#e9e9ec] px-5 py-4">
                Status
              </th>
              <th className="border-b border-[#e9e9ec] px-5 py-4 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {events.map((event) => {
              const status = getEventStatus(event)

              return (
                <tr
                  key={event.id}
                  className="border-b border-[#eeeeef] last:border-b-0 hover:bg-[#fcfcfd]"
                >
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onSelect(event)}
                      className="text-left text-sm font-medium text-[#202126] hover:underline"
                    >
                      {event.title}
                    </button>

                    <p className="mt-1 text-xs text-[#858894]">
                      {formatDate(event.event_date)}
                      {' · '}
                      {formatTime(event.start_time)}
                      {event.end_time
                        ? ` – ${formatTime(event.end_time)}`
                        : ''}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[#292a30]">
                        {formatDate(event.event_date)}
                        {' — '}
                        {status}
                      </span>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-medium ${getStatusClass(status)}`}
                      >
                        {status}
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect(event, true)}
                        aria-label={`Modify ${event.title}`}
                        title="Modify event"
                        className="rounded-lg p-2 text-[#555966] hover:bg-[#eeeeef]"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelect(event, 'delete')}
                        aria-label={`Delete ${event.title}`}
                        title="Delete event"
                        className="rounded-lg p-2 text-[#bd3e32] hover:bg-[#fff0ee]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function EventsPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const activeTab =
    TABS.find((tab) => tab.path === location.pathname) || TABS[0]

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [modalEvent, setModalEvent] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [detailsEvent, setDetailsEvent] = useState(null)
  const [formType, setFormType] = useState('special')

  const loadEvents = useCallback(async (refresh = false) => {
    setError('')

    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const data = await getChurchEvents()
      setEvents(sortEvents(data || []))
    } catch (err) {
      setError(err.message || 'Unable to load events.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const visibleEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          !activeTab.type || event.event_type === activeTab.type,
      ),
    [events, activeTab.type],
  )

  function openCreateForm() {
    setDetailsEvent(null)
    setModalEvent(null)
    setFormType(activeTab.type || 'church')
    setShowForm(true)
  }

  function openModifyForm(event) {
    setDetailsEvent(null)
    setModalEvent(event)
    setFormType(event.event_type)
    setShowForm(true)
  }

  function handleSaved(savedEvent) {
    setEvents((current) => {
      const exists = current.some((event) => event.id === savedEvent.id)

      return sortEvents(
        exists
          ? current.map((event) =>
              event.id === savedEvent.id ? savedEvent : event,
            )
          : [...current, savedEvent],
      )
    })

    setShowForm(false)
    setModalEvent(null)
    setDetailsEvent(null)

    const [year, monthNumber] = savedEvent.event_date
      .split('-')
      .map(Number)

    setMonth(new Date(year, monthNumber - 1, 1))
  }

  async function handleDelete(event) {
    await deleteChurchEvent(event.id)

    setEvents((current) =>
      current.filter((item) => item.id !== event.id),
    )

    setDetailsEvent(null)
  }

  function handleSelect(event, action = false) {
    if (action === 'delete') {
      setDetailsEvent(event)
      return
    }

    if (action === true) {
      openModifyForm(event)
      return
    }

    setDetailsEvent(event)
  }

  return (
    <div className="min-w-0">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.8px] text-[#131418]">
            Events
          </h1>

          <p className="mt-2 text-sm text-[#777b88] sm:text-[15px]">
            Manage church events and their schedules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadEvents(true)}
            disabled={refreshing || loading}
            className="inline-flex h-[41px] items-center gap-2 rounded-[11px] border border-[#e5e5e8] bg-white px-3 text-sm font-medium text-[#555966] hover:bg-[#f7f7f8] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={refreshing ? 'animate-spin' : ''}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex h-[41px] items-center gap-2 rounded-[11px] bg-[#202126] px-3.5 text-sm font-medium text-white hover:bg-[#35363d] sm:px-4"
          >
            <Plus size={16} />
            Create Event
          </button>
        </div>
      </div>

      <div className="mb-7 border-b border-[#e8e8ea]">
        <nav
          aria-label="Event workspaces"
          className="flex gap-1 overflow-x-auto overflow-y-hidden sm:gap-2"
        >
          {TABS.map((tab) => {
            const selected = tab.path === activeTab.path

            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                aria-current={selected ? 'page' : undefined}
                className={`-mb-px shrink-0 border-b-2 px-4 py-[13px] text-[13px] transition sm:px-[19px] sm:text-sm ${
                  selected
                    ? 'border-[#202126] font-medium text-[#15161a]'
                    : 'border-transparent text-[#858894] hover:text-[#292a30]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f1c9c4] bg-[#fff4f2] p-4 text-sm text-[#a6382e]"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadEvents(true)}
            className="font-medium underline"
          >
            Try again
          </button>
        </div>
      )}

      {activeTab.path === '/events/church-calendar' ? (
        <ChurchCalendar
          events={events}
          loading={loading}
          month={month}
          setMonth={setMonth}
          onSelect={handleSelect}
        />
      ) : activeTab.path === '/events/special-events' ? (
        loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[#777b88]">
            <RefreshCw size={16} className="animate-spin" />
            Loading special events...
          </div>
        ) : (
          <SpecialEventsTable
            events={visibleEvents}
            onSelect={handleSelect}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-[#e9e9ec] bg-white">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[#777b88]">
              <RefreshCw size={16} className="animate-spin" />
              Loading Christmas carols...
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <CalendarDays
                size={28}
                className="mx-auto mb-3 text-[#b0b2ba]"
              />
              <p className="text-sm font-semibold text-[#292a30]">
                No Christmas carol events yet
              </p>
              <p className="mt-1 text-xs text-[#858894]">
                Create a carol event to add it to the calendar.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eeeeef]">
              {visibleEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(event)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-[#202126]">
                      {event.title}
                    </p>
                    <p className="mt-1 text-xs text-[#858894]">
                      {formatDate(event.event_date)}
                      {' · '}
                      {formatTime(event.start_time)}
                    </p>
                  </button>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${getStatusClass(getEventStatus(event))}`}
                    >
                      {getEventStatus(event)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleSelect(event, true)}
                      aria-label={`Modify ${event.title}`}
                      className="rounded-lg p-2 text-[#555966] hover:bg-[#eeeeef]"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelect(event, 'delete')}
                      aria-label={`Delete ${event.title}`}
                      className="rounded-lg p-2 text-[#bd3e32] hover:bg-[#fff0ee]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#92949c]">
        <span>
          {activeTab.label} · {visibleEvents.length} events
        </span>
        <span>All dates and times are shown in your local timezone.</span>
      </div>

      {showForm && (
        <EventModal
          key={modalEvent?.id || `new-${formType}`}
          event={modalEvent}
          defaultType={formType}
          onClose={() => {
            setShowForm(false)
            setModalEvent(null)
          }}
          onSaved={handleSaved}
        />
      )}

      {detailsEvent && (
        <EventDetailsModal
          event={detailsEvent}
          onClose={() => setDetailsEvent(null)}
          onEdit={openModifyForm}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
