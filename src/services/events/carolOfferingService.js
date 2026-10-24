
import { supabase } from '../../lib/supabase'

const TABLE = 'carol_offering_records'

const VERIFICATION_STATUSES = ['Unverified', 'Verified', 'Posted']

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) throw error
  if (!data.user) {
    throw new Error('Please sign in to manage Carol offerings.')
  }

  return data.user
}

function validateAmount(value) {
  if (value === '' || value === null || value === undefined) {
    throw new Error('Enter the offering amount. Enter 0 if no offering was received.')
  }

  const amount = Number(value)

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Offering amount must be a valid non-negative number.')
  }

  return Math.round(amount * 100) / 100
}

export async function getCarolOfferingsForVisits(visitIds) {
  await requireUser()

  const ids = [...new Set((visitIds || []).filter(Boolean))]
  if (!ids.length) return []

  const data = unwrap(
    await supabase
      .from(TABLE)
      .select(`
        id,
        visit_id,
        amount,
        verification_status,
        verified_by,
        verified_at,
        posted_by,
        posted_at,
        financial_reference,
        notes,
        created_at
      `)
      .in('visit_id', ids),
  )

  return data ?? []
}


export async function saveCarolOffering(visitId, values) {
  await requireUser()

  if (!visitId) throw new Error('Visit ID is missing.')

  const amount = validateAmount(values.amount)

  const existing = unwrap(
    await supabase
      .from(TABLE)
      .select('id, verification_status')
      .eq('visit_id', visitId)
      .maybeSingle(),
  )

  if (existing && existing.verification_status !== 'Unverified') {
    throw new Error(
      'Only unverified offerings can be edited. Verified or posted records are locked.',
    )
  }

  if (existing) {
    return unwrap(
      await supabase
        .from(TABLE)
        .update({ amount })
        .eq('id', existing.id)
        .eq('verification_status', 'Unverified')
        .select('*')
        .single(),
    )
  }

  return unwrap(
    await supabase
      .from(TABLE)
      .insert({
        visit_id: visitId,
        amount,
        verification_status: 'Unverified',
      })
      .select('*')
      .single(),
  )
}


export async function verifyCarolOffering(offeringId) {
  const user = await requireUser()

  if (!offeringId) throw new Error('Offering record ID is missing.')

  return unwrap(
    await supabase
      .from(TABLE)
      .update({
        verification_status: 'Verified',
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq('id', offeringId)
      .eq('verification_status', 'Unverified')
      .select('*')
      .single(),
  )
}

export async function postCarolOffering(offeringId) {
  const user = await requireUser()

  if (!offeringId) throw new Error('Offering record ID is missing.')

  return unwrap(
    await supabase
      .from(TABLE)
      .update({
        verification_status: 'Posted',
        posted_by: user.id,
        posted_at: new Date().toISOString(),
      })
      .eq('id', offeringId)
      .eq('verification_status', 'Verified')
      .not('verified_at', 'is', null)
      .select('*')
      .single(),
  )
}

/**
 * This returns a verified or posted record to Unverified only if
 * your database permits it. By default, this service deliberately
 * does not provide an unverify or reopen operation.
 */
export function getOfferingStatusLabel(status) {
  if (VERIFICATION_STATUSES.includes(status)) return status
  return 'Unknown status'
}
