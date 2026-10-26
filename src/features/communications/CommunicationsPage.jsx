
import { useState } from "react";
import { BellRing, Cake } from "lucide-react";
import AnnouncementsTab from "./AnnouncementsTab";
import SpecialDaysTab from "./SpecialDaysTab";

const TABS = [
  { id: "announcements", label: "Announcements", icon: BellRing },
  { id: "special-days", label: "Special Days", icon: Cake },
];

export default function CommunicationsPage() {
  const [activeTab, setActiveTab] = useState("announcements");

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#17181c] sm:text-[30px]">
            Communications
          </h1>
          <p className="mt-1.5 text-sm text-[#777985]">
            Send updates and greetings to your church family.
          </p>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-[#e6e6e9]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "border-[#1e1e1e] text-[#1e1e1e]"
                  : "border-transparent text-[#858792] hover:text-[#33343b]"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "announcements" ? <AnnouncementsTab /> : <SpecialDaysTab />}
    </div>
  );
}
