import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  GitBranch,
  Heart,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react'

import {
  changeMembershipHead,
  getMembershipDetails,
  recordMemberRelationship,
} from '../../services/membershipService'

import AddMemberModal from './AddMemberModal'
import EditMembershipModal from './EditMembershipModal'

function formatDate(value) {
  if (!value) return 'Not recorded'

  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
}

function StatusBadge({ status }) {
  const styles = {
    Active: 'bg-[#e5f6ec] text-[#18794e]',
    Inactive: 'bg-[#eeeeef] text-[#53555e]',
    Deceased: 'bg-[#fbe9e6] text-[#aa382d]',
    Transferred: 'bg-[#fbf1dc] text-[#8a6108]',
    Closed: 'bg-[#fbe9e6] text-[#aa382d]',
    'Left Church': 'bg-[#fbf1dc] text-[#8a6108]',
    Removed: 'bg-[#fbe9e6] text-[#aa382d]',
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
        styles[status] || 'bg-[#eeeeef] text-[#53555e]'
      }`}
    >
      {status || 'Unknown'}
    </span>
  )
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#ececed] bg-white shadow-[0_1px_2px_rgba(15,15,20,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f2f2f3] px-5 py-4">
        <div>
          <h2 className="text-[14px] font-extrabold text-[#131418]">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-[11.5px] leading-5 text-[#888a93]">
              {subtitle}
            </p>
          )}
        </div>

        {action}
      </header>

      <div className="p-5">{children}</div>
    </section>
  )
}

function DetailField({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-medium text-[#92939b]">
        {label}
      </p>

      <p className="mt-1 break-words text-[12px] font-medium text-[#2b2d34]">
        {value === null || value === undefined || value === ''
          ? 'Not recorded'
          : value}
      </p>
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  primary = false,
  type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] border px-4 py-2.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? 'border-[#191a1f] bg-[#191a1f] text-white hover:bg-black'
          : 'border-[#e5e5e7] bg-white text-[#53555e] hover:bg-[#f7f7f8]'
      }`}
    >
      {children}
    </button>
  )
}


