// ABOUTME: One care team member as a card: role, name, institution and note, then Call, Email and
// ABOUTME: a quiet "Ask about their role" action, a chip on the main contact, and in-place editing.
import { Mail, Phone, Sparkles } from "lucide-react";
import { openAssistant } from "@/components/assistant/assistantStore";
import { InlineEdit, type InlineField } from "@/components/InlineEdit";
import type { CareTeamMember } from "@/hooks/useCareTeam";
import { mailHref, telHref } from "./contact";

const ACTION =
  "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const OUTLINED = `${ACTION} border border-line bg-surface text-ink hover:bg-secondary`;
const GHOST = `${ACTION} text-muted hover:bg-secondary hover:text-ink`;

const FIELDS: InlineField<CareTeamMember>[] = [
  { name: "name", label: "Name", required: true, maxLength: 200 },
  { name: "role", label: "Role", maxLength: 200 },
  { name: "where_based", label: "Location", maxLength: 200, wide: true },
  { name: "phone", label: "Phone", type: "tel", maxLength: 40 },
  { name: "email", label: "Email", type: "email", maxLength: 200 },
  { name: "note", label: "Notes", type: "textarea", maxLength: 1000 },
];

export function MemberCard({
  member,
  mainContact,
  onSave,
  onDelete,
}: {
  member: CareTeamMember;
  mainContact: boolean;
  /** Saves an edited card; `prev` is what it replaces, for Undo. */
  onSave: (next: CareTeamMember, prev: CareTeamMember) => Promise<void>;
  onDelete: (member: CareTeamMember) => Promise<void>;
}) {
  return (
    <article
      data-member={member.name}
      className={`h-full rounded-[20px] border bg-surface p-5 ${
        mainContact ? "border-ink/25" : "border-line"
      }`}
    >
      <InlineEdit
        value={member}
        fields={FIELDS}
        subject={member.name}
        onSave={onSave}
        onDelete={() => onDelete(member)}
        className="flex h-full flex-col"
      >
        {(shown, pencil) => <MemberView member={shown} mainContact={mainContact} pencil={pencil} />}
      </InlineEdit>
    </article>
  );
}

function MemberView({
  member,
  mainContact,
  pencil,
}: {
  member: CareTeamMember;
  mainContact: boolean;
  pencil: React.ReactNode;
}) {
  const tel = telHref(member.phone);
  const mail = mailHref(member.email);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{member.role}</p>
          {mainContact && (
            <span
              data-main-contact
              className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink"
            >
              Main contact
            </span>
          )}
        </div>
        <div className="-mt-1.5 -mr-2">{pencil}</div>
      </div>
      <h3 className="mt-2 font-display text-2xl leading-tight text-ink">{member.name}</h3>
      {member.where_based && <p className="mt-1 text-sm text-ink">{member.where_based}</p>}
      {member.note && <p className="mt-1 text-sm leading-relaxed text-muted">{member.note}</p>}
      <div className="mt-auto pt-5">
        {(tel || mail) && (
          <div className="flex flex-wrap items-center gap-2">
            {tel && (
              <a href={tel} aria-label={`Call ${member.name}`} className={OUTLINED}>
                <Phone size={14} aria-hidden />
                Call
              </a>
            )}
            {mail && (
              <a href={mail} aria-label={`Email ${member.name}`} className={OUTLINED}>
                <Mail size={14} aria-hidden />
                Email
              </a>
            )}
          </div>
        )}
        <button
          type="button"
          data-assistant-ask
          onClick={() =>
            openAssistant({
              label: member.name,
              prompt: `What does ${member.name} (${member.role}) do on our care team, and when should we reach out to them?`,
            })
          }
          className={`${GHOST} -ml-3 ${tel || mail ? "mt-2" : ""}`}
        >
          <Sparkles size={14} aria-hidden />
          Ask about their role
        </button>
      </div>
    </>
  );
}
