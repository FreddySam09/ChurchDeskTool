
import { useNavigate } from "react-router-dom";
import { GitBranch, Users, ChevronRight } from "lucide-react";

function PersonRow({ member, isHead = false }) {
  if (!member) return null;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#ececed] bg-white px-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eeeeef] text-[12px] font-bold text-[#53555e]">
        {(member.name || "?").trim().charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words text-[12px] font-semibold text-[#25262c]">
            {member.name || "Unnamed person"}
          </p>

          {isHead && (
            <span className="rounded-full bg-[#e9edfd] px-2 py-0.5 text-[9px] font-semibold text-[#3457d5]">
              Membership head
            </span>
          )}
        </div>

        <p className="mt-0.5 font-mono text-[10px] text-[#92939b]">
          {member.person_id || "Person ID not assigned"}
        </p>
      </div>
    </div>
  );
}

export default function MembershipStructure({
  membership,
  membershipRowId,
  head,
  mainMembers = [],
  branches = [],
}) {
  const navigate = useNavigate();

  const mainPeople = [...mainMembers]
    .filter((member) => member.id !== head?.id)
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );

  const activeBranches = branches.filter(
    (branch) => branch.branch_status === "Active",
  );

  function openBranch(branch) {
    if (!branch?.id || !membershipRowId) return;

    navigate(
      `/memberships/${membershipRowId}?branchId=${branch.id}`,
      {
        state: {
          from: "membership-details",
          parentPath: `/memberships/${membershipRowId}`,
        },
      },
    );
  }

  return (
    <section className="mt-5 overflow-hidden rounded-[18px] border border-[#ececed] bg-white shadow-[0_1px_2px_rgba(15,15,20,0.03)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f1] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f1f2f5] text-[#53555e]">
            <GitBranch size={17} />
          </span>

          <div>
            <h2 className="text-[14px] font-bold text-[#131418]">
              Membership structure
            </h2>

            <p className="mt-1 text-[11.5px] text-[#92939b]">
              Main membership and its current branch assignments.
            </p>
          </div>
        </div>

        <span className="rounded-full bg-[#f3f3f4] px-3 py-1.5 text-[10.5px] font-semibold text-[#53555e]">
          {1 + activeBranches.length} structural record
          {activeBranches.length === 0 ? "" : "s"}
        </span>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-xl border border-[#dfe5fa] bg-[#f8f9ff] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#777984]">
                Main membership
              </p>

              <p className="mt-1 text-[17px] font-extrabold text-[#191a1f]">
                {membership?.membership_number || "Number not assigned"}
              </p>
            </div>

            <span className="rounded-full bg-[#e9edfd] px-2.5 py-1 text-[10px] font-semibold text-[#3457d5]">
              Main household
            </span>
          </div>

          {head ? (
            <PersonRow member={head} isHead />
          ) : (
            <p className="rounded-lg border border-dashed border-[#d9dce6] bg-white p-3 text-[12px] text-[#92939b]">
              No membership head is assigned.
            </p>
          )}

          {mainPeople.length > 0 && (
            <div className="mt-2 space-y-2">
              {mainPeople.map((member) => (
                <PersonRow key={member.id} member={member} />
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 text-[10.5px] text-[#777984]">
            <Users size={13} />
            {mainMembers.length || (head ? 1 : 0)} person
            {(mainMembers.length || (head ? 1 : 0)) === 1 ? "" : "s"}
            currently assigned to the main membership
          </div>
        </div>

        {activeBranches.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#777984]">
                Branch assignments
              </h3>

              <span className="text-[10.5px] text-[#92939b]">
                {activeBranches.length} active
              </span>
            </div>

            {activeBranches.map((branch) => {
              const branchPerson =
                branch.member ||
                branch.person ||
                branch.members?.[0] ||
                null;

              const displayNumber =
                branch.display_number ||
                `${membership?.membership_number || ""}${branch.suffix || ""}`;

              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => openBranch(branch)}
                  className="group flex w-full min-w-0 items-center gap-3 rounded-xl border border-[#ececed] bg-white p-3 text-left transition hover:border-[#d9dce6] hover:bg-[#fafafd] focus:outline-none focus:ring-2 focus:ring-[#3457d5]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f2f5] text-[12px] font-bold text-[#53555e]">
                    {branch.suffix || "—"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12px] font-bold text-[#25262c]">
                        {branch.branch_name ||
                          `Branch ${branch.suffix || ""}`}
                      </p>

                      <span className="rounded-full bg-[#f3f3f4] px-2 py-0.5 font-mono text-[10px] text-[#777984]">
                        {displayNumber}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-[11px] text-[#777984]">
                      {branchPerson?.name || "Person not assigned"}
                      {branchPerson?.person_id
                        ? ` · ${branchPerson.person_id}`
                        : ""}
                    </p>

                    <p className="mt-1 text-[10px] text-[#92939b]">
                      {branch.member_count ?? (branchPerson ? 1 : 0)} person
                      {(branch.member_count ?? (branchPerson ? 1 : 0)) === 1
                        ? ""
                        : "s"}{" "}
                      assigned
                    </p>
                  </div>

                  <ChevronRight
                    size={16}
                    className="shrink-0 text-[#92939b] transition group-hover:translate-x-0.5"
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#e5e5e7] px-4 py-5 text-center">
            <GitBranch
              size={19}
              className="mx-auto mb-2 text-[#b0b1b8]"
            />

            <p className="text-[12px] font-semibold text-[#53555e]">
              No active branches
            </p>

            <p className="mt-1 text-[11px] text-[#92939b]">
              People assigned to this membership's branches will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
