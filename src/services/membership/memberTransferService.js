
import { supabase } from "../../lib/supabase";

export async function transferMembershipMember({
  memberId,
  sourceMembershipId,
  destinationMembershipId,
  effectiveDate,
  relationshipToHead,
  reason,
}) {
  if (!memberId) {
    throw new Error("A member must be selected.");
  }

  if (!sourceMembershipId || !destinationMembershipId) {
    throw new Error("Source and destination memberships are required.");
  }

  if (sourceMembershipId === destinationMembershipId) {
    throw new Error("Choose a different destination membership.");
  }

  if (!effectiveDate) {
    throw new Error("Choose the effective date.");
  }

  if (!relationshipToHead?.trim()) {
    throw new Error(
      "Enter the member's relationship to the destination head.",
    );
  }

  if (!reason?.trim()) {
    throw new Error("Enter a reason for the transfer.");
  }

  const { data, error } = await supabase.rpc(
    "transfer_membership_member",
    {
      p_member_id: memberId,
      p_source_membership_id: sourceMembershipId,
      p_destination_membership_id: destinationMembershipId,
      p_effective_date: effectiveDate,
      p_relationship_to_head: relationshipToHead.trim(),
      p_reason: reason.trim(),
    },
  );

  if (error) {
    throw new Error(error.message || "The member transfer failed.");
  }

  if (!data?.success) {
    throw new Error("The database did not confirm the transfer.");
  }

  return data;
}
