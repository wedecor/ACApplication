'use client';

import { Permission } from '@ac/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  ModalFooter,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect } from '@/components/common/form-field';
import { SimpleModal } from '@/components/common/simple-modal';
import {
  useCreateCustomField,
  useCustomFieldDefinitions,
  useDeleteCustomField,
  useUpdateCustomField,
} from '@/hooks/use-custom-fields';
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_TYPES,
  type CustomFieldDefinition,
  type CustomFieldEntity,
  type CustomFieldType,
} from '@/lib/api/custom-fields';
import { errorMessage } from '@/lib/crm-format';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

interface Draft {
  entity: CustomFieldEntity;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: string;
  required: boolean;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY: Draft = {
  entity: 'customer',
  key: '',
  label: '',
  fieldType: 'text',
  options: '',
  required: false,
  isActive: true,
  sortOrder: '0',
};

function toKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

/** Settings section: tenant-defined custom fields for customers, leads, bookings and appliances. */
export function CustomFieldsManager() {
  const [entity, setEntity] = React.useState<CustomFieldEntity>('customer');
  const [canManage, setCanManage] = React.useState(false);
  React.useEffect(() => {
    setCanManage(hasPermission(Permission.CUSTOM_FIELD_MANAGE, readSessionClaims().permissions));
  }, []);
  const { data: defs = [], isLoading, error } = useCustomFieldDefinitions(entity, true);
  const update = useUpdateCustomField();
  const remove = useDeleteCustomField();
  const [editing, setEditing] = React.useState<CustomFieldDefinition | 'new' | null>(null);

  const toggle = async (d: CustomFieldDefinition) => {
    try {
      await update.mutateAsync({ id: d.id, input: { isActive: !d.isActive } });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onDelete = async (d: CustomFieldDefinition) => {
    if (!window.confirm(`Delete custom field "${d.label}"? Existing values stay on records.`)) return;
    try {
      await remove.mutateAsync(d.id);
      toast.success('Field deleted');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="size-4" /> Custom fields
        </CardTitle>
        <div className="flex items-center gap-2">
          <NativeSelect
            className="h-9 w-36"
            value={entity}
            onChange={(e) => setEntity(e.target.value as CustomFieldEntity)}
            aria-label="Entity"
          >
            {CUSTOM_FIELD_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
          {canManage ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="mr-1 size-4" /> Add
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{errorMessage(error, 'Failed to load fields')}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : defs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom fields for {entity} yet.</p>
        ) : (
          <div className="rounded-md border">
            <Table stackOnMobile>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {defs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="font-mono text-xs">{d.key}</TableCell>
                    <TableCell>
                      {d.fieldType}
                      {d.fieldType === 'select' && d.options?.length ? (
                        <span className="block text-xs text-muted-foreground">{d.options.join(', ')}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="space-x-1">
                      {d.required ? <Badge variant="warning">required</Badge> : null}
                      <Badge variant={d.isActive ? 'success' : 'muted'}>{d.isActive ? 'active' : 'inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggle(d)}>
                            {d.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onDelete(d)} aria-label="Delete">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CustomFieldModal
        entity={entity}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </Card>
  );
}

function CustomFieldModal({
  entity,
  editing,
  onClose,
}: {
  entity: CustomFieldEntity;
  editing: CustomFieldDefinition | 'new' | null;
  onClose: () => void;
}) {
  const create = useCreateCustomField();
  const update = useUpdateCustomField();
  const isNew = editing === 'new';
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [keyTouched, setKeyTouched] = React.useState(false);

  React.useEffect(() => {
    if (!editing) return;
    setKeyTouched(false);
    if (editing === 'new') setDraft({ ...EMPTY, entity });
    else
      setDraft({
        entity: editing.entity,
        key: editing.key,
        label: editing.label,
        fieldType: editing.fieldType,
        options: (editing.options ?? []).join(', '),
        required: editing.required,
        isActive: editing.isActive,
        sortOrder: String(editing.sortOrder),
      });
  }, [editing, entity]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const options = draft.options.split(',').map((s) => s.trim()).filter(Boolean);
    if (draft.fieldType === 'select' && options.length === 0) {
      toast.error('Select fields need at least one option');
      return;
    }
    try {
      if (isNew) {
        await create.mutateAsync({
          entity: draft.entity,
          key: draft.key,
          label: draft.label.trim(),
          fieldType: draft.fieldType,
          options,
          required: draft.required,
          isActive: draft.isActive,
          sortOrder: Number(draft.sortOrder) || 0,
        });
      } else if (editing) {
        await update.mutateAsync({
          id: editing.id,
          input: {
            label: draft.label.trim(),
            fieldType: draft.fieldType,
            options,
            required: draft.required,
            isActive: draft.isActive,
            sortOrder: Number(draft.sortOrder) || 0,
          },
        });
      }
      toast.success('Custom field saved');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save field'));
    }
  };

  return (
    <SimpleModal
      open={Boolean(editing)}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'New custom field' : 'Edit custom field'}
      description="Entity and key cannot change after creation."
    >
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <Field label="Entity">
          <NativeSelect
            value={draft.entity}
            disabled={!isNew}
            onChange={(e) => set('entity', e.target.value as CustomFieldEntity)}
          >
            {CUSTOM_FIELD_ENTITIES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Type">
          <NativeSelect value={draft.fieldType} onChange={(e) => set('fieldType', e.target.value as CustomFieldType)}>
            {CUSTOM_FIELD_TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Label">
          <Input
            required
            value={draft.label}
            onChange={(e) => {
              set('label', e.target.value);
              if (isNew && !keyTouched) set('key', toKey(e.target.value));
            }}
          />
        </Field>
        <Field label="Key (snake_case)">
          <Input
            required
            pattern="[a-z][a-z0-9_]*"
            disabled={!isNew}
            value={draft.key}
            onChange={(e) => {
              setKeyTouched(true);
              set('key', e.target.value);
            }}
          />
        </Field>
        {draft.fieldType === 'select' ? (
          <Field label="Options (comma-separated)" className="col-span-2">
            <Input value={draft.options} onChange={(e) => set('options', e.target.value)} />
          </Field>
        ) : null}
        <Field label="Sort order">
          <Input type="number" value={draft.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
        </Field>
        <div className="flex items-end gap-4 pb-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.required} onChange={(e) => set('required', e.target.checked)} />
            Required
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            Active
          </label>
        </div>
        <ModalFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending || update.isPending}>
            Save
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
