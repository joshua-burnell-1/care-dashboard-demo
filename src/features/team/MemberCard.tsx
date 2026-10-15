// ABOUTME: One care team member as a card: role, name, institution and note, then Call, Email and
// ABOUTME: a quiet "Ask about their role" action, with a chip on the family's main contact.
import { Mail, Pencil, Phone, Sparkles } from "lucide-react";
import { openAssistant } from "@/components/assistant/assistantStore";
import type { CareTeamMember } from "@/hooks/useCareTeam";
import { mailHref, telHref } from "./contact";

const ACTION =
  "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const OUTLINED = `${ACTION} border border-line bg-surface text-ink hover:bg-secondary`;
const GHOST = `${ACTION} text-muted hover:bg-secondary hover:text-ink`;

export function MemberCard({
  member,
  mainContact,
  onEdit,
}: {
  member: CareTeamMember;
  mainContact: boolean;
  onEdit: (member: CareTeamMember) => void;
}) {
  const tel = telHref(member.phone);
  const mail = mailHref(member.email);
  return (
    <article
      data-member={member.name}
      className={`flex h-full flex-col rounded-[20px] border bg-surface p-5 ${
        mainContact ? "border-ink/25" : "border-line"
      }`}
    >
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
        <button
          type="button"
          onClick={() => onEdit(member)}
          aria-label={`Edit ${member.name}`}
          className="-mt-1.5 -mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors duration-200 ease-out hover:bg-secondary hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Pencil size={14} aria-hidden />
        </button>
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
    </article>
  );
}
