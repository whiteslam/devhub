"use client";

import { Card, CardBody, CardHeader, Checkbox, Field, Input } from "@devhub/ui";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { ProjectFields } from "@/components/project-fields";
import { SlugFields } from "@/components/slug-fields";
import { SubmitButton } from "@/components/submit-button";
import { idle } from "@/server/action-state";
import { createProject } from "@/server/actions/projects";

const ENVIRONMENTS = [
  { id: "production", label: "Production", locked: true, checked: true },
  { id: "staging", label: "Staging", locked: false, checked: true },
  { id: "development", label: "Development", locked: false, checked: true },
  { id: "preview", label: "Preview (per-branch deploys)", locked: false, checked: false },
];

export function NewProjectForm({ orgSlug }: { orgSlug: string }) {
  const [state, action] = useActionState(createProject, idle);
  const errors = state.fieldErrors;

  return (
    <form action={action} className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Identity"
          description="Shown across the dashboard. The slug is permanent and used in URLs and SDK configuration."
        />
        <CardBody className="flex flex-col gap-4">
          <SlugFields nameLabel="Project name" namePlaceholder="Storefront" errors={errors} slugPrefix={`${orgSlug}/`} />
          <ProjectFields errors={errors} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Environments"
          description="Each environment gets its own credentials, telemetry and health. Production is required."
        />
        <CardBody>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Environments</legend>
            {ENVIRONMENTS.map((env) =>
              env.locked ? (
                <div key={env.id}>
                  <input type="hidden" name="environments" value={env.id} />
                  <Checkbox label={`${env.label} (required)`} checked disabled readOnly />
                </div>
              ) : (
                <Checkbox key={env.id} name="environments" value={env.id} label={env.label} defaultChecked={env.checked} />
              ),
            )}
          </fieldset>
          {errors?.environments ? <p className="mt-2 text-xs text-bad">{errors.environments}</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Monitoring" description="Defaults for this project. Detailed alert rules arrive with Phase 3." />
        <CardBody className="flex flex-col gap-4">
          <Checkbox name="uptimeEnabled" label="Enable uptime checks for the production URL" defaultChecked />
          <Checkbox name="errorAlertsEnabled" label="Alert on new and regressed errors" defaultChecked />
          <Field
            label="Mark telemetry stale after (minutes)"
            htmlFor="staleAfterMinutes"
            error={errors?.["monitoring.staleAfterMinutes"]}
            hint="If no events arrive for this long, health becomes “Stale” instead of staying green."
            className="max-w-xs"
          >
            <Input id="staleAfterMinutes" name="staleAfterMinutes" type="number" min={5} max={10080} defaultValue={60} />
          </Field>
        </CardBody>
      </Card>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Registering…">Register project</SubmitButton>
      </div>
    </form>
  );
}
