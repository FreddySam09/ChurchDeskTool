
import { supabase } from '../../lib/supabase'

const TABLE = 'carol_days'
const VALID_STATUSES = ['Scheduled', 'Completed', 'Cancelled']

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function validateCarolDay(values) {
  const name = values.name?.trim()

  if (!name) throw new Error('Enter a name for this Carol Day.')
  if (!values.visit_date) throw new Error('Select a visit date.')
  if (!values.start_time) throw new Error('Select a start time.')

  if (
    values.end_time &&
    values.end_time <= values.start_time
  ) {
    throw new Error('End time must be later than start time.')
  }

  if (!VALID_STATUSES.includes(values.status)) {
    throw new Error('Select a valid Carol Day status.')
  }

  return {
    name,
    visit_date: values.visit_date,
    start_time: values.start_time,
    end_time: values.end_time || null,
    notes: values.notes?.trim() || null,
    status: values.status,
  }
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) throw error
  if (!data.user) throw new Error('Please sign in to manage Carol Days.')

  return data.user
}

export async function getCarolDays() {
  await requireUser()

  return unwrap(
    await supabase
      .from(TABLE)
      .select('*')
      .order('visit_date', { ascending: true })
      .order('start_time', { ascending: true })
      .order('created_at', { ascending: true }),
  )
}

export async function createCarolDay(values) {
  const user = await requireUser()
  const payload = validateCarolDay(values)

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

export async function updateCarolDay(id, values) {
  await requireUser()

  if (!id) throw new Error('Carol Day ID is missing.')

  return unwrap(
    await supabase
      .from(TABLE)
      .update(validateCarolDay(values))
      .eq('id', id)
      .select('*')
      .single(),
  )
}

export async function deleteCarolDay(id) {
  await requireUser()

  if (!id) throw new Error('Carol Day ID is missing.')

  // Prevent accidental loss of visits and offerings.
  const { count, error: countError } = await supabase
    .from('carol_day_visits')
    .select('id', { count: 'exact', head: true })
    .eq('carol_day_id', id)

  if (countError) throw countError

  if (count > 0) {
    throw new Error(
      'This Carol Day has assigned families. Reassign them before deleting the day.',
    )
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
