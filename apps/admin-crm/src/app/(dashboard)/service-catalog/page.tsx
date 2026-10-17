'use client';

import { Permission, type ServiceCategory } from '@ac/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { errorMessage, Field, NativeSelect, Textarea, useCan } from '@/components/repair/repair-ui';
import {
  useCatalog,
  useChecklists,
  useDeleteCatalogItem,
  useDeleteChecklist,
  useDeleteFaultCode,
  useFaultCodes,
  useSaveCatalogItem,
  useSaveChecklist,
  useSaveFaultCode,
} from '@/hooks/use-repair';
import {
  type CatalogItem,
  type ChecklistItem,
  type ChecklistItemType,
  type ChecklistKind,
  type ChecklistTemplate,
  type FaultCode,
  humanize,
  SERVICE_CATEGORIES,
} from '@/lib/api/repair';
import { formatMinor } from '@/lib/format';

export default function ServiceCatalogPage() {
  const canManage = useCan(Permission.CATALOG_MANAGE);
  const [category, setCategory] = React.useState<ServiceCategory | ''>('');

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service catalog</h1>
          <p className="text-sm text-muted-foreground">
            Rate card, fault-code library and technician checklists per appliance category.
          </p>
        </div>
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value as ServiceCategory | '')}
          className="w-56"
          aria-label="Category"
        >
          <option value="">All categories</option>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </NativeSelect>
      </header>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog items</TabsTrigger>
          <TabsTrigger value="faults">Fault codes</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-4">
          <CatalogTab category={category || undefined} canManage={canManage} />
        </TabsContent>
        <TabsContent value="faults" className="mt-4">
          <FaultCodesTab category={category || undefined} canManage={canManage} />
        </TabsContent>
        <TabsContent value="checklists" className="mt-4">
          <ChecklistsTab category={category || undefined} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalog items
// ---------------------------------------------------------------------------

