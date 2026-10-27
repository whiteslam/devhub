"use client";

import type { OrganizationRow } from "@devhub/database";
import { Card, CardBody, CardHeader, Checkbox, Field, Input } from "@devhub/ui";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { idle } from "@/server/action-state";
import { renameOrganization, updateOrganizationSecurity } from "@/server/actions/organizations";

export function RenameOrganizationForm({ organization, canEdit }: { organization: OrganizationRow; canEdit: boolean }) {
  const [state, action] = useActionState(renameOrganization, idle);
  return (
    <Card>
      <CardHeader title="General" description={`Slug: ${organization.slug} (permanent)`} />
      <CardBody>
        <form action={action} className="flex flex-col gap-4">
          <fieldset disabled={!canEdit} className="disabled:opacity-70">
            <Field label="Organization name" htmlFor="org-name" error={state.fieldErrors?.name}>
              <Input
                id="org-name"
                name="name"
                defaultValue={organization.name}
                required
                minLength={2}
                maxLength={80}
                className="max-w-md"
              />
            </Field>
          </fieldset>
          <FormMessage state={state} />
          {canEdit ? (
            <div>
              <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

export function OrganizationSecurityForm({ organization, isOwner }: { organization: OrganizationRow; isOwner: boolean }) {
  const [state, action] = useActionState(updateOrganizationSecurity, idle);
  return (
    <Card>
      <CardHeader
        title="Security policy"
        description={isOwner ? "Owner-only. Changes are audited." : "Only owners can change the security policy."}
      />
      <CardBody>
        <form action={action} className="flex flex-col gap-4">
          <fieldset disabled={!isOwner} className="flex flex-col gap-4 disabled:opacity-70">
            <Checkbox
              name="requireMfa"
              defaultChecked={organization.require_mfa}
              label="Require two-factor verification for sensitive and operational actions (archiving, credentials, deployments)"
            />
            <Field
              label="Raw telemetry retention (days)"
              htmlFor="retentionDays"
              hint="1–400 days. Aggregated metrics are kept longer; see docs/database.md."
              className="max-w-xs"
            >
              <Input
                id="retentionDays"
                name="retentionDays"
                type="number"
                min={1}
                max={400}
                defaultValue={organization.telemetry_retention_days}
              />
            </Field>
          </fieldset>
          <FormMessage state={state} />
          {isOwner ? (
            <div>
              <SubmitButton pendingLabel="Saving…">Save policy</SubmitButton>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
