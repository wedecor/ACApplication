'use client';

import { NotificationChannel } from '@ac/types';
import { Button, Input, Skeleton } from '@ac/ui';
import { CalendarClock, Send, Trash2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect, StatCard, TextArea } from '@/components/common/form-field';
import { CampaignStatusBadge } from '@/components/growth/campaign-status';
import {
  useCampaign,
  useCampaignAction,
  useCoupons,
  useSaveCampaign,
  useSegments,
} from '@/hooks/use-growth';
import type { CampaignInput } from '@/lib/api/growth';
import { errorMessage, formatDateTime, isoToLocalInput, localInputToIso } from '@/lib/crm-format';

const CHANNELS = Object.values(NotificationChannel);
const EDITABLE = new Set(['DRAFT', 'SCHEDULED']);

interface FormState {
  name: string;
  segmentId: string;
  channel: NotificationChannel;
  templateKey: string;
  message: string;
  couponId: string;
  scheduledAt: string;
}

const EMPTY: FormState = {
  name: '',
  segmentId: '',
  channel: NotificationChannel.WHATSAPP,
  templateKey: 'growth.campaign',
  message: '',
  couponId: '',
  scheduledAt: '',
};

/** Create / edit a campaign, and run its lifecycle actions (schedule, send, cancel). */
export function CampaignEditor({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const { data: segments } = useSegments({ page: 1, pageSize: 100 });
  const { data: coupons } = useCoupons({ page: 1, pageSize: 100, isActive: true });
  const save = useSaveCampaign();
  const action = useCampaignAction();
  const [form, setForm] = React.useState<FormState>(EMPTY);

  React.useEffect(() => {
    if (!campaign) return;
    setForm({
      name: campaign.name,
      segmentId: campaign.segmentId ?? '',
      channel: campaign.channel,
      templateKey: campaign.templateKey,
      message: campaign.message ?? '',
      couponId: campaign.couponId ?? '',
      scheduledAt: isoToLocalInput(campaign.scheduledAt),
    });
  }, [campaign]);

  if (campaignId && isLoading) return <Skeleton className="h-96 w-full" />;

  const editable = !campaign || EDITABLE.has(campaign.status);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const toInput = (): CampaignInput => ({
    name: form.name.trim(),
    segmentId: form.segmentId || null,
    channel: form.channel,
    templateKey: form.templateKey.trim(),
    message: form.message.trim() || undefined,
    couponId: form.couponId || null,
    scheduledAt: localInputToIso(form.scheduledAt) ?? null,
  });

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const input = toInput();
      // The create DTO rejects nulls for optional ids; omit them instead.
      const body: CampaignInput = campaignId
        ? input
        : {
            ...input,
            segmentId: input.segmentId ?? undefined,
            couponId: input.couponId ?? undefined,
            scheduledAt: input.scheduledAt ?? undefined,
          };
      const saved = await save.mutateAsync({ id: campaignId, input: body });
      toast.success('Campaign saved');
      if (!campaignId) router.push(`/campaigns/${saved.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const run = async (
    args: Parameters<typeof action.mutateAsync>[0],
    ok: string,
    after?: () => void,
  ) => {
    try {
      await action.mutateAsync(args);
      toast.success(ok);
      after?.();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const stats = campaign?.stats ?? {};

  return (
    <div className="space-y-6">
      {campaign ? (
        <div className="flex flex-wrap items-center gap-3">
          <CampaignStatusBadge status={campaign.status} />
          {campaign.scheduledAt ? (
            <span className="text-sm text-muted-foreground">Scheduled {formatDateTime(campaign.scheduledAt)}</span>
          ) : null}
          {campaign.completedAt ? (
            <span className="text-sm text-muted-foreground">Finished {formatDateTime(campaign.completedAt)}</span>
          ) : null}
          <div className="ml-auto flex gap-2">
            {editable ? (
              <>
                <Button
                  variant="outline"
                  disabled={!form.scheduledAt || action.isPending}
                  onClick={() => {
                    const iso = localInputToIso(form.scheduledAt);
                    if (iso) void run({ id: campaign.id, action: 'schedule', scheduledAt: iso }, 'Campaign scheduled');
                  }}
                >
                  <CalendarClock className="mr-1 size-4" /> Schedule
                </Button>
                <Button
                  disabled={action.isPending || !campaign.segmentId}
                  onClick={() => {
                    if (window.confirm('Send this campaign to every member of the segment now?')) {
                      void run({ id: campaign.id, action: 'send' }, 'Campaign sending started');
                    }
                  }}
                >
                  <Send className="mr-1 size-4" /> Send now
                </Button>
              </>
            ) : null}
            {campaign.status === 'SCHEDULED' || campaign.status === 'RUNNING' ? (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => void run({ id: campaign.id, action: 'cancel' }, 'Campaign cancelled')}
              >
                <XCircle className="mr-1 size-4" /> Cancel
              </Button>
            ) : null}
            {campaign.status !== 'RUNNING' ? (
              <Button
                variant="ghost"
                disabled={action.isPending}
                onClick={() => {
                  if (window.confirm('Delete this campaign?')) {
                    void run({ id: campaign.id, action: 'delete' }, 'Campaign deleted', () => router.push('/campaigns'));
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {campaign && !editable ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Targeted" value={stats.targeted ?? 0} />
          <StatCard label="Sent" value={stats.sent ?? 0} />
          <StatCard label="Failed" value={stats.failed ?? 0} />
          <StatCard label="Opted out" value={stats.skippedOptOut ?? 0} />
          <StatCard label="Converted" value={stats.converted ?? 0} hint="Coupon redemptions since start" />
        </div>
      ) : null}

      <form onSubmit={onSave} className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} required minLength={2} disabled={!editable} />
        </Field>
        <Field label="Segment" hint="Build segments on the Segments tab">
          <NativeSelect value={form.segmentId} onChange={(e) => set('segmentId', e.target.value)} disabled={!editable}>
            <option value="">— Select segment —</option>
            {(segments?.items ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.memberCount})
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Channel">
          <NativeSelect
            value={form.channel}
            onChange={(e) => set('channel', e.target.value as NotificationChannel)}
            disabled={!editable}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Template key" hint="growth.campaign renders the message below">
          <Input value={form.templateKey} onChange={(e) => set('templateKey', e.target.value)} required disabled={!editable} />
        </Field>
        <Field label="Coupon (optional)" hint="Exposed to the template as {{couponCode}}">
          <NativeSelect value={form.couponId} onChange={(e) => set('couponId', e.target.value)} disabled={!editable}>
            <option value="">— None —</option>
            {(coupons?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Message" className="sm:col-span-2" hint="Available as {{message}}; {{customerName}} is also available">
          <TextArea rows={5} value={form.message} onChange={(e) => set('message', e.target.value)} maxLength={2000} disabled={!editable} />
        </Field>
        <Field label="Send at (optional)">
          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => set('scheduledAt', e.target.value)}
            disabled={!editable}
          />
        </Field>
        {editable ? (
          <div className="flex items-end justify-end">
            <Button type="submit" disabled={save.isPending}>
              {campaignId ? 'Save changes' : 'Create campaign'}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
