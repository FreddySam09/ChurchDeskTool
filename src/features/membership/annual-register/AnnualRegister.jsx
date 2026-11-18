
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

import RegisterSidebar from "./RegisterSidebar";
import RegisterHeader from "./RegisterHeader";
import RegisterEntries from "./RegisterEntries";
import RegisterHistory from "./RegisterHistory";
import useAnnualRegister from "./useAnnualRegister";

export default function AnnualRegister() {
  const navigate = useNavigate();
  const { role, permissions } = useAuth();

  const isFellowshipLeader = role === "Fellowship Leader";
  const canManageRegister =
    !isFellowshipLeader && permissions.canWrite("membership");

  const {
    registers,
    selectedRegisterId,
    selectedRegister,
    entries,
    history,
    loading,
    working,
    error,
    setError,
    selectRegister,
    refresh,
    createDraft,
    changeStatus,
    toggleEntryIncluded,
    designateHead,
    splitBranch,
    reorderEntries,
    updateEntryNumber,
    undoSplitBranch,
    deleteDraft,
    resyncDraft,
    finaliseSelectedRegister,
  } = useAnnualRegister();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState(
    `Annual Membership Register ${new Date().getFullYear()}`,
  );
  const [draftYear, setDraftYear] = useState(
    String(new Date().getFullYear()),
  );
  const [populateSnapshot, setPopulateSnapshot] = useState(true);

  // A register is read-only if it is finalised OR the current user
  // does not have permission to write to the Membership workspace.
  const readOnly =
    !canManageRegister || selectedRegister?.status === "Finalised";

  async function handleCreateDraft(event) {
    event.preventDefault();

    if (!canManageRegister || working) return;

    setError("");

    try {
      const created = await createDraft({
        name: draftName,
        year: Number(draftYear),
        populateSnapshot,
      });

      if (created?.id) {
        await selectRegister(created.id);
      }

      setCreateDialogOpen(false);
      setDraftName(
        `Annual Membership Register ${new Date().getFullYear()}`,
      );
      setDraftYear(String(new Date().getFullYear()));
      setPopulateSnapshot(true);
    } catch {
      // The hook displays the actionable error.
    }
  }

  async function handleStatusChange(status) {
    if (readOnly) return;

    try {
      await changeStatus(status);
    } catch {
      // Error is shown in the page alert.
    }
  }

  async function handleToggleIncluded(entry, included) {
    if (readOnly) return;

    try {
      await toggleEntryIncluded(entry, included);
    } catch {
      // Error is shown in the page alert.
    }
  }

  async function handleDesignateHead(entry, memberId) {
    if (readOnly) return;

    try {
      await designateHead(entry, memberId);
    } catch {
      // Error is shown in the page alert.
    }
  }

  async function handleSplitBranch(entry) {
    if (readOnly) return;

    const confirmed = window.confirm(
      `Mark branch ${entry.membership_number} as an independent split in this draft? This does not create a new live membership.`,
    );

    if (!confirmed) return;

    try {
      await splitBranch(entry);
    } catch {
      // Error is shown in the page alert.
    }
  }

  async function handleReorder(nextEntries) {
    if (readOnly) return;

    try {
      await reorderEntries(nextEntries);
    } catch {
      // Error is shown in the page alert.
    }
  }

  async function handleNumberChange(entry, value) {
    if (readOnly) return;

    try {
      await updateEntryNumber(entry, value);
    } catch {
      // Error is shown in the page alert.
    }
  }

  async function handleUndoSplit(entry) {
    if (readOnly) return;

    const confirmed = window.confirm(
      `Restore branch ${entry.membership_number} under its original parent membership?`,
    );

    if (!confirmed) return;

    try {
      await undoSplitBranch(entry);
    } catch {
      // Error is shown in the page alert.
    }
  }

  async function handleResyncDraft() {
    if (readOnly) return;

    setError("");

    try {
      const result = await resyncDraft();

      window.alert(
        `Draft resynced successfully.\n\n` +
          `New memberships: ${result.addedMemberships}\n` +
          `New branches: ${result.addedBranches}\n` +
          `New member assignments: ${result.addedAssignments}`,
      );

      await refresh();
    } catch {
      // Error is shown in the page alert.
    }
  }

  async function handleDeleteRegisterDraft(register) {
    if (
      !canManageRegister ||
      !register ||
      register.status !== "Draft" ||
      working
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Delete draft "${register.name}"?\n\n` +
        "Only this draft and its draft-specific records will be deleted. " +
        "Live memberships, people, permanent IDs, and relationships will remain unchanged.",
    );

    if (!confirmed) return;

    setError("");

    try {
      await deleteDraft(register.id);
    } catch (deleteError) {
      console.error(
        "Failed to delete annual register draft:",
        deleteError,
      );
      // useAnnualRegister sets the error displayed on the page.
    }
  }

  async function handleFinaliseRegister() {
    if (!canManageRegister || working) return;

    if (!selectedRegister || selectedRegister.status !== "Under Review") {
      setError("Select an Under Review register first.");
      return;
    }

    const confirmed = window.confirm(
      `Finalise "${selectedRegister.name}" (${selectedRegister.register_year})?\n\n` +
        "This operation permanently locks this register and applies its membership decisions. " +
        "It cannot be undone from the application.",
    );

    if (!confirmed) return;

    try {
      await finaliseSelectedRegister();
      await refresh();
    } catch {
      // The hook already stores and displays the database error.
    }
  }

  if (isFellowshipLeader) {
    return (
      <section className="rounded-[16px] border border-[#ececed] bg-white p-6">
        <h1 className="text-[20px] font-extrabold text-[#131418]">
          Annual Register unavailable
        </h1>

        <p className="mt-2 text-[13px] leading-6 text-[#777984]">
          Annual household registers are not available to Fellowship Leaders.
          You can manage members in your assigned fellowships through the
          Groups workspace.
        </p>

        <button
          type="button"
          onClick={() => navigate("/groups")}
          className="mt-4 rounded-xl bg-[#191a1f] px-4 py-3 text-[12px] font-semibold text-white"
        >
          Open Groups
        </button>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f4f5] p-4 text-[#131418] sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1900px]">
        {/* Page heading */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#92939b]">
              Church Desk
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Annual Membership Register
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777984]">
              Prepare yearly membership records, review branch structures,
              manage numbering, and check assigned household heads.
            </p>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading || working}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#e9e9eb] bg-white px-4 py-2.5 text-sm font-medium text-[#25262c] transition hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50 sm:self-center"
          >
            <span aria-hidden="true">↻</span>
            Refresh
          </button>
        </div>

        {!canManageRegister && (
          <div className="mb-5 rounded-xl border border-[#e5e5e7] bg-white px-4 py-3">
            <p className="text-[12px] leading-5 text-[#53555e]">
              You have read-only access to the Annual Membership Register.
              You can view register entries and activity history, but cannot
              create or modify register records.
            </p>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center"
          >
            <p className="text-sm leading-6 text-rose-700">{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              className="self-start text-xs font-medium text-rose-700 underline underline-offset-4 sm:self-center"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Register navigation and selected register summary */}
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <RegisterSidebar
            registers={registers}
            selectedRegisterId={selectedRegisterId}
            onSelect={selectRegister}
            onCreate={
              canManageRegister
                ? () => setCreateDialogOpen(true)
                : undefined
            }
            onDelete={
              canManageRegister
                ? handleDeleteRegisterDraft
                : undefined
            }
            loading={loading}
            working={working}
          />

          <div className="min-w-0 space-y-5">
            {loading && !selectedRegister ? (
              <div className="rounded-2xl border border-[#e9e9eb] bg-white p-10 text-center text-sm text-[#777984]">
                Loading annual register...
              </div>
            ) : !selectedRegister ? (
              <section className="flex min-h-[244px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#e9e9eb] bg-white px-6 py-10 text-center sm:px-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f5] text-xl text-[#53555e]">
                  +
                </div>

                <h2 className="mt-4 text-lg font-semibold text-[#131418]">
                  {canManageRegister
                    ? "Start an annual register"
                    : "No annual register selected"}
                </h2>

                <p className="mt-2 max-w-lg text-sm leading-6 text-[#777984]">
                  {canManageRegister
                    ? "Create a draft and optionally copy the current membership structure into it."
                    : "There are no annual registers available to display."}
                </p>

                {canManageRegister && (
                  <button
                    type="button"
                    onClick={() => setCreateDialogOpen(true)}
                    className="mt-5 rounded-xl bg-[#191a1f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#33343a]"
                  >
                    Create first draft
                  </button>
                )}
              </section>
            ) : (
              <RegisterHeader
                register={selectedRegister}
                entries={entries}
                working={working}
                onStatusChange={handleStatusChange}
                onFinalise={handleFinaliseRegister}
              />
            )}
          </div>
        </div>

        {/* Full-width register editor */}
        {selectedRegister && (
          <div className="mt-5 min-w-0 space-y-5">
            <RegisterEntries
              entries={entries}
              loading={loading}
              working={working}
              readOnly={readOnly}
              onResync={handleResyncDraft}
              onToggleIncluded={handleToggleIncluded}
              onDesignateHead={handleDesignateHead}
              onSplitBranch={handleSplitBranch}
              onUndoSplit={handleUndoSplit}
              onReorder={handleReorder}
              onNumberChange={handleNumberChange}
            />

            <RegisterHistory history={history} loading={loading} />
          </div>
        )}
      </div>

      {/* Create register dialog */}
      {createDialogOpen && canManageRegister && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !working) {
              setCreateDialogOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-register-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-[#e9e9eb] bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="create-register-title"
                  className="text-lg font-semibold text-[#131418]"
                >
                  Create annual register
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#777984]">
                  Create a draft for the selected year.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close dialog"
                disabled={working}
                onClick={() => setCreateDialogOpen(false)}
                className="rounded-lg px-2 py-1 text-[#777984] transition hover:bg-[#f7f7f8] hover:text-[#131418] disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="register-name"
                  className="mb-2 block text-sm font-medium text-[#53555e]"
                >
                  Register name
                </label>

                <input
                  id="register-name"
                  required
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="w-full rounded-xl border border-[#e5e5e7] bg-white px-4 py-3 text-sm text-[#131418] outline-none focus:border-[#7b88c9] focus:ring-2 focus:ring-[#7b88c9]/10"
                  placeholder="Annual Membership Register 2027"
                />
              </div>

              <div>
                <label
                  htmlFor="register-year"
                  className="mb-2 block text-sm font-medium text-[#53555e]"
                >
                  Register year
                </label>

                <input
                  id="register-year"
                  type="number"
                  required
                  min="1900"
                  max="9999"
                  value={draftYear}
                  onChange={(event) => setDraftYear(event.target.value)}
                  className="w-full rounded-xl border border-[#e5e5e7] bg-white px-4 py-3 text-sm text-[#131418] outline-none focus:border-[#7b88c9] focus:ring-2 focus:ring-[#7b88c9]/10"
                />
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-[#e9e9eb] bg-[#f8f8f9] p-4">
                <input
                  type="checkbox"
                  checked={populateSnapshot}
                  onChange={(event) =>
                    setPopulateSnapshot(event.target.checked)
                  }
                  className="mt-1 accent-[#25262c]"
                />

                <span>
                  <span className="block text-sm font-medium text-[#25262c]">
                    Copy current memberships
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-[#777984]">
                    Populate the draft with current memberships, active
                    branches, and their assigned people.
                  </span>
                </span>
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-[#e9e9eb] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => setCreateDialogOpen(false)}
                  className="rounded-xl border border-[#e9e9eb] px-4 py-2.5 text-sm font-medium text-[#53555e] transition hover:bg-[#f7f7f8] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={working || !draftName.trim() || !draftYear}
                  className="rounded-xl bg-[#191a1f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#33343a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {working ? "Creating..." : "Create draft"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
