
import { supabase } from '../../lib/supabase'

const TABLE = 'church_events'
const VALID_TYPES = ['church', 'carol', 'special']

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function validateEvent(event) {
  if (!event?.title?.trim()) {
    throw new Error('Event name is required.')
  }

  if (!VALID_TYPES.includes(event.event_type)) {
    throw new Error('Select a valid event category.')
  }

  if (!event.event_date) {
    throw new Error('Event date is required.')
  }

  if (!event.start_time) {
    throw new Error('Event start time is required.')
  }

  if (
    event.end_time &&
    event.end_time <= event.start_time
  ) {
    throw new Error('End time must be later than start time.')
  }

  return {
    title: event.title.trim(),
    event_type: event.event_type,
    event_date: event.event_date,
    start_time: event.start_time,
    end_time: event.end_time || null,
    location: event.location?.trim() || null,
    description: event.description?.trim() || null,
  }
}

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) throw error

  if (!data.user) {
    throw new Error('Please sign in to manage church events.')
  }

  return data.user
}

/**
 * Return every event in chronological order.
 * All three Events tabs use this same data source.
 */
export async function getChurchEvents() {
  return unwrap(
    await supabase
      .from(TABLE)
      .select('*')
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true }),
  )
}

/**
 * Create a new church, carol, or special event.
 */
export async function createChurchEvent(event) {
  const user = await requireAuthenticatedUser()
  const payload = validateEvent(event)

  return unwrap(
    await supabase
      .from(TABLE)
      .insert({
        ...payload,
        created_by: user.id,
      })
      .select('*')
      .single(),
  )
}

/**
 * Update an existing event.
 * The date and time are updated in the same database record,
 * so the calendar automatically reflects the new schedule.
 */
export async function updateChurchEvent(id, event) {
  await requireAuthenticatedUser()

  if (!id) {
    throw new Error('Event ID is required.')
  }

  const payload = validateEvent(event)

  return unwrap(
    await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select('*')
      .single(),
  )
}

/**
 * Permanently delete an event.
 */
export async function deleteChurchEvent(id) {
  await requireAuthenticatedUser()

  if (!id) {
    throw new Error('Event ID is required.')
  }

  return unwrap(
    await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)
      .select('id')
      .single(),
  )
}
