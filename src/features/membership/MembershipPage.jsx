
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  CirclePlus,
  GitBranch,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { getMembershipDirectory } from "../../services/membershipService";
import { useAuth } from "../auth/AuthContext";
import AddMembershipModal from "./AddMembershipModal";
import MembershipImportModal from "./import/MembershipImportModal";
import { getMembershipHeadPhotoUrl } from "../../services/membership/membershipPhotoService";

const FILTERS = ["All", "Active", "Inactive"];

const membershipNumberCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function StatusBadge({ status }) {
  const active = status === "Active";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[11px] font-semibold ${
        active ? "bg-[#e5f6ec] text-[#159568]" : "bg-[#eeeeef] text-[#53555e]"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  primary = false,
  disabled = false,
  title,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[15px] border px-4 py-2.5 text-[13px] font-semibold transition sm:px-5 ${
        primary
          ? "border-[#191a1f] bg-[#191a1f] text-white hover:bg-black"
          : "border-[#e9e9eb] bg-white text-[#131418] hover:bg-[#f8f8f9]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function getDisplayNumber(membership) {
  const number =
    membership.display_number ??
    membership.membership_number ??
    membership.annual_number ??
    null;

  if (number === null || number === "") return "—";

  return String(number);
}

function MembershipCard({ membership, onOpen }) {
  const displayNumber = getDisplayNumber(membership);
  const isBranch = membership.is_branch === true;

  const area = [membership.area, membership.city].filter(Boolean).join(", ");

  const imageUrl =
    getMembershipHeadPhotoUrl(membership.head_photo_path) ||
    membership.head_photo_url ||
    membership.photo_url ||
    membership.head_photo;

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open membership ${displayNumber}`}
      onClick={() => onOpen(membership)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(membership);
        }
      }}
      className="group relative isolate h-[290px] cursor-pointer
        overflow-hidden rounded-[24px]
        border border-white/60 bg-[#252525]
        shadow-[0_4px_15px_rgba(15,15,20,0.08)]
        transition-all duration-500 ease-out
        hover:-translate-y-1
        hover:border-white/80
        hover:shadow-[0_18px_40px_rgba(15,15,20,0.20)]
        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-[#536bd6]
        focus-visible:ring-offset-2"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={membership.card_head_name ||
              membership.head_name ||
              membership.head?.name ||
              "Head not assigned"}
          className="
            absolute inset-0 h-full w-full
            object-cover object-center
            transition-transform duration-700 ease-out
            group-hover:scale-110
          "
        />
      ) : (
        <div className="
          absolute inset-0 flex items-center justify-center
          bg-gradient-to-br from-[#777984] via-[#41434c] to-[#17181d]
        ">
          <img
          src="https://csyylshgxedhvojaikph.supabase.co/storage/v1/object/sign/ChurchDeskBucket/membership-photos/WhatsApp%20Image%202026-11-18%20at%2018.54.41.jpeg?token=eyJraWQiOiI2YjYzNzg2Mi02MzQwLTQzODktOTFmMy0zNDllZWRjNjU4OTYiLCJhbGciOiJIUzUxMiJ9.eyJ1cmwiOiJDaHVyY2hEZXNrQnVja2V0L21lbWJlcnNoaXAtcGhvdG9zL1doYXRzQXBwIEltYWdlIDIwMjYtMTEtMTggYXQgMTguNTQuNDEuanBlZyIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3OTUwMjc4ODEsImV4cCI6MzE1NTM2MzQ5MTg4MX0.uHJAMw9R-W9xS-aitvBoZmIXSnJhESGBH1HvmBW0ySt6o2GWdmrzS06apQ3PSoChTkJrRKbu3U3moCQdT28dXw"
          alt={membership.card_head_name ||
              membership.head_name ||
              membership.head?.name ||
              "Head not assigned"}
          className="
            absolute inset-0 h-full w-full
            object-cover object-center
            transition-transform duration-700 ease-out
            group-hover:scale-110
          "
        />
        </div>
      )}
      <div className={`absolute inset-0 bg-gradient-to-b 
      ${imageUrl ? 'from-transparent via-transparent to-white/40 hover:to-white/40' : 'from-black/20 via-transparent to-black/80'}`}
       />

      {/* Glossy overlay */}
      <div className="
        pointer-events-none absolute inset-0 z-10
        bg-gradient-to-br from-white/20 via-transparent to-transparent
        opacity-40 transition-opacity duration-500
        group-hover:opacity-80
      " />

      {/* Shine sweep */}
      <div className="
        pointer-events-none absolute -inset-y-full -left-1/2 z-20
        w-1/2 rotate-[25deg]
        bg-gradient-to-r from-transparent via-white/20 to-transparent
        transition-transform duration-1000 ease-in-out
        group-hover:translate-x-[350%]
      " />
      <div className="absolute right-4 top-4 z-30">
        <span className="
          inline-flex h-10 min-w-8 items-center justify-center
          rounded-sm border border-white/30
          bg-white/20 px-3
          text-[20px] font-bold tracking-wide text-black
          shadow-sm backdrop-blur-xl
        ">
          {displayNumber}
        </span>
      </div>
      <div className="
        absolute inset-x-0 bottom-0 z-30
        p-5 sm:p-6
      ">
        {/* Always visible name */}
        <div className="
          transition-all duration-500 ease-out
          group-hover:-translate-y-2
        ">
          {isBranch && (
            <div className="
              mb-2 inline-flex items-center gap-1.5
              rounded-full border border-white/20
              bg-white/15 px-2.5 py-1
              text-[10px] font-semibold text-white
              backdrop-blur-md
            ">
              <GitBranch size={12} />
              Branch of {membership.membership_number || "—"}
            </div>
          )}

          <h2 className={`
            line-clamp-2 max-w-[90%]
            text-[22px] font-bold leading-tight
            tracking-[-0.5px] ${imageUrl ? 'text-black' : 'text-white'}
            drop-shadow-lg sm:text-[25px]
          `}>
            {membership.card_head_name ||
              membership.head_name ||
              membership.head?.name ||
              "Head not assigned"}
          </h2>

          <p className="
            mt-1 text-[12px] font-medium text-white/75
          ">
            {area || "Location not recorded"}
          </p>
          {displayNumber === "—" && (
            <p className="mt-1 text-[11px] text-[#92939b]">
              Awaiting membership number
            </p>
          )}
        </div>

        {/* Details revealed on hover */}
        <div className="
          grid grid-rows-[0fr]
          opacity-0 blur-[3px]
          transition-all duration-500 ease-out
          group-hover:mt-4
          group-hover:grid-rows-[1fr]
          group-hover:opacity-100
          group-hover:blur-0
          motion-reduce:transition-none
        ">
          <div className="overflow-hidden">
            <div className="
              border-t border-white/25 pt-3
            ">
              <div className="
                flex flex-wrap items-center
                justify-between gap-3
              ">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[12px] font-medium text-white/90">
                    {membership.member_count ?? 0}{" "}
                    {(membership.member_count ?? 0) === 1
                      ? "Member"
                      : "Members"}
                  </span>

                  {!isBranch && membership.branch_count > 0 && (
                    <span className="text-[12px] text-white/90">
                      {membership.branch_count}{" "}
                      {membership.branch_count === 1
                        ? "Branch"
                        : "Branches"}
                    </span>
                  )}
                </div>

                <span className="
                  rounded-full border border-white/30
                  bg-white/15 px-2.5 py-1
                  text-[10px] font-semibold text-white
                  backdrop-blur-lg
                ">
                  {membership.membership_status || "Unknown"}
                </span>
              </div>

              <div className="
                mt-4 flex items-center justify-between
                text-[12px] font-semibold text-white
              ">
                <span>Membership Profile</span>

                <span className="
                  inline-flex items-center gap-1
                  transition-transform duration-300
                  group-hover:translate-x-1
                ">
                  View Profile
                  <ChevronRight size={16} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div 
        className="
          pointer-events-none absolute inset-0 z-20
          rounded-[24px] border border-white/10
          transition-all duration-500
          group-hover:border-white/40
          group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
      />
    </article>
  );
}

export default function MembershipPage() {
  const navigate = useNavigate();
  const { searchValue, setSearchValue } = useOutletContext();

  const { role, permissions } = useAuth();

  const isFellowshipLeader = role === "Fellowship Leader";
  const canManageMemberships =
    !isFellowshipLeader && permissions.canWrite("membership");
  const canExportMemberships =
    !isFellowshipLeader && permissions.canDownload("membership");

  const [directory, setDirectory] = useState([]);
  const [activeRegister, setActiveRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getMembershipDirectory();

      if (Array.isArray(result)) {
        setDirectory(result);
        setActiveRegister(null);
      } else {
        setDirectory(result?.memberships ?? []);
        setActiveRegister(result?.activeRegister ?? null);
      }
    } catch (err) {
      setError(err.message || "Unable to load memberships.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  // Branches are displayed as cards but remain linked to their parent record.
  const displayCards = useMemo(() => {
    return directory.flatMap((membership) => {
      const mainCard = {
        ...membership,
        is_branch: false,
        display_number: membership.membership_number,
        card_head_name: membership.head_name,
        member_count:
          membership.main_member_count ?? membership.member_count ?? 0,
      };

      const branchCards = (membership.branches ?? []).map((branch) => ({
        ...membership,
        ...branch,

        // Keep the parent's database ID for the route.
        parent_membership_row_id: membership.id,

        // Preserve the branch's real database ID separately.
        branch_id: branch.id,

        // A unique card ID for React.
        id: `${membership.id}:${branch.id}`,

        is_branch: true,

        display_number:
          branch.display_number ??
          `${membership.membership_number ?? "—"}${branch.suffix ?? ""}`,

        // Lettered branches retain their parent's membership number.
        membership_number: membership.membership_number,

        card_head_name: branch.head_name ?? branch.card_head_name ?? null,
        member_count: branch.member_count ?? 0,

        membership_status:
          branch.branch_status ?? membership.membership_status,
      }));

      return [mainCard, ...branchCards];
    });
  }, [directory]);

  const filteredMemberships = useMemo(() => {
    const query = (searchValue || "").trim().toLowerCase();

    const filtered = displayCards.filter((membership) => {
      const status = membership.membership_status;

      if (
        statusFilter !== "All" &&
        !(statusFilter === "Non-current"
          ? status !== "Active"
          : status === statusFilter)
      ) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        membership.display_number,
        membership.membership_number,
        membership.annual_number,
        membership.display_suffix,
        membership.suffix,
        membership.head_name,
        membership.card_head_name,
        membership.head_person_id,
        membership.membership_id,
        membership.area,
        membership.city,
        membership.door_number,
        membership.street_name,
        membership.pincode,
        membership.primary_phone_number,
        membership.alternate_phone_number,
        membership.email,
        membership.is_branch ? "branch" : "membership",
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    // Natural order: 1, 2, 3, 10, 17, 18.
    // Lettered branches follow their parent: 17, 17A, 17B, 18.
    return filtered.sort((a, b) => {
      const numberA = String(a.membership_number ?? "").trim();
      const numberB = String(b.membership_number ?? "").trim();

      if (!numberA && numberB) return 1;
      if (numberA && !numberB) return -1;

      const numberComparison = membershipNumberCollator.compare(
        numberA,
        numberB,
      );

      if (numberComparison !== 0) {
        return numberComparison;
      }

      if (a.is_branch !== b.is_branch) {
        return a.is_branch ? 1 : -1;
      }

      if (a.is_branch && b.is_branch) {
        return membershipNumberCollator.compare(
          String(a.suffix ?? ""),
          String(b.suffix ?? ""),
        );
      }

      return membershipNumberCollator.compare(
        String(a.head_name ?? ""),
        String(b.head_name ?? ""),
      );
    });
  }, [displayCards, searchValue, statusFilter]);

  function openMembership(membership) {
    if (membership.is_branch) {
      navigate(
        `/memberships/${membership.parent_membership_row_id}?branchId=${membership.branch_id}`,
        {
          state: {
            from: "memberships",
          },
        },
      );
      return;
    }

    navigate(`/memberships/${membership.id}`);
  }

  function handleExport() {
    if (!canExportMemberships) return;

    const headers = [
      "Displayed Number",
      "Record Type",
      "Branch Of",
      "Head of Membership",
      "Area",
      "City",
      "Member Count",
      "Status",
      "Permanent Membership ID",
    ];

    const rows = filteredMemberships.map((membership) => [
      getDisplayNumber(membership),
      membership.is_branch ? "Branch" : "Membership",
      membership.is_branch ? membership.membership_number : "",
      membership.card_head_name || membership.head_name,
      membership.area,
      membership.city,
      membership.member_count,
      membership.membership_status,
      membership.membership_id,
    ]);

    const escapeCsv = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "church-desk-memberships.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  if (isFellowshipLeader) {
    return (
      <section className="rounded-[16px] border border-[#ececed] bg-white p-6">
        <h1 className="text-[20px] font-extrabold text-[#131418]">
          Membership directory unavailable
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-[#777984]">
          Fellowship Leaders can access members within their assigned
          fellowships through the Members directory. General household
          membership records are not available in this workspace.
        </p>
        <button
          type="button"
          onClick={() => navigate("/members")}
          className="mt-4 rounded-xl bg-[#191a1f] px-4 py-3 text-[12px] font-semibold text-white"
        >
          Open Members
        </button>
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <header className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-[-0.8px] text-[#131418] sm:text-[34px]">
          Membership
        </h1>

        <p className="mt-2 text-[14px] text-[#6b6d76] sm:text-[16px]">
          Manage church memberships and members · Current register:{" "}
          {activeRegister?.name ?? "No finalised register"}
        </p>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        {canManageMemberships && (
          <>
            <ActionButton onClick={() => setImportModalOpen(true)}>
              <ArrowDownToLine size={17} />
              Import
            </ActionButton>

            <ActionButton primary onClick={() => setAddModalOpen(true)}>
              <CirclePlus size={17} />
              Add New Membership
            </ActionButton>
          </>
        )}

        {canExportMemberships && (
          <ActionButton onClick={handleExport} disabled={loading}>
            <ArrowUpFromLine size={17} />
            Export
          </ActionButton>
        )}
      </div>

      <div className="mb-7 flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-[#9b9da5]"
          />

          <input
            type="search"
            value={searchValue || ""}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search memberships, branches, members, phone numbers, address..."
            aria-label="Search memberships"
            className="h-[54px] w-full rounded-full border border-[#e9e9eb] bg-transparent py-3 pl-[52px] pr-5 text-[13px] outline-none transition placeholder:text-[#92939b] focus:border-[#c8cce0] focus:bg-white"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full border px-5 py-3 text-[13px] font-medium transition ${
                statusFilter === filter
                  ? "border-[#191a1f] bg-[#191a1f] text-white"
                  : "border-[#e9e9eb] bg-white text-[#53555e] hover:bg-[#f8f8f9]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          <button
            type="button"
            onClick={loadDirectory}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-[#e9e9eb] bg-white">
          <p className="text-sm text-[#777984]">Loading memberships...</p>
        </div>
      ) : filteredMemberships.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-[#e9e9eb] bg-white px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eeeeef] text-[#53555e]">
            <Users size={24} />
          </div>

          <h2 className="text-[16px] font-bold text-[#131418]">
            {searchValue || statusFilter !== "All"
              ? "No matching memberships"
              : "No membership records yet"}
          </h2>

          <p className="mt-2 max-w-[390px] text-[13px] leading-6 text-[#92939b]">
            {searchValue || statusFilter !== "All"
              ? "Try a different search or status filter."
              : "Memberships created in Church Desk will appear here."}
          </p>

          {!searchValue &&
            statusFilter === "All" &&
            canManageMemberships && (
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#191a1f] px-4 py-3 text-[12px] font-semibold text-white hover:bg-black"
              >
                <CirclePlus size={15} />
                Add New Membership
              </button>
            )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[12px] text-[#92939b]">
              {filteredMemberships.length}{" "}
              {filteredMemberships.length === 1 ? "record" : "records"}
              {" · Includes lettered branches"}
            </p>

            <button
              type="button"
              onClick={loadDirectory}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-[#53555e] transition hover:bg-white disabled:opacity-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredMemberships.map((membership) => (
              <MembershipCard
                key={membership.id}
                membership={membership}
                onOpen={openMembership}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#92939b]">
        <p>
          Branch cards are linked to their parent membership. Permanent IDs do
          not change when membership numbers change.
        </p>

        <p>{loading ? "Loading..." : `${filteredMemberships.length} shown`}</p>
      </div>

      {addModalOpen && canManageMemberships && (
        <AddMembershipModal
          onClose={() => setAddModalOpen(false)}
          onCreated={async () => {
            await loadDirectory();
            setAddModalOpen(false);
          }}
        />
      )}

      {importModalOpen && canManageMemberships && (
        <MembershipImportModal
          onClose={() => setImportModalOpen(false)}
        />
      )}
    </div>
  );
}
