// ABOUTME: The /team page: the care team as cards with Call, Email and an assistant question, and
// ABOUTME: the daily medications and supplements, edited in place with Undo; dialogs add new ones.
import { useState } from "react";
import { Plus } from "lucide-react";
import { MascotLoader } from "@/components/MascotLoader";
import { CareTeamDialog } from "@/components/dashboard/CareTeamDialog";
import { MedicationDialog } from "@/components/dashboard/MedicationDialog";
import { Page } from "@/components/shell/Page";
import {
  useCareTeam,
  saveCareTeamMember,
  deleteCareTeamMember,
  type CareTeamMember,
} from "@/hooks/useCareTeam";
import {
  useMedications,
  saveMedication,
  deleteMedication,
  type MedicationItem,
} from "@/hooks/useMedications";
import { useUndoableSave } from "@/hooks/useUndoableSave";
import { useAppSession } from "@/lib/appSession";
import { mainContactId } from "./contact";
import { MedicationsList } from "./MedicationsList";
import { MemberCard } from "./MemberCard";

const ADD_BUTTON =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-sm font-medium text-paper transition-colors duration-200 ease-out hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function SectionHeader({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="font-display text-3xl text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function TeamPage() {
  const { password } = useAppSession();
  const { items: careTeam, loading: teamLoading, refresh: refreshTeam } = useCareTeam();
  const { items: medications, loading: medsLoading, refresh: refreshMeds } = useMedications();

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [medsDialogOpen, setMedsDialogOpen] = useState(false);

  // Saving the whole row back is also how an edit is undone.
  const writeMember = async (member: CareTeamMember) => {
    const saved = await saveCareTeamMember(password, member);
    await refreshTeam();
    return saved;
  };
  const saveMember = useUndoableSave(writeMember, writeMember);
  const writeMedication = async (item: MedicationItem) => {
    const saved = await saveMedication(password, item);
    await refreshMeds();
    return saved;
  };
  const saveMed = useUndoableSave(writeMedication, writeMedication);

  const mainContact = mainContactId(careTeam);

  return (
    <Page title="Team" description="Who is on the care team, and what is taken every day." wide>
      <div className="space-y-10">
        <section aria-labelledby="care-team-heading">
          <SectionHeader
            id="care-team-heading"
            title="Care team"
            action={
              <button type="button" onClick={() => setTeamDialogOpen(true)} className={ADD_BUTTON}>
                <Plus size={16} aria-hidden />
                Add member
              </button>
            }
          />
          {teamLoading ? (
            <MascotLoader label="Loading care team…" />
          ) : careTeam.length === 0 ? (
            <p className="rounded-[20px] border border-line bg-surface p-5 text-sm text-muted">
              No one is on the care team yet. Add the doctors and nurses who look after the patient.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {careTeam.map((m) => (
                <li key={m.id}>
                  <MemberCard
                    member={m}
                    mainContact={m.id === mainContact}
                    onSave={saveMember}
                    onDelete={async (member) => {
                      await deleteCareTeamMember(password, member.id);
                      await refreshTeam();
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="medications-heading">
          <SectionHeader
            id="medications-heading"
            title="Medications & supplements"
            action={
              <button type="button" onClick={() => setMedsDialogOpen(true)} className={ADD_BUTTON}>
                <Plus size={16} aria-hidden />
                Add medication
              </button>
            }
          />
          {medsLoading ? (
            <MascotLoader label="Loading medications…" />
          ) : (
            <MedicationsList
              medications={medications}
              onSave={saveMed}
              onDelete={async (item) => {
                await deleteMedication(password, item.id);
                await refreshMeds();
              }}
            />
          )}
        </section>
      </div>

      <CareTeamDialog
        open={teamDialogOpen}
        onClose={() => setTeamDialogOpen(false)}
        onSave={async (item) => {
          await saveCareTeamMember(password, item);
          await refreshTeam();
        }}
      />
      <MedicationDialog
        open={medsDialogOpen}
        onClose={() => setMedsDialogOpen(false)}
        onSave={async (item) => {
          await saveMedication(password, item);
          await refreshMeds();
        }}
      />
    </Page>
  );
}
