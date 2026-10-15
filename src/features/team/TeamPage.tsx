// ABOUTME: The /team content until Task 7: the care team (editable in Edit mode) and the daily
// ABOUTME: medications and supplements, with the care-team and medication dialogs.
import { useState } from "react";
import { Pencil } from "lucide-react";
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
import { useAppSession } from "@/lib/appSession";
import { Card, EditModeButton, H2 } from "@/features/shared/SectionUi";
import { MedicationsCard } from "./MedicationsCard";

export function TeamPage() {
  const { password, editMode, setEditMode } = useAppSession();
  const { items: careTeam, loading: teamLoading, refresh: refreshTeam } = useCareTeam();
  const { items: medications, loading: medsLoading, refresh: refreshMeds } = useMedications();

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamEditing, setTeamEditing] = useState<CareTeamMember | null>(null);
  const [medsDialogOpen, setMedsDialogOpen] = useState(false);
  const [medsEditing, setMedsEditing] = useState<MedicationItem | null>(null);

  function editMember(member: CareTeamMember | null) {
    setTeamEditing(member);
    setTeamDialogOpen(true);
  }

  return (
    <Page
      title="Team"
      actions={<EditModeButton editMode={editMode} onToggle={() => setEditMode((e) => !e)} />}
    >
      <section className="space-y-4">
        <H2>Care team</H2>
        {teamLoading ? (
          <MascotLoader label="Loading care team…" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {careTeam.map((m) => (
              <Card key={m.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-stone-500">{m.role}</p>
                    <p className="font-semibold text-stone-900 mt-1">{m.name}</p>
                    <p className="text-sm text-stone-600">{m.where_based}</p>
                    <p className="text-xs text-stone-400 mt-1">{m.note}</p>
                  </div>
                  {editMode && (
                    <button
                      onClick={() => editMember(m)}
                      className="shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                      aria-label={`Edit ${m.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </Card>
            ))}
            {editMode && (
              <button
                onClick={() => editMember(null)}
                className="rounded-2xl p-5 border border-dashed border-stone-300 text-stone-400 hover:text-stone-600 hover:border-stone-400 text-sm transition flex items-center justify-center gap-1"
              >
                + Add member
              </button>
            )}
          </div>
        )}

        <H2>Medications & supplements</H2>
        {medsLoading ? (
          <MascotLoader label="Loading medications…" />
        ) : (
          <MedicationsCard
            medications={medications}
            onEdit={(m) => {
              setMedsEditing(m);
              setMedsDialogOpen(true);
            }}
          />
        )}
      </section>

      <CareTeamDialog
        open={teamDialogOpen}
        initial={teamEditing}
        onClose={() => setTeamDialogOpen(false)}
        onSave={async (item) => {
          await saveCareTeamMember(password, item);
          await refreshTeam();
        }}
        onDelete={async (id) => {
          await deleteCareTeamMember(password, id);
          await refreshTeam();
        }}
      />
      <MedicationDialog
        open={medsDialogOpen}
        initial={medsEditing}
        onClose={() => setMedsDialogOpen(false)}
        onSave={async (item) => {
          await saveMedication(password, item);
          await refreshMeds();
        }}
        onDelete={async (id) => {
          await deleteMedication(password, id);
          await refreshMeds();
        }}
      />
    </Page>
  );
}
