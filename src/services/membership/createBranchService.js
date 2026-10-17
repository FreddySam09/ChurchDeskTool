
import { supabase } from '../../lib/supabase'
import { unwrap } from './serviceUtils'

/**
 * Creates a branch and assigns an existing member to it.
 * The Supabase RPC performs both database changes atomically.
 */
export async function createBranchFromMember({
  membershipRowId,
  memberId,
  suffix,
  branchName = null,
}) {
  if (!membershipRowId || !memberId) {
    throw new Error('A membership and existing member are required.')
  }

  const normalizedSuffix = String(suffix || '').trim().toUpperCase()

  if (!/^[A-Z]$/.test(normalizedSuffix)) {
    throw new Error('Branch suffix must be one uppercase letter from A to Z.')
  }

  return unwrap(
    await supabase.rpc('create_membership_branch_from_member', {
      p_membership_id: membershipRowId,
      p_member_id: memberId,
      p_suffix: normalizedSuffix,
      p_branch_name: branchName?.trim() || null,
    }),
  )
}
