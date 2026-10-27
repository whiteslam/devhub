"use client";

import type { ProjectRow } from "@devhub/database";
import { Card, CardBody, CardHeader, Field, Input } from "@devhub/ui";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { ProjectFields } from "@/components/project-fields";
import { SubmitButton } from "@/components/submit-button";
import { idle } from "@/server/action-state";
import { archiveProject, updateProject } from "@/server/actions/projects";

export function ProjectSettingsForm({ project, canEdit }: { project: ProjectRow; canEdit: boolean }) {
  const [state, action] = useActionState(updateProject, idle);
  return (
    <Card>
      <CardHeader
        title="Configuration"
        description={canEdit ? "Changes are recorded in the audit log." : "Read-only: editing requires the admin role."}
      />
      <CardBody>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={project.id} />
          <fieldset disabled={!canEdit} className="flex flex-col gap-4 disabled:opacity-70">
            <Field label="Project name" htmlFor="name" error={state.fieldErrors?.name}>
              <Input id="name" name="name" defaultValue={project.name} required minLength={2} maxLength={80} />
            </Field>
            <ProjectFields errors={state.fieldErrors} project={project} />
          </fieldset>
          <FormMessage state={state} />
          {canEdit ? (
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

export function ArchiveProjectForm({ project, mfaBlocked }: { project: ProjectRow; mfaBlocked: boolean }) {
  const [state, action] = useActionState(archiveProject, idle);
  const [confirm, setConfirm] = useState("");
  return (
    <Card className="border-bad/30">
      <CardHeader title="Archive project" description="Stops monitoring and hides the project. History and audit records are kept." />
      <CardBody>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={project.id} />
          {mfaBlocked ? (
            <p className="text-[13px] text-warn">
              This organization requires two-factor verification for destructive actions. Verify first.
            </p>
          ) : null}
          <Field label={`Type ${project.slug} to confirm`} htmlFor="confirmSlug">
            <Input
              id="confirmSlug"
              name="confirmSlug"
              autoComplete="off"
              spellCheck={false}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="max-w-sm font-mono text-[13px]"
            />
          </Field>
          <FormMessage state={state} />
          <div>
            <SubmitButton variant="danger" disabled={confirm !== project.slug || mfaBlocked} pendingLabel="Archiving…">
              Archive {project.name}
            </SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
