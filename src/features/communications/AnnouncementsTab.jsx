
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Eye,
  MessageCircle,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  createAnnouncement,
  getAnnouncementHistory,
  getCommunicationGroups,
  getCommunicationRecipients,
  markAnnouncementOpened,
} from "../../services/communications/communicationsService";

const inputClass =
  "w-full rounded-xl border border-[#e5e5e7] bg-[#f7f7f8] px-3.5 py-3 text-sm outline-none focus:border-[#858792]";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function WhatsAppLink({ recipient, message, children }) {
  const phone = String(recipient?.whatsapp_phone || "").replace(/[^\d]/g, "");
  if (!phone) return <span className="text-xs text-[#a0a1a8]">No phone</span>;

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfece3] bg-[#f0faf3] px-3 py-2 text-xs font-semibold text-[#237744] hover:bg-[#e4f5e9]"
    >
      <MessageCircle size={14} />
      {children}
    </a>
  );
}

export default function AnnouncementsTab() {
  const [groups, setGroups] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audienceType, setAudienceType] = useState("all");
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [groupRows, recipientRows, announcementRows] = await Promise.all([
        getCommunicationGroups(),
        getCommunicationRecipients(),
        getAnnouncementHistory(),
      ]);
      setGroups(groupRows);
      setRecipients(recipientRows);
      setHistory(announcementRows);
    } catch (err) {
      setError(err.message || "Unable to load Communications data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const targetedRecipients = useMemo(() => {
    if (audienceType === "all") return recipients;

    const selected = new Set(selectedGroupIds);
    return recipients.filter((person) =>
      (person.groups ?? []).some((group) => selected.has(group.id)),
    );
  }, [recipients, audienceType, selectedGroupIds]);

  const recipientsWithPhone = targetedRecipients.filter(
    (person) => person.whatsapp_phone,
  );

  function toggleGroup(id) {
    setSelectedGroupIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function resetComposer() {
    setTitle("");
    setMessage("");
    setAudienceType("all");
    setSelectedGroupIds([]);
    setComposerOpen(false);
    setPreviewOpen(false);
  }

  async function saveAnnouncement() {
    setError("");
    setNotice("");

    if (!title.trim() || !message.trim()) {
      setError("Enter both an announcement title and a message.");
      return;
    }

    if (audienceType === "groups" && selectedGroupIds.length === 0) {
      setError("Select at least one audience group.");
      return;
    }

    setSaving(true);

    try {
      const created = await createAnnouncement({
        title,
        message,
        audienceType,
        groupIds: selectedGroupIds,
      });

      setSelectedAnnouncement(created);
      setHistory((current) => [created, ...current]);
      setNotice("Announcement saved successfully. Review the recipients below to open WhatsApp.");
      setComposerOpen(false);
      setPreviewOpen(false);
      setTitle("");
      setMessage("");
      setAudienceType("all");
      setSelectedGroupIds([]);
    } catch (err) {
      setError(err.message || "Unable to save the announcement.");
    } finally {
      setSaving(false);
    }
  }

  function recipientsForAnnouncement(announcement) {
    if (!announcement) return [];
    if (announcement.audience_type === "all") return recipients;

    const ids = new Set(announcement.audience_group_ids ?? []);
    return recipients.filter((person) =>
      (person.groups ?? []).some((group) => ids.has(group.id)),
    );
  }

  async function openWhatsAppForAnnouncement(announcement) {
    setSelectedAnnouncement(announcement);
    setError("");
    setNotice("");

    try {
      await markAnnouncementOpened(announcement.id);
      setNotice("WhatsApp links are ready below. Open each recipient to review and send the message.");
    } catch (err) {
      setError(err.message || "Could not update announcement status.");
    }
  }

  const savedAudience = recipientsForAnnouncement(selectedAnnouncement);
  const selectedAudienceCount = savedAudience.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1e1e1e]">Announcements</h2>
          <p className="mt-1 text-sm text-[#777985]">
            Compose a message and choose which church members should receive it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setNotice("");
            setComposerOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e1e1e] px-4 py-3 text-sm font-semibold text-white hover:bg-black"
        >
          <Plus size={17} /> New Announcement
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</p>}

      {selectedAnnouncement && (
        <section className="overflow-hidden rounded-2xl border border-[#dfece3] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#e8f0e9] bg-[#f5fbf6] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#378454]">WhatsApp recipients</p>
              <h3 className="mt-1 font-bold text-[#22232a]">{selectedAnnouncement.title}</h3>
              <p className="mt-1 text-sm text-[#737681]">
                {selectedAudienceCount} recipients · {savedAudience.filter((p) => p.whatsapp_phone).length} with phone numbers
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAnnouncement(null)}
              className="self-start rounded-lg border border-[#dce8de] p-2 text-[#666873] hover:bg-white"
              aria-label="Close WhatsApp recipients"
            >
              <X size={16} />
            </button>
          </div>

          <div className="divide-y divide-[#f0f0f2]">
            {savedAudience.length === 0 ? (
              <p className="p-5 text-sm text-[#858792]">No members match this audience.</p>
            ) : savedAudience.map((person) => (
              <div key={person.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#303139]">{person.name}</p>
                  <p className="mt-1 text-xs text-[#858792]">
                    Membership No. {person.membership_number || "—"} · {person.phone_number || "No phone recorded"}
                  </p>
                </div>
                <WhatsAppLink
                  recipient={person}
                  message={`${selectedAnnouncement.message}`}
                >
                  Open WhatsApp
                </WhatsAppLink>
              </div>
            ))}
          </div>
          <p className="border-t border-[#ededf0] px-5 py-3 text-xs text-[#858792]">
            WhatsApp opens one conversation at a time. Review and press Send in WhatsApp for each person.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e8e8eb] bg-white">
        <div className="flex items-center gap-3 border-b border-[#ededf0] px-5 py-4">
          <div className="rounded-xl bg-[#f2f2f4] p-2 text-[#4e5059]"><BellRing size={18} /></div>
          <div>
            <h3 className="font-bold text-[#292a31]">Message History</h3>
            <p className="mt-0.5 text-xs text-[#858792]">Previously saved announcements</p>
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-[#858792]">Loading announcements…</p>
        ) : history.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#858792]">No announcements saved yet.</p>
        ) : (
          <div className="divide-y divide-[#f0f0f2]">
            {history.map((item) => {
              const count = recipientsForAnnouncement(item).length;

              return (
                <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#292a31]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-[#777985]">{item.message}</p>
                    <p className="mt-2 text-xs text-[#9698a0]">
                      {formatDate(item.created_at)} · {item.audience_type === "all" ? "All active members" : "Selected groups"} · {count} recipients
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openWhatsAppForAnnouncement(item)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#e2e2e6] px-3.5 py-2.5 text-sm font-semibold hover:bg-[#f8f8f9]"
                  >
                    <Send size={15} /> Open recipients
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {composerOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/45 p-3 pt-5 backdrop-blur-[2px] sm:p-6">
          <section className="my-auto flex max-h-[94vh] w-full max-w-[700px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[#ededf0] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#1e1e1e]">Compose Announcement</h2>
                <p className="mt-1 text-xs text-[#858792]">Choose the message and target audience.</p>
              </div>
              <button type="button" onClick={resetComposer} className="rounded-lg p-2 text-[#686a74] hover:bg-[#f2f2f4]" aria-label="Close composer">
                <X size={18} />
              </button>
            </header>

            <div className="space-y-5 overflow-y-auto p-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#686a74]">Announcement Title</span>
                <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sunday Service Reminder" maxLength={180} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#686a74]">Message</span>
                <textarea className={`${inputClass} min-h-[160px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={"Dear Church Family,\n\nWrite your announcement here..."} />
              </label>

              <div className="space-y-3">
                <span className="text-sm font-semibold text-[#686a74]">Audience</span>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5e5e7] p-3.5 hover:bg-[#fafafa]">
                  <input type="radio" name="audience" checked={audienceType === "all"} onChange={() => setAudienceType("all")} className="mt-1 accent-[#1e1e1e]" />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-[#363740]">All active church members</span>
                    <span className="mt-1 block text-xs text-[#858792]">{recipients.length} members in the directory</span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5e5e7] p-3.5 hover:bg-[#fafafa]">
                  <input type="radio" name="audience" checked={audienceType === "groups"} onChange={() => setAudienceType("groups")} className="mt-1 accent-[#1e1e1e]" />
                  <span>
                    <span className="block text-sm font-semibold text-[#363740]">Selected fellowships / groups</span>
                    <span className="mt-1 block text-xs text-[#858792]">Choose one or more groups below.</span>
                  </span>
                </label>

                {audienceType === "groups" && (
                  <div className="max-h-[220px] overflow-y-auto rounded-xl border border-[#e5e5e7]">
                    {groups.length === 0 ? (
                      <p className="p-4 text-sm text-[#858792]">No active groups are available.</p>
                    ) : groups.map((group) => {
                      const count = recipients.filter((person) =>
                        (person.groups ?? []).some((item) => item.id === group.id),
                      ).length;

                      return (
                        <label key={group.id} className="flex cursor-pointer items-center gap-3 border-b border-[#f0f0f2] px-4 py-3 last:border-0 hover:bg-[#fafafa]">
                          <input type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={() => toggleGroup(group.id)} className="h-4 w-4 accent-[#1e1e1e]" />
                          <span className="min-w-0 flex-1 text-sm font-medium text-[#3c3d45]">{group.name}</span>
                          <span className="text-xs text-[#92949c]">{count} members</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-[#f6f6f7] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#4c4e57]"><Users size={16} /> Recipients</span>
                  <span className="text-sm font-bold text-[#1e1e1e]">{targetedRecipients.length} unique members</span>
                </div>
                <p className="mt-1 text-xs text-[#858792]">
                  {recipientsWithPhone.length} members have a phone number available for WhatsApp.
                </p>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#ededf0] px-5 py-4">
              <button type="button" onClick={resetComposer} className="rounded-xl border border-[#e3e3e7] px-4 py-2.5 text-sm font-semibold hover:bg-[#f8f8f9]">Cancel</button>
              <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#e3e3e7] px-4 py-2.5 text-sm font-semibold hover:bg-[#f8f8f9]"><Eye size={15} /> Preview</button>
              <button type="button" disabled={saving} onClick={saveAnnouncement} className="inline-flex items-center gap-2 rounded-xl bg-[#1e1e1e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
                <Send size={15} /> {saving ? "Saving..." : "Save Announcement"}
              </button>
            </footer>

            {previewOpen && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
                <section className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <header className="flex items-center justify-between border-b border-[#ededf0] px-5 py-4">
                    <h3 className="font-bold">Announcement Preview</h3>
                    <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-lg p-2 hover:bg-[#f2f2f4]}">
                      <X size={17} />
                    </button>
                  </header>
                  <div className="space-y-3 p-5">
                    <h4 className="text-base font-bold">{title || "Untitled announcement"}</h4>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[#555762]">{message || "Your message will appear here."}</p>
                    <p className="text-xs text-[#858792]">{targetedRecipients.length} unique recipients selected</p>
                  </div>
                  <footer className="flex justify-end border-t border-[#ededf0] p-4">
                    <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-xl bg-[#1e1e1e] px-4 py-2.5 text-sm font-semibold text-white">Back to editing</button>
                  </footer>
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
