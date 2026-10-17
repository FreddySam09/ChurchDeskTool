import { supabase } from '../../lib/supabase'

export async function createBranchFromExistingMember({
  membershipRowId,
  memberId,
}) {
  if (!membershipRowId) {
    throw new Error('A membership record ID is required.')
  }

  if (!memberId) {
    throw new Error('Select a member to create the branch from.')
  }

  const { data, error } = await supabase.rpc(
    'create_branch_from_existing_member',
    {
      p_membership_row_id: membershipRowId,
      p_member_id: memberId,
    },
  )

  if (error) {
    throw new Error(error.message || 'Unable to create the branch.')
  }

  return data
}