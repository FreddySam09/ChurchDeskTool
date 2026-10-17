
import { supabase } from "../../lib/supabase";

export async function convertBranchToIndependent({
  branchId,
  reason = null,
}) {
  if (!branchId) {
    throw new Error("A branch ID is required.");
  }

  const { data, error } = await supabase.rpc(
    "convert_branch_to_independent_membership",
    {
      p_branch_id: branchId,
      p_reason: reason?.trim() || null,
    },
  );

  if (error) {
    throw new Error(
      error.message || "Unable to convert this branch into a membership.",
    );
  }

  if (!data?.success || !data?.membership_row_id) {
    throw new Error("The conversion did not return a new membership.");
  }

  return data;
}
