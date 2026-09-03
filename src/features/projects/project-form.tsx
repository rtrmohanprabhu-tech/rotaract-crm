'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { upsertProjectAction } from '@/server/actions/admin';

export function ProjectForm({
  project,
}: {
  project?: { id: string; name: string; description: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = React.useState(project?.name ?? '');
  const [description, setDescription] = React.useState(project?.description ?? '');
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const result = await upsertProjectAction(project?.id ?? null, { name, description, isActive: true });
        setPending(false);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error('Project not saved', result.message);
          return;
        }
        toast.success('Project saved');
        if (!project) {
          setName('');
          setDescription('');
        }
        router.refresh();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" required error={errors.name}>
          {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. அவளுக்காக" />}
        </Field>
        <Field label="Short description" optional>
          {(props) => (
            <Textarea
              {...props}
              className="min-h-[44px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
            />
          )}
        </Field>
      </div>
      <Button type="submit" loading={pending}>
        <Plus className="h-4 w-4" /> {project ? 'Save project' : 'Create project'}
      </Button>
    </form>
  );
}