function PersonCard({ member, membershipRowId }) {
  const navigate = useNavigate()

  function openMember() {
    navigate(`/members/${member.id}`, {
      state: {
        returnTo: `/memberships/${membershipRowId}`,
      },
    })
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={openMember}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openMember()
        }
      }}
      className="cursor-pointer rounded-xl border border-[#ececed] bg-white p-4 transition hover:border-[#d9dce6] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3457d5]"
    >

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eeeeef] text-[#53555e]">
          <UserRound size={19} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-[13px] font-bold text-[#131418]">
              {member.name || 'Unnamed member'}
            </h3>

            {member.is_head && (
              <span className="rounded-full bg-[#e9edfd] px-2 py-0.5 text-[10px] font-semibold text-[#3457d5]">
                Head of membership
              </span>
            )}
          </div>

          <p className="mt-1 font-mono text-[10px] text-[#92939b]">
            Person ID: {member.person_id || 'Not assigned'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={member.status} />

            <span className="rounded-full bg-[#f2f2f3] px-2.5 py-1 text-[10.5px] font-medium text-[#53555e]">
              {member.marital_status || 'Unknown marital status'}
            </span>

            {member.relationship_to_head && (
              <span className="rounded-full bg-[#f2f2f3] px-2.5 py-1 text-[10.5px] font-medium text-[#53555e]">
                {member.relationship_to_head}
              </span>
            )}

            {member.branch_suffix && (
              <span className="rounded-full bg-[#f1f3ff] px-2.5 py-1 text-[10px] font-semibold text-[#536bd6]">
                Branch {member.branch_suffix}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 border-t border-[#f2f2f3] pt-4 sm:grid-cols-2">
        <DetailField label="Gender" value={member.gender} />
        <DetailField
          label="Date of birth"
          value={formatDate(member.date_of_birth)}
        />
        <DetailField
          label="Baptism status"
          value={member.baptism_status}
        />
        <DetailField
          label="Date of baptism"
          value={formatDate(member.date_of_baptism)}
        />
        <DetailField
          label="Occupation / studying"
          value={member.occupation_or_studying}
        />
        <DetailField
          label="Personal phone"
          value={member.phone_number}
        />
        <DetailField label="Personal email" value={member.email} />
        <DetailField label="Spouse" value={member.spouse_name} />
        <DetailField
          label="Wedding date"
          value={formatDate(member.date_of_marriage)}
        />
      </div>

      {member.groups?.length > 0 && (
        <div className="mt-4 border-t border-[#f2f2f3] pt-3">
          <p className="text-[10.5px] font-medium text-[#92939b]">
            Church groups
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {member.groups.map((group, index) => (
              <span
                key={
                  group.assignment_id ||
                  group.id ||
                  `${group.name}-${index}`
                }
                className="rounded-full bg-[#f1f3ff] px-2.5 py-1 text-[10px] font-semibold text-[#536bd6]"
              >
                {group.name || 'Unnamed group'}
                {group.role ? ` · ${group.role}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function Dialog({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className="my-auto w-full max-w-lg rounded-2xl border border-[#ececed] bg-white p-5 shadow-2xl sm:p-6"
      >
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold text-[#131418]">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#ececed] p-2 text-[#53555e] hover:bg-[#f4f4f5]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {children}
      </section>
    </div>
  )
}

export default function MembershipDetailsPage() {
  const { membershipRowId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const branchId = searchParams.get('branchId')

  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [editMembershipOpen, setEditMembershipOpen] = useState(false)

  const [relationshipOpen, setRelationshipOpen] = useState(false)
  const [savingRelationship, setSavingRelationship] = useState(false)
  const [relationshipError, setRelationshipError] = useState('')

  const [changeHeadOpen, setChangeHeadOpen] = useState(false)
  const [savingHeadChange, setSavingHeadChange] = useState(false)
  const [headChangeError, setHeadChangeError] = useState('')

  const [relationshipForm, setRelationshipForm] = useState({
    member_id: '',
    related_member_id: '',
    relationship_type: 'Spouse',
    date_of_marriage: '',
    notes: '',
  })

  const [newHeadId, setNewHeadId] = useState('')
  const [headReason, setHeadReason] = useState('')

  const loadDetails = useCallback(async () => {
    if (!membershipRowId) {
      setError('Membership record ID is missing.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await getMembershipDetails(
        membershipRowId,
        branchId,
      )

      setDetails(result)
    } catch (err) {
      setError(err.message || 'Unable to load this membership.')
    } finally {
      setLoading(false)
    }
  }, [membershipRowId, branchId])

  useEffect(() => {
    loadDetails()
  }, [loadDetails])

  const membership = details?.membership
  const isBranchView = Boolean(details?.isBranchView)
  const selectedBranch = details?.selectedBranch || null
  const head = details?.head || null
  const members = details?.members || []
  const branches = details?.branches || []
  const relationships = details?.relationships || []

  const allMembers = members.length
    ? members
    : head
      ? [{ ...head, is_head: true, branch_id: null }]
      : []

  const branchDisplayNumber =
    `${membership?.membership_number || '—'}${selectedBranch?.suffix || ''}`

  const address = [
    membership?.door_number,
    membership?.street_name,
    membership?.area,
    membership?.city,
    membership?.pincode,
  ]
    .filter(Boolean)
    .join(', ')

  const eligibleHeads = useMemo(
    () =>
      allMembers.filter(
        (member) =>
          !member.branch_id &&
          member.id !== membership?.head_member_id,
      ),
    [allMembers, membership?.head_member_id],
  )

  async function handleSaveRelationship(event) {
    event.preventDefault()
    setRelationshipError('')

    if (
      !relationshipForm.member_id ||
      !relationshipForm.related_member_id
    ) {
      setRelationshipError('Select both people.')
      return
    }

    if (
      relationshipForm.member_id ===
      relationshipForm.related_member_id
    ) {
      setRelationshipError('Choose two different people.')
      return
    }

    if (
      relationshipForm.relationship_type === 'Spouse' &&
      !relationshipForm.date_of_marriage
    ) {
      setRelationshipError('Enter the wedding date.')
      return
    }

    setSavingRelationship(true)

    try {
      await recordMemberRelationship({
        memberId: relationshipForm.member_id,
        relatedMemberId: relationshipForm.related_member_id,
        relationshipType: relationshipForm.relationship_type,
        dateOfMarriage: relationshipForm.date_of_marriage || null,
        notes: relationshipForm.notes.trim() || null,
      })

      setRelationshipOpen(false)
      setRelationshipForm({
        member_id: '',
        related_member_id: '',
        relationship_type: 'Spouse',
        date_of_marriage: '',
        notes: '',
      })

      await loadDetails()
    } catch (err) {
      setRelationshipError(
        err.message || 'Could not save relationship.',
      )
    } finally {
      setSavingRelationship(false)
    }
  }

  async function handleChangeHead(event) {
    event.preventDefault()
    setHeadChangeError('')

    if (!newHeadId) {
      setHeadChangeError('Select the new head.')
      return
    }

    setSavingHeadChange(true)

    try {
      await changeMembershipHead({
        membershipRowId,
        newHeadMemberId: newHeadId,
        reason: headReason.trim() || null,
      })

      setChangeHeadOpen(false)
      setNewHeadId('')
      setHeadReason('')
      await loadDetails()
    } catch (err) {
      setHeadChangeError(
        err.message || 'Could not change membership head.',
      )
    } finally {
      setSavingHeadChange(false)
    }
  }

  if (loading && !details) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center text-sm text-[#777984]">
        <RefreshCw className="mr-2 animate-spin" size={16} />
        Loading membership profile...
      </div>
    )
  }

  if (error && !details) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6">
        <h1 className="text-lg font-bold text-[#131418]">
          Could not open membership
        </h1>

        <p className="mt-2 text-sm text-red-700">{error}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton onClick={() => navigate('/')}>
            <ArrowLeft size={15} />
            Back to memberships
          </ActionButton>

          <ActionButton onClick={loadDetails}>
            <RefreshCw size={15} />
            Retry
          </ActionButton>
        </div>
      </div>
    )
  }

  if (!details || !membership) return null

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <button
        type="button"
        onClick={() => {
            if (!isBranchView) {
            navigate('/')
            return
            }

            if (location.state?.from === 'membership-details') {
            navigate(location.state.parentPath)
            return
            }

            navigate('/')
        }}
        className="mb-5 inline-flex items-center gap-2 text-[12px] font-semibold text-[#6b6d76] hover:text-[#131418]"
        >
        <ArrowLeft size={15} />

        {isBranchView &&
        location.state?.from === 'membership-details'
            ? 'Back to parent membership'
            : isBranchView
            ? 'Back to memberships'
            : 'Back to memberships'}
        </button>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[27px] font-extrabold tracking-[-0.8px] text-[#131418] sm:text-[34px]">
              {isBranchView
                ? selectedBranch?.branch_name ||
                  `Branch ${selectedBranch?.suffix || ''}`
                : head?.name || 'Membership profile'}
            </h1>

            <StatusBadge status={membership.membership_status} />
          </div>

          <p className="mt-2 text-[13px] text-[#777984]">
            {isBranchView
              ? 'Branch number: '
              : 'Membership number: '}

            <span className="font-semibold text-[#131418]">
              {isBranchView
                ? branchDisplayNumber
                : membership.membership_number || 'Not assigned'}
            </span>

            {' · '}

            {isBranchView ? 'Branch head: ' : 'Permanent ID: '}

            <span className="font-mono text-[#131418]">
              {isBranchView
                ? head?.name || 'Branch head not recorded'
                : membership.membership_id || 'Not assigned'}
            </span>
          </p>

          {isBranchView && (
            <p className="mt-2 text-xs text-[#777984]">
              This is a branch of the parent membership. The permanent
              membership ID does not change.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={loadDetails} disabled={loading}>
            <RefreshCw size={15} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </ActionButton>

          {!isBranchView && (
            <>
              <ActionButton
                primary
                onClick={() => setEditMembershipOpen(true)}
              >
                <Pencil size={15} />
                Edit membership
              </ActionButton>

              <ActionButton
                onClick={() => {
                  setHeadChangeError('')
                  setChangeHeadOpen(true)
                }}
              >
                <UserCog size={15} />
                Change head
              </ActionButton>

              <ActionButton onClick={() => setAddMemberOpen(true)}>
                <Plus size={15} />
                Add member
              </ActionButton>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div className="space-y-5">
          <Panel
            title={
              isBranchView
                ? `Branch members (${allMembers.length})`
                : `Members (${allMembers.length})`
            }
            subtitle={
              isBranchView
                ? 'Only people assigned to this branch are shown.'
                : 'Saved personal details, marital status and relationships'
            }
            action={
              !isBranchView && (
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#191a1f] px-3 py-2 text-[11px] font-semibold text-white hover:bg-black"
                >
                  <Plus size={13} />
                  Add member
                </button>
              )
            }
          >
            {allMembers.length === 0 ? (
              <p className="text-[12px] text-[#92939b]">
                {isBranchView
                  ? 'No members are assigned to this branch.'
                  : 'No member assignments were found.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                {allMembers.map((member) => (
                  <PersonCard
                    key={member.id}
                    member={member}
                    membershipRowId={membershipRowId}
                  />
                ))}
              </div>
            )}
          </Panel>

          {!isBranchView && (
            <Panel
              title="Membership branches"
              subtitle="Select a branch to view its assigned members and branch head."
              action={
                <GitBranch
                  size={17}
                  className="text-[#777984]"
                />
              }
            >
              {branches.length === 0 ? (
                <p className="text-[12px] text-[#92939b]">
                  No active branches recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() =>
                        navigate(
                            `/memberships/${membershipRowId}?branchId=${encodeURIComponent(branch.id)}`,
                            {
                            state: {
                                from: 'membership-details',
                                parentPath: `/memberships/${membershipRowId}`,
                            },
                            },
                        )
                        }
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#ececed] p-3 text-left transition hover:border-[#c8cbd2] hover:bg-[#fafafa]"
                    >
                      <div>
                        <p className="text-[13px] font-semibold text-[#131418]">
                          {membership.membership_number || '—'}
                          {branch.suffix}
                        </p>

                        <p className="mt-1 text-[11px] text-[#777984]">
                          {branch.members?.length ?? 0} assigned member(s)
                        </p>

                        {branch.members?.length > 0 && (
                          <p className="mt-1 text-[11px] text-[#777984]">
                            {branch.members
                              .map((member) => member.name)
                              .join(', ')}
                          </p>
                        )}
                      </div>

                      <span className="flex items-center gap-2">
                        <StatusBadge status={branch.branch_status} />
                        <ChevronRight
                          size={16}
                          className="text-[#777984]"
                        />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          )}

          <Panel
            title="Relationships"
            subtitle="People linked by a recorded relationship"
            action={
              !isBranchView && (
                <button
                  type="button"
                  onClick={() => {
                    setRelationshipError('')
                    setRelationshipOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e7] px-3 py-2 text-[11px] font-semibold text-[#53555e] hover:bg-[#f7f7f8]"
                >
                  <Heart size={13} />
                  Add relationship
                </button>
              )
            }
          >
            {relationships.length === 0 ? (
              <p className="text-[12px] text-[#92939b]">
                No relationships have been recorded.
              </p>
            ) : (
              <div className="space-y-3">
                {relationships.map((relationship, index) => (
                  <div
                    key={
                      relationship.id ||
                      `${relationship.member_id}-${relationship.related_member_id}-${index}`
                    }
                    className="rounded-xl border border-[#ececed] p-3.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fbeef2] text-[#a54c6a]">
                        <Heart size={15} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[12px] font-bold text-[#131418]">
                          {relationship.member_name}
                        </p>

                        {relationship.member_person_id && (
                          <p className="mt-0.5 font-mono text-[10px] text-[#92939b]">
                            {relationship.member_person_id}
                          </p>
                        )}

                        <span className="my-2 inline-flex rounded-full bg-[#f1f3ff] px-2.5 py-1 text-[10px] font-semibold text-[#536bd6]">
                          {relationship.relationship_type || 'Relationship'}
                        </span>

                        <p className="break-words text-[12px] font-semibold text-[#33353d]">
                          {relationship.related_member_name}
                        </p>

                        {relationship.related_member_person_id && (
                          <p className="mt-0.5 font-mono text-[10px] text-[#92939b]">
                            {relationship.related_member_person_id}
                          </p>
                        )}

                        {relationship.relationship_type === 'Spouse' && (
                          <p className="mt-2 text-[11px] text-[#777984]">
                            Wedding date:{' '}
                            <span className="font-semibold text-[#33353d]">
                              {formatDate(relationship.date_of_marriage)}
                            </span>
                          </p>
                        )}

                        {relationship.notes && (
                          <p className="mt-2 text-[11px] leading-5 text-[#777984]">
                            {relationship.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            title={isBranchView ? 'Branch head' : 'Head of membership'}
            subtitle={
              isBranchView
                ? 'Person assigned as the head of this branch.'
                : 'Personal information saved for the current head.'
            }
          >
            {!head ? (
              <p className="text-[12px] text-[#92939b]">
                {isBranchView
                  ? 'No branch head is recorded. The first assigned branch member is displayed when no explicit head is designated.'
                  : 'No head of membership is assigned.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-1">
                <DetailField label="Full name" value={head.name} />
                <DetailField label="Person ID" value={head.person_id} />
                <DetailField label="Gender" value={head.gender} />
                <DetailField
                  label="Date of birth"
                  value={formatDate(head.date_of_birth)}
                />
                <DetailField
                  label="Marital status"
                  value={head.marital_status}
                />
                <DetailField label="Spouse" value={head.spouse_name} />
                <DetailField
                  label="Wedding date"
                  value={formatDate(head.date_of_marriage)}
                />
                <DetailField
                  label="Baptism status"
                  value={head.baptism_status}
                />
                <DetailField
                  label="Date of baptism"
                  value={formatDate(head.date_of_baptism)}
                />
                <DetailField
                  label="Occupation / studying"
                  value={head.occupation_or_studying}
                />
                <DetailField
                  label="Personal phone"
                  value={head.phone_number}
                />
                <DetailField
                  label="Personal email"
                  value={head.email}
                />
              </div>
            )}
          </Panel>

          <Panel
            title={isBranchView ? 'Parent membership' : 'Membership details'}
            subtitle={
              isBranchView
                ? 'The branch remains linked to its parent membership.'
                : 'Household information and contact details'
            }
            action={
              !isBranchView && (
                <button
                  type="button"
                  onClick={() => setEditMembershipOpen(true)}
                  className="rounded-lg border border-[#e5e5e7] p-2 text-[#53555e] hover:bg-[#f7f7f8]"
                  aria-label="Edit membership"
                >
                  <Pencil size={15} />
                </button>
              )
            }
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-1">
              <DetailField
                label={
                  isBranchView
                    ? 'Parent membership number'
                    : 'Membership number'
                }
                value={membership.membership_number}
              />

              {isBranchView && (
                <DetailField
                  label="Branch number"
                  value={branchDisplayNumber}
                />
              )}

              <DetailField
                label="Permanent membership ID"
                value={membership.membership_id}
              />

              <DetailField
                label="Head of membership"
                value={
                  membership.head_member_id === head?.id
                    ? head?.name
                    : details.head?.name || head?.name
                }
              />

              <DetailField
                label="Year joined"
                value={membership.year_joined}
              />

              <DetailField
                label="Door number"
                value={membership.door_number}
              />

              <DetailField
                label="Street name"
                value={membership.street_name}
              />

              <DetailField label="Area" value={membership.area} />
              <DetailField label="City" value={membership.city} />
              <DetailField label="Pincode" value={membership.pincode} />
              <DetailField label="Landmark" value={membership.landmark} />

              <DetailField
                label="Primary phone"
                value={membership.primary_phone_number}
              />

              <DetailField
                label="Alternate phone"
                value={membership.alternate_phone_number}
              />

              <DetailField
                label="Household email"
                value={membership.email}
              />

              {!isBranchView && (
                <DetailField
                  label="Head photo storage path"
                  value={membership.head_photo_path}
                />
              )}
            </div>

            {address && (
              <div className="mt-5 flex items-start gap-2 border-t border-[#f2f2f3] pt-4 text-[12px] text-[#6b6d76]">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span>
                  {address}
                  {membership.landmark
                    ? ` · Near ${membership.landmark}`
                    : ''}
                </span>
              </div>
            )}

            {isBranchView && (
              <div className="mt-5">
                <ActionButton
                  onClick={() =>
                    navigate(`/memberships/${membershipRowId}`)
                  }
                >
                  <ArrowLeft size={14} />
                  Return to parent membership
                </ActionButton>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {addMemberOpen && !isBranchView && (
        <AddMemberModal
          membership={membership}
          membershipRowId={membership.id}
          branches={branches}
          relationships={relationships}
          onClose={() => setAddMemberOpen(false)}
          onCreated={async () => {
            await loadDetails()
            setAddMemberOpen(false)
          }}
        />
      )}

      {editMembershipOpen && !isBranchView && (
        <EditMembershipModal
          membership={membership}
          onClose={() => setEditMembershipOpen(false)}
          onSaved={async () => {
            await loadDetails()
            setEditMembershipOpen(false)
          }}
        />
      )}

      {changeHeadOpen && !isBranchView && (
        <Dialog
          title="Change head of membership"
          onClose={() => {
            if (!savingHeadChange) setChangeHeadOpen(false)
          }}
        >
          <form onSubmit={handleChangeHead} className="space-y-4">
            <label className="block text-[12px] font-semibold text-[#53555e]">
              New head of membership *

              <select
                required
                value={newHeadId}
                onChange={(event) => setNewHeadId(event.target.value)}
                className="mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px]"
              >
                <option value="">Select a main-household member</option>

                {eligibleHeads.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.person_id}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[12px] font-semibold text-[#53555e]">
              Reason (optional)

              <textarea
                rows={3}
                value={headReason}
                onChange={(event) => setHeadReason(event.target.value)}
                className="mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] px-3 py-2.5 text-[13px]"
              />
            </label>

            {headChangeError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-[12px] text-red-700"
              >
                {headChangeError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <ActionButton
                onClick={() => setChangeHeadOpen(false)}
                disabled={savingHeadChange}
              >
                Cancel
              </ActionButton>

              <ActionButton
                type="submit"
                primary
                disabled={savingHeadChange}
              >
                {savingHeadChange ? 'Saving...' : 'Confirm change'}
              </ActionButton>
            </div>
          </form>
        </Dialog>
      )}

      {relationshipOpen && !isBranchView && (
        <Dialog
          title="Add relationship"
          onClose={() => {
            if (!savingRelationship) setRelationshipOpen(false)
          }}
        >
          <form onSubmit={handleSaveRelationship} className="space-y-4">
            <label className="block text-[12px] font-semibold text-[#53555e]">
              First member *

              <select
                required
                value={relationshipForm.member_id}
                onChange={(event) =>
                  setRelationshipForm((current) => ({
                    ...current,
                    member_id: event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px]"
              >
                <option value="">Select member</option>

                {allMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.person_id}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[12px] font-semibold text-[#53555e]">
              Related member *

              <select
                required
                value={relationshipForm.related_member_id}
                onChange={(event) =>
                  setRelationshipForm((current) => ({
                    ...current,
                    related_member_id: event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px]"
              >
                <option value="">Select member</option>

                {allMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.person_id}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[12px] font-semibold text-[#53555e]">
              Relationship

              <select
                value={relationshipForm.relationship_type}
                onChange={(event) =>
                  setRelationshipForm((current) => ({
                    ...current,
                    relationship_type: event.target.value,
                    date_of_marriage:
                      event.target.value === 'Spouse'
                        ? current.date_of_marriage
                        : '',
                  }))
                }
                className="mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px]"
              >
                {[
                  'Spouse',
                  'Parent',
                  'Child',
                  'Sibling',
                  'Guardian',
                  'Other',
                ].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            {relationshipForm.relationship_type === 'Spouse' && (
              <label className="block text-[12px] font-semibold text-[#53555e]">
                Wedding date *

                <input
                  required
                  type="date"
                  value={relationshipForm.date_of_marriage}
                  onChange={(event) =>
                    setRelationshipForm((current) => ({
                      ...current,
                      date_of_marriage: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px]"
                />
              </label>
            )}

            <label className="block text-[12px] font-semibold text-[#53555e]">
              Notes (optional)

              <textarea
                rows={3}
                value={relationshipForm.notes}
                onChange={(event) =>
                  setRelationshipForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px]"
              />
            </label>

            {relationshipError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-[12px] text-red-700"
              >
                {relationshipError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <ActionButton
                onClick={() => setRelationshipOpen(false)}
                disabled={savingRelationship}
              >
                Cancel
              </ActionButton>

              <ActionButton
                type="submit"
                primary
                disabled={savingRelationship}
              >
                {savingRelationship ? 'Saving...' : 'Save relationship'}
              </ActionButton>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  )
}