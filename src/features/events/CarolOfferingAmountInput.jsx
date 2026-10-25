
import { useCallback, useEffect, useState } from "react";
import {
  getCarolOfferingsForVisits,
  saveCarolOffering,
} from "../../services/events/carolOfferingService";

export default function CarolOfferingAmountInput({ visit }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const enabled = visit.status === "Visited";

  const loadAmount = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const records = await getCarolOfferingsForVisits([visit.id]);
      setAmount(records[0] ? String(records[0].amount) : "");
    } catch (err) {
      setError(err.message || "Unable to load offering.");
    } finally {
      setLoading(false);
    }
  }, [visit.id]);

  useEffect(() => {
    loadAmount();
  }, [loadAmount]);

  async function handleBlur() {
    if (!enabled || amount.trim() === "") return;

    setSaving(true);
    setError("");

    try {
      const saved = await saveCarolOffering(visit.id, { amount });
      setAmount(String(saved.amount));
    } catch (err) {
      setError(err.message || "Unable to save offering.");
      await loadAmount();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[130px]">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#898b95]">
          ₹
        </span>

        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          aria-label={`Offering amount for ${visit.membership?.head_name || "membership"}`}
          placeholder={enabled ? "Enter amount" : "—"}
          value={enabled ? amount : ""}
          disabled={!enabled || loading || saving}
          onChange={(event) => setAmount(event.target.value)}
          onBlur={handleBlur}
          className="w-full rounded-lg border border-[#e1e1e6] bg-white py-2 pl-7 pr-2 text-sm text-[#1e1e1e] outline-none transition placeholder:text-[#a0a1a9] focus:border-[#777985] disabled:cursor-not-allowed disabled:bg-[#f5f5f6] disabled:text-[#a0a1a9]"
        />
      </div>

      {saving && (
        <p className="mt-1 text-[10px] text-[#777985]">Saving…</p>
      )}

      {error && (
        <p className="mt-1 max-w-[180px] text-[10px] text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