function CatalogTab({ category, canManage }: { category?: ServiceCategory; canManage: boolean }) {
  const { data, isLoading } = useCatalog({ category });
  const remove = useDeleteCatalogItem();
  const [editing, setEditing] = React.useState<CatalogItem | 'new' | null>(null);
  const items = data ?? [];

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New item
          </Button>
        </div>
      ) : null}
      <div className="rounded-md border">
        <Table stackOnMobile>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Visit</TableHead>
              <TableHead className="text-right">Mins</TableHead>
              <TableHead className="text-right">Warranty</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <EmptyState title="No catalog items" description="Add services to build your rate card." />
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell data-primary="" className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{humanize(c.category)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(c.basePriceMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(c.visitChargeMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.estimatedMinutes}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.repairWarrantyDays ? `${c.repairWarrantyDays} days` : 'None'}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? 'success' : 'muted'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <RowActions
                        onEdit={() => setEditing(c)}
                        onDelete={() =>
                          window.confirm(`Delete ${c.code}?`) &&
                          remove.mutate(c.id, {
                            onSuccess: () => toast.success('Deleted'),
                            onError: (err) => toast.error(errorMessage(err)),
                          })
                        }
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {editing ? (
        <CatalogItemModal item={editing === 'new' ? null : editing} defaultCategory={category} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function CatalogItemModal({
  item,
  defaultCategory,
  onClose,
}: {
  item: CatalogItem | null;
  defaultCategory?: ServiceCategory;
  onClose: () => void;
}) {
  const save = useSaveCatalogItem();
  const [form, setForm] = React.useState({
    code: item?.code ?? '',
    category: (item?.category ?? defaultCategory ?? 'AC_REPAIR'),
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item ? String(item.basePriceMinor / 100) : '',
    visit: item ? String(item.visitChargeMinor / 100) : '0',
    minutes: String(item?.estimatedMinutes ?? 60),
    warrantyDays: String(item?.repairWarrantyDays ?? 30),
    gstPct: String((item?.gstRateBps ?? 1800) / 100),
    sacCode: item?.sacCode ?? '',
    isActive: item?.isActive ?? true,
  });
  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: item?.id,
        input: {
          code: form.code.trim().toUpperCase(),
          category: form.category,
          name: form.name.trim(),
          description: form.description.trim() || null,
          basePriceMinor: Math.round(Number(form.price || 0) * 100),
          visitChargeMinor: Math.round(Number(form.visit || 0) * 100),
          estimatedMinutes: Number(form.minutes),
          repairWarrantyDays: Number(form.warrantyDays),
          gstRateBps: Math.round(Number(form.gstPct) * 100),
          sacCode: form.sacCode.trim() || null,
          isActive: form.isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success(item ? 'Catalog item updated' : 'Catalog item created');
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Modal open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle>{item ? `Edit ${item.code}` : 'New catalog item'}</ModalTitle>
        </ModalHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" htmlFor="ci-code">
            <Input id="ci-code" value={form.code} onChange={set('code')} required placeholder="AC-GAS-REFILL" />
          </Field>
          <Field label="Category" htmlFor="ci-cat">
            <CategorySelect id="ci-cat" value={form.category} onChange={set('category')} />
          </Field>
          <Field label="Name" htmlFor="ci-name" className="sm:col-span-2">
            <Input id="ci-name" value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Base price (₹)" htmlFor="ci-price">
            <Input id="ci-price" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required />
          </Field>
          <Field label="Visit charge (₹)" htmlFor="ci-visit">
            <Input id="ci-visit" type="number" min="0" step="0.01" value={form.visit} onChange={set('visit')} />
          </Field>
          <Field label="Estimated minutes" htmlFor="ci-mins">
            <Input id="ci-mins" type="number" min="5" value={form.minutes} onChange={set('minutes')} />
          </Field>
          <Field label="Repair warranty (days)" htmlFor="ci-wd">
            <Input id="ci-wd" type="number" min="0" value={form.warrantyDays} onChange={set('warrantyDays')} />
          </Field>
          <Field label="GST %" htmlFor="ci-gst">
            <Input id="ci-gst" type="number" min="0" max="100" step="0.01" value={form.gstPct} onChange={set('gstPct')} />
          </Field>
          <Field label="SAC code" htmlFor="ci-sac">
            <Input id="ci-sac" value={form.sacCode} onChange={set('sacCode')} />
          </Field>
          <Field label="Description" htmlFor="ci-desc" className="sm:col-span-2">
            <Textarea id="ci-desc" value={form.description} onChange={set('description')} rows={2} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <ModalFooter className="gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Fault codes
// ---------------------------------------------------------------------------

function FaultCodesTab({ category, canManage }: { category?: ServiceCategory; canManage: boolean }) {
  const [q, setQ] = React.useState('');
  const { data, isLoading } = useFaultCodes({ category, q: q || undefined });
  const remove = useDeleteFaultCode();
  const [editing, setEditing] = React.useState<FaultCode | 'new' | null>(null);
  const items = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or title" className="max-w-xs" />
        {canManage ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New fault code
          </Button>
        ) : null}
      </div>
      <div className="rounded-md border">
        <Table stackOnMobile>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Suggested fix</TableHead>
              {canManage ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState title="No fault codes" description="Build a library technicians can pick from." />
                </TableCell>
              </TableRow>
            ) : (
              items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.code}</TableCell>
                  <TableCell data-primary="" className="font-medium">{f.title}</TableCell>
                  <TableCell className="text-sm">{humanize(f.category)}</TableCell>
                  <TableCell className="text-sm">{f.brand ?? 'All brands'}</TableCell>
                  <TableCell className="max-w-sm text-xs text-muted-foreground">{f.suggestedFix ?? '—'}</TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <RowActions
                        onEdit={() => setEditing(f)}
                        onDelete={() =>
                          window.confirm(`Delete ${f.code}?`) &&
                          remove.mutate(f.id, {
                            onSuccess: () => toast.success('Deleted'),
                            onError: (err) => toast.error(errorMessage(err)),
                          })
                        }
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {editing ? (
        <FaultCodeModal code={editing === 'new' ? null : editing} defaultCategory={category} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function FaultCodeModal({
  code,
  defaultCategory,
  onClose,
}: {
  code: FaultCode | null;
  defaultCategory?: ServiceCategory;
  onClose: () => void;
}) {
  const save = useSaveFaultCode();
  const [form, setForm] = React.useState({
    category: (code?.category ?? defaultCategory ?? 'AC_REPAIR'),
    code: code?.code ?? '',
    brand: code?.brand ?? '',
    title: code?.title ?? '',
    description: code?.description ?? '',
    suggestedFix: code?.suggestedFix ?? '',
  });
  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: code?.id,
        input: {
          category: form.category,
          code: form.code.trim(),
          brand: form.brand.trim() || null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          suggestedFix: form.suggestedFix.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Fault code saved');
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Modal open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle>{code ? `Edit ${code.code}` : 'New fault code'}</ModalTitle>
        </ModalHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" htmlFor="fc-cat">
            <CategorySelect id="fc-cat" value={form.category} onChange={set('category')} />
          </Field>
          <Field label="Code" htmlFor="fc-code">
            <Input id="fc-code" value={form.code} onChange={set('code')} required placeholder="E4" />
          </Field>
          <Field label="Brand" htmlFor="fc-brand" hint="Leave blank for all brands.">
            <Input id="fc-brand" value={form.brand} onChange={set('brand')} />
          </Field>
          <Field label="Title" htmlFor="fc-title">
            <Input id="fc-title" value={form.title} onChange={set('title')} required />
          </Field>
          <Field label="Description" htmlFor="fc-desc" className="sm:col-span-2">
            <Textarea id="fc-desc" value={form.description} onChange={set('description')} rows={2} />
          </Field>
          <Field label="Suggested fix" htmlFor="fc-fix" className="sm:col-span-2">
            <Textarea id="fc-fix" value={form.suggestedFix} onChange={set('suggestedFix')} rows={2} />
          </Field>
          <ModalFooter className="gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

const KINDS: ChecklistKind[] = ['PRE_SERVICE', 'POST_SERVICE', 'SAFETY'];
const ITEM_TYPES: ChecklistItemType[] = ['bool', 'number', 'text', 'photo'];

function ChecklistsTab({ category, canManage }: { category?: ServiceCategory; canManage: boolean }) {
  const { data, isLoading } = useChecklists({ category });
  const remove = useDeleteChecklist();
  const [editing, setEditing] = React.useState<ChecklistTemplate | 'new' | null>(null);
  const items = data ?? [];

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New checklist
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <EmptyState title="No checklists" description="Checklists guide technicians before, during and after service." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <Card key={t.id}>
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{t.name}</CardTitle>
                  {canManage ? (
                    <RowActions
                      onEdit={() => setEditing(t)}
                      onDelete={() =>
                        window.confirm(`Delete "${t.name}"?`) &&
                        remove.mutate(t.id, {
                          onSuccess: () => toast.success('Deleted'),
                          onError: (err) => toast.error(errorMessage(err)),
                        })
                      }
                    />
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{humanize(t.category)}</Badge>
                  <Badge variant="secondary">{humanize(t.kind)}</Badge>
                  <Badge variant="muted">v{t.version}</Badge>
                  {!t.isActive ? <Badge variant="destructive">Inactive</Badge> : null}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs">
                  {t.items.map((i) => (
                    <li key={i.key} className="flex justify-between gap-2">
                      <span>
                        {i.label}
                        {i.required ? <span className="text-destructive"> *</span> : null}
                      </span>
                      <span className="text-muted-foreground">
                        {i.type}
                        {i.unit ? ` (${i.unit})` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editing ? (
        <ChecklistModal template={editing === 'new' ? null : editing} defaultCategory={category} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function ChecklistModal({
  template,
  defaultCategory,
  onClose,
}: {
  template: ChecklistTemplate | null;
  defaultCategory?: ServiceCategory;
  onClose: () => void;
}) {
  const save = useSaveChecklist();
  const [category, setCategory] = React.useState<string>(template?.category ?? defaultCategory ?? 'AC_REPAIR');
  const [kind, setKind] = React.useState<ChecklistKind>(template?.kind ?? 'POST_SERVICE');
  const [name, setName] = React.useState(template?.name ?? '');
  const [isActive, setIsActive] = React.useState(template?.isActive ?? true);
  const [items, setItems] = React.useState<ChecklistItem[]>(
    template?.items.length ? template.items : [{ key: '', label: '', type: 'bool', required: true }],
  );

  const updateItem = (idx: number, patch: Partial<ChecklistItem>) =>
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = items
      .filter((i) => i.key.trim() && i.label.trim())
      .map((i) => ({
        key: i.key.trim(),
        label: i.label.trim(),
        type: i.type,
        ...(i.unit?.trim() ? { unit: i.unit.trim() } : {}),
        required: i.required,
      }));
    save.mutate(
      {
        id: template?.id,
        input: { category: category as ServiceCategory, kind, name: name.trim(), isActive, items: cleaned },
      },
      {
        onSuccess: () => {
          toast.success('Checklist saved');
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Modal open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <ModalContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{template ? 'Edit checklist' : 'New checklist'}</ModalTitle>
        </ModalHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Category" htmlFor="cl-cat">
              <CategorySelect id="cl-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </Field>
            <Field label="Kind" htmlFor="cl-kind">
              <NativeSelect id="cl-kind" value={kind} onChange={(e) => setKind(e.target.value as ChecklistKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {humanize(k)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Name" htmlFor="cl-name">
              <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
              <span className="col-span-3">Key</span>
              <span className="col-span-4">Label</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-1">Unit</span>
              <span className="col-span-1">Req.</span>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <Input
                  className="col-span-3"
                  value={it.key}
                  onChange={(e) => updateItem(idx, { key: e.target.value })}
                  placeholder="gasPressurePsi"
                  aria-label="Item key"
                />
                <Input
                  className="col-span-4"
                  value={it.label}
                  onChange={(e) => updateItem(idx, { label: e.target.value })}
                  placeholder="Gas pressure"
                  aria-label="Item label"
                />
                <NativeSelect
                  className="col-span-2"
                  value={it.type}
                  onChange={(e) => updateItem(idx, { type: e.target.value as ChecklistItemType })}
                  aria-label="Item type"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  className="col-span-1"
                  value={it.unit ?? ''}
                  onChange={(e) => updateItem(idx, { unit: e.target.value })}
                  aria-label="Item unit"
                />
                <input
                  type="checkbox"
                  className="col-span-1 justify-self-center"
                  checked={it.required}
                  onChange={(e) => updateItem(idx, { required: e.target.checked })}
                  aria-label="Required"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="col-span-1 size-8"
                  onClick={() => setItems((list) => list.filter((_, i) => i !== idx))}
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setItems((list) => [...list, { key: '', label: '', type: 'bool', required: false }])}
            >
              <Plus className="size-4" /> Add item
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <ModalFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function CategorySelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <NativeSelect {...props}>
      {SERVICE_CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {humanize(c)}
        </option>
      ))}
    </NativeSelect>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <Button size="icon" variant="ghost" className="size-8" onClick={onEdit} aria-label="Edit">
        <Pencil className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" className="size-8" onClick={onDelete} aria-label="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
