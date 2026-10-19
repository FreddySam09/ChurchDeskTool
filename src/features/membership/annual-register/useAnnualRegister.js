import { useCallback, useEffect, useState } from "react";
import {
  createAnnualRegister,
  createRegisterSnapshot,
  finaliseAnnualRegister,
  getAnnualRegister,
  listAnnualRegisters,
  listRegisterEntries,
  listRegisterHistory,
  recordRegisterHistory,
  saveEntryOrder,
  setEntryHead,
  setEntryIncluded,
  setEntryNumber,
  setRegisterStatus,
  splitBranchInDraft,
  undoBranchSplitInDraft,
  deleteAnnualRegisterDraft,
  resyncAnnualRegisterDraft,
} from "./annualRegisterService";

import { getRegisterSummary } from "./annualRegisterUtils";

export default function useAnnualRegister() {
  const [registers, setRegisters] = useState([]);
  const [selectedRegisterId, setSelectedRegisterId] = useState("");
  const [selectedRegister, setSelectedRegister] = useState(null);
  const [entries, setEntries] = useState([]);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadSelectedRegister = useCallback(async (registerId) => {
    if (!registerId) {
      setSelectedRegister(null);
      setEntries([]);
      setHistory([]);
      return;
    }

    const [register, registerEntries, registerHistory] = await Promise.all([
      getAnnualRegister(registerId),
      listRegisterEntries(registerId),
      listRegisterHistory(registerId),
    ]);

    setSelectedRegister(register);
    setEntries(registerEntries);
    setHistory(registerHistory);
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const data = await listAnnualRegisters();
      setRegisters(data);

      const validSelectedId =
        selectedRegisterId &&
        data.some((item) => item.id === selectedRegisterId)
          ? selectedRegisterId
          : (data[0]?.id ?? "");

      setSelectedRegisterId(validSelectedId);

      if (validSelectedId) {
        await loadSelectedRegister(validSelectedId);
      } else {
        setSelectedRegister(null);
        setEntries([]);
        setHistory([]);
      }
    } catch (loadError) {
      setError(loadError?.message || "Unable to load annual registers.");
    } finally {
      setLoading(false);
    }
  }, [loadSelectedRegister, selectedRegisterId]);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      setLoading(true);
      setError("");

      try {
        const data = await listAnnualRegisters();
        if (cancelled) return;

        setRegisters(data);

        const initialId = data[0]?.id ?? "";
        setSelectedRegisterId(initialId);

        if (initialId) {
          const [register, registerEntries, registerHistory] =
            await Promise.all([
              getAnnualRegister(initialId),
              listRegisterEntries(initialId),
              listRegisterHistory(initialId),
            ]);

          if (cancelled) return;

          setSelectedRegister(register);
          setEntries(registerEntries);
          setHistory(registerHistory);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || "Unable to load annual registers.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectRegister = useCallback(
    async (registerId) => {
      setSelectedRegisterId(registerId);
      setError("");
      setLoading(true);

      try {
        await loadSelectedRegister(registerId);
      } catch (loadError) {
        setError(loadError?.message || "Unable to open this register.");
      } finally {
        setLoading(false);
      }
    },
    [loadSelectedRegister],
  );

  const runAction = useCallback(
    async (action) => {
      setWorking(true);
      setError("");

      try {
        const result = await action();
        const data = await listAnnualRegisters();
        setRegisters(data);

        if (selectedRegisterId) {
          await loadSelectedRegister(selectedRegisterId);
        }

        return result;
      } catch (actionError) {
        setError(actionError?.message || "The operation failed.");
        throw actionError;
      } finally {
        setWorking(false);
      }
    },
    [loadSelectedRegister, selectedRegisterId],
  );

  const createDraft = useCallback(
    async ({ name, year, populateSnapshot }) =>
      runAction(async () => {
        const register = await createAnnualRegister({ name, year });

        if (populateSnapshot) {
          try {
            await createRegisterSnapshot(register.id);
          } catch (snapshotError) {
            setSelectedRegisterId(register.id);
            throw new Error(
              `The draft was created, but copying current memberships failed: ${snapshotError.message}`,
            );
          }
        }

        setSelectedRegisterId(register.id);

        await recordRegisterHistory(register.id, "REGISTER_READY", {
          snapshot_created: Boolean(populateSnapshot),
        });

        return register;
      }),
    [runAction],
  );

  const summary = getRegisterSummary(entries);

  if (
    status === "Under Review" &&
    summary.entriesNeedingReview > 0
  ) {
    const message =
      `Cannot submit this register: ${summary.entriesNeedingReview} ` +
      "included entries need review. Fix duplicate or missing numbers, " +
      "invalid numbers, and head designations first.";

    setError(message);
    throw new Error(message);
  }

  const changeStatus = useCallback(
    (status) => {
      if (!selectedRegisterId) return Promise.resolve();

      return runAction(() => setRegisterStatus(selectedRegisterId, status));
    },
    [runAction, selectedRegisterId],
  );

  const finaliseSelectedRegister = useCallback(async () => {
    if (!selectedRegisterId) {
      throw new Error("Select a register to finalise.");
    }

    if (selectedRegister?.status !== "Under Review") {
      throw new Error("Only an Under Review register can be finalised.");
    }

    return runAction(() => finaliseAnnualRegister(selectedRegisterId));
  }, [runAction, selectedRegisterId, selectedRegister?.status]);

  const toggleEntryIncluded = useCallback(
    (entry, included) => runAction(() => setEntryIncluded(entry, included)),
    [runAction],
  );

  const designateHead = useCallback(
    (entry, memberId) => runAction(() => setEntryHead(entry, memberId)),
    [runAction],
  );

  const reorderEntries = useCallback(
    (nextEntries) => {
      if (!selectedRegisterId) return Promise.resolve();

      return runAction(() => saveEntryOrder(selectedRegisterId, nextEntries));
    },
    [runAction, selectedRegisterId],
  );

  const updateEntryNumber = useCallback(
    (entry, value) => runAction(() => setEntryNumber(entry, value)),
    [runAction],
  );

  const splitBranch = useCallback(
    (entry, label) => runAction(() => splitBranchInDraft(entry, label)),
    [runAction],
  );

  const undoSplitBranch = useCallback(
    (entry) => runAction(() => undoBranchSplitInDraft(entry)),
    [runAction],
  );

  
const deleteDraft = useCallback(
  async (registerId = selectedRegisterId) => {
    if (!registerId) {
      throw new Error("Select a draft to delete.");
    }

    setWorking(true);
    setError("");

    try {
      await deleteAnnualRegisterDraft(registerId);

      const updatedRegisters = await listAnnualRegisters();
      setRegisters(updatedRegisters);

      const nextRegisterId =
        updatedRegisters.find((item) => item.id === selectedRegisterId)?.id ??
        updatedRegisters[0]?.id ??
        "";

      setSelectedRegisterId(nextRegisterId);

      if (nextRegisterId) {
        await loadSelectedRegister(nextRegisterId);
      } else {
        setSelectedRegister(null);
        setEntries([]);
        setHistory([]);
      }
    } catch (actionError) {
      setError(actionError?.message || "Unable to delete the draft.");
      throw actionError;
    } finally {
      setWorking(false);
    }
  },
  [selectedRegisterId, loadSelectedRegister],
);


const resyncDraft = useCallback(async () => {
  if (!selectedRegisterId) {
    throw new Error("Select a draft register first.");
  }

  return runAction(() => resyncAnnualRegisterDraft(selectedRegisterId));
}, [runAction, selectedRegisterId]);



  return {
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
    finaliseSelectedRegister,
    toggleEntryIncluded,
    designateHead,
    reorderEntries,
    updateEntryNumber,
    splitBranch,
    undoSplitBranch,
    deleteDraft,
    resyncDraft,
  };
}
