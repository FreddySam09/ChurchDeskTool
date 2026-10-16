
import { supabase } from '../../lib/supabase'
import { unwrap } from './serviceUtils'

export async function getMembershipHistory({
  membershipRowId = null,
  memberId = null,
} = {}) {
  let query = supabase
    .from('membership_history_events')
    .select('*')
    .order('created_at', { ascending: false })

  if (membershipRowId) {
    query = query.eq('membership_id', membershipRowId)
  }

  if (memberId) {
    query = query.eq('member_id', memberId)
  }

  return unwrap(await query) ?? []
}
