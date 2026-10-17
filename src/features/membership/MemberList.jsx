import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ChevronRight,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { getMemberDirectory } from "../../services/membershipService";

const STATUS_OPTIONS = ["Active", "Inactive", "Deceased", "Removed"];

const inputClass =
  "min-h-[42px] w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2 text-[12px] text-[#25262c] outline-none focus:border-[#9b9da5]";

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not Recorded"
    : String(value);
}

function StatusBadge({ status }) {
  const styles = {
    Active: "bg-[#e5f6ec] text-[#18794e]",
    Inactive: "bg-[#eeeeef] text-[#53555e]",
    Deceased: "bg-[#fbe9e6] text-[#aa382d]",
    Transferred: "bg-[#fbf1dc] text-[#8a6108]",
    "Left Church": "bg-[#fbf1dc] text-[#8a6108]",
    Removed: "bg-[#fbe9e6] text-[#aa382d]",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
        styles[status] ?? "bg-[#f4f4f5] text-[#6b6d76]"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

export default function MemberList() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [membershipFilter, setMembershipFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");
  const [groupFilter, setGroupFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getMemberDirectory();
      setMembers(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const membershipOptions = useMemo(() => {
    const options = new Map();

    members.forEach((member) => {
      if (member.membership_row_id) {
        options.set(member.membership_row_id, {
          id: member.membership_row_id,
          number: member.display_membership_number,
        });
      }
    });

    return [...options.values()].sort((a, b) =>
      String(a.number).localeCompare(String(b.number), undefined, {
        numeric: true,
      }),
    );
  }, [members]);

  const groupOptions = useMemo(() => {
    const names = new Set();

    members.forEach((member) => {
      (member.groups ?? []).forEach((group) => names.add(group.name));
    });

    return [...names].sort((a, b) => a.localeCompare(b));
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members
      .filter((member) => {
        if (
          membershipFilter !== "All" &&
          member.membership_row_id !== membershipFilter
        ) {
          return false;
        }

        if (genderFilter !== "All" && member.gender !== genderFilter) {
          return false;
        }

        if (
          groupFilter !== "All" &&
          !(member.groups ?? []).some((group) => group.name === groupFilter)
        ) {
          return false;
        }

        if (statusFilter !== "All" && member.status !== statusFilter) {
          return false;
        }

        if (!query) return true;

        const searchable = [
          member.name,
          member.person_id,
          member.membership_id,
          member.display_membership_number,
          member.relationship_to_head,
          member.gender,
          member.date_of_birth,
          member.phone_number,
          member.email,
          member.marital_status,
          member.baptism_status,
          ...(member.groups ?? []).map((group) => group.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .sort(
        (a, b) =>
          String(a.display_membership_number).localeCompare(
            String(b.display_membership_number),
            undefined,
            { numeric: true },
          ) || String(a.name).localeCompare(String(b.name)),
      );
  }, [
    members,
    search,
    membershipFilter,
    genderFilter,
    groupFilter,
    statusFilter,
  ]);

  function exportCsv() {
    const headers = [
      "Name",
      "Person ID",
      "Membership Number",
      "Membership ID",
      "Relationship",
      "Gender",
      "Date of Birth",
      "Phone",
      "Email",
      "Marital Status",
      "Baptism Status",
      "Fellowships",
      "Status",
    ];

    const rows = filteredMembers.map((member) => [
      member.name,
      member.person_id,
      member.display_membership_number,
      member.membership_id,
      member.relationship_to_head,
      member.gender,
      member.date_of_birth,
      member.phone_number,
      member.email,
      member.marital_status,
      member.baptism_status,
      (member.groups ?? []).map((group) => group.name).join("; "),
      member.status,
    ]);

    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "church-desk-members.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.8px] text-[#131418]">
            Members
          </h1>
          <p className="mt-1 text-[12.5px] text-[#777984]">
            Individual member directory · {members.length} members
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          disabled={loading || filteredMembers.length === 0}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-[11px] border border-[#e5e5e7] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#25262c] hover:bg-[#f7f7f8] disabled:opacity-50"
        >
          <ArrowDownToLine size={16} />
          Export CSV
        </button>
      </header>

      <section className="rounded-[16px] border border-[#ececed] bg-white p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className="sr-only">Search members</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members..."
              className={inputClass}
            />
          </label>

          <select
            value={membershipFilter}
            onChange={(event) => setMembershipFilter(event.target.value)}
            className={inputClass}
          >
            <option value="All">All Memberships</option>
            {membershipOptions.map((item) => (
              <option key={item.id} value={item.id}>
                Membership {item.number}
              </option>
            ))}
          </select>

          <select
            value={genderFilter}
            onChange={(event) => setGenderFilter(event.target.value)}
            className={inputClass}
          >
            <option value="All">All Genders</option>
            {["Male", "Female", "Other", "Prefer not to say"].map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>

          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className={inputClass}
          >
            <option value="All">All Fellowships</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={inputClass}
          >
            <option value="All">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-[#888a93]">
            Showing {filteredMembers.length} of {members.length} members
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setMembershipFilter("All");
              setGenderFilter("All");
              setGroupFilter("All");
              setStatusFilter("All");
            }}
            className="text-[11.5px] font-semibold text-[#53555e] hover:text-[#131418]"
          >
            Clear filters
          </button>
        </div>
      </section>

      {error && (
        <section
          role="alert"
          className="rounded-[12px] border border-red-200 bg-red-50 p-4"
        >
          <p className="text-[12px] font-semibold text-red-700">
            Could not load members
          </p>
          <p className="mt-1 break-words text-[12px] text-red-600">{error}</p>
          <button
            type="button"
            onClick={loadMembers}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-red-700"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </section>
      )}

      <section className="overflow-hidden rounded-[16px] border border-[#ececed] bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-[#f2f2f3] px-5 py-4">
          <div className="flex items-center gap-2">
            <Users size={17} className="text-[#53555e]" />
            <h2 className="text-[13px] font-extrabold text-[#131418]">
              Member Directory
            </h2>
          </div>
          <span className="text-[11px] text-[#888a93]">
            Select a row to view details
          </span>
        </header>

        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center gap-3 text-[12px] text-[#777984]">
            <RefreshCw size={16} className="animate-spin" />
            Loading members...
          </div>
        ) : !error && filteredMembers.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center px-5 text-center">
            <Users size={28} className="text-[#c3c4ca]" />
            <p className="mt-3 text-[13px] font-semibold text-[#53555e]">
              No members found
            </p>
            <p className="mt-1 text-[11.5px] text-[#888a93]">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] border-collapse text-left">
              <thead>
                <tr className="bg-[#f7f7f8]">
                  {[
                    "Member",
                    "Membership No.",
                    "Relationship",
                    "Gender",
                    "DOB",
                    "Phone",
                    "Email",
                    "Fellowships",
                    "Status",
                    "",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap border-b border-[#ececed] px-4 py-3 text-[10.5px] font-bold text-[#53555e]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    tabIndex={0}
                    onClick={() => navigate(`/members/${member.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        navigate(`/members/${member.id}`);
                      }
                    }}
                    className="cursor-pointer border-b border-[#f2f2f3] transition last:border-0 hover:bg-[#fafafd]"
                  >
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap text-[11.5px] font-bold text-[#25262c]">
                        {member.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#888a93]">
                        {member.person_id || "No Person ID"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[11.5px] font-semibold text-[#25262c]">
                      {displayValue(member.display_membership_number)}
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-[#53555e]">
                      {displayValue(member.relationship_to_head)}
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-[#53555e]">
                      {displayValue(member.gender)}
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-[#53555e]">
                      {displayValue(member.date_of_birth)}
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-[#53555e]">
                      {displayValue(member.phone_number)}
                    </td>
                    <td className="max-w-[190px] truncate px-4 py-3 text-[11.5px] text-[#53555e]">
                      {displayValue(member.email)}
                    </td>
                    <td className="max-w-[230px] whitespace-normal px-4 py-3 text-[11.5px] text-[#53555e]">
                      {(member.groups ?? [])
                        .map((group) => group.name)
                        .join(", ") || "Not Recorded"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-4 py-3 text-[#9b9da5]">
                      <ChevronRight size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
