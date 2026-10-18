import { useState } from 'react';
import { Alert, Image, Text, TextInput, View } from 'react-native';

import { apiErrorMessage, isNetworkError, isNotFound } from '../lib/api';
import { capturePhoto } from '../lib/camera';
import { checklistProgress, getAnswer, parseReading } from '../lib/jobcard-logic';
import { attachBookingPhoto, uploadPhotoForUrl } from '../lib/photo-service';
import type { ChecklistEntry, ChecklistTemplate, ChecklistTemplateItem } from '../lib/repair-types';
import { Badge, Button, Card, colors, YesNo } from './ui';

const KIND_LABEL: Record<ChecklistTemplate['kind'], string> = {
  PRE_SERVICE: 'Pre-service',
  POST_SERVICE: 'Post-service',
  SAFETY: 'Safety',
};

export function ChecklistSection({
  bookingId,
  template,
  checklist,
  disabled,
  onAnswer,
}: {
  bookingId: string;
  template: ChecklistTemplate;
  checklist: ChecklistEntry[];
  disabled: boolean;
  onAnswer: (template: ChecklistTemplate, key: string, value: unknown) => void;
}) {
  const progress = checklistProgress(template, checklist);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ color: colors.subtle, fontSize: 12 }}>{KIND_LABEL[template.kind]}</Text>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{template.name}</Text>
        </View>
        <Badge
          label={`${progress.answered}/${progress.total}`}
          tone={progress.requiredMissing > 0 ? 'warning' : 'success'}
        />
      </View>
      {template.items.map((item) => (
        <ChecklistItemRow
          key={item.key}
          bookingId={bookingId}
          item={item}
          value={getAnswer(checklist, template.id, item.key)}
          disabled={disabled}
          onChange={(v) => onAnswer(template, item.key, v)}
        />
      ))}
    </Card>
  );
}

function ItemLabel({ item }: { item: ChecklistTemplateItem }) {
  return (
    <Text style={{ flexShrink: 1, color: colors.text }}>
      {item.label}
      {item.unit ? <Text style={{ color: colors.muted }}> ({item.unit})</Text> : null}
      {item.required ? <Text style={{ color: colors.danger }}> *</Text> : null}
    </Text>
  );
}

function ChecklistItemRow({
  bookingId,
  item,
  value,
  disabled,
  onChange,
}: {
  bookingId: string;
  item: ChecklistTemplateItem;
  value: unknown;
  disabled: boolean;
  onChange: (v: unknown) => void;
}) {
  const rowStyle = {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  } as const;

  switch (item.type) {
    case 'bool':
      return (
        <View style={[rowStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <ItemLabel item={item} />
          <View pointerEvents={disabled ? 'none' : 'auto'}>
            <YesNo value={typeof value === 'boolean' ? value : undefined} onChange={onChange} />
          </View>
        </View>
      );
    case 'number':
      return (
        <View style={[rowStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <ItemLabel item={item} />
          <NumberInput label={item.label} value={typeof value === 'number' ? value : undefined} unit={item.unit} disabled={disabled} onChange={onChange} />
        </View>
      );
    case 'text':
      return (
        <View style={rowStyle}>
          <ItemLabel item={item} />
          <TextInput
            editable={!disabled}
            value={typeof value === 'string' ? value : ''}
            onChangeText={(t) => onChange(t === '' ? undefined : t)}
            placeholder="Type here"
            accessibilityLabel={item.label}
            placeholderTextColor={colors.subtle}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              color: colors.text,
            }}
          />
        </View>
      );
    case 'photo':
      return (
        <PhotoItem
          bookingId={bookingId}
          item={item}
          value={typeof value === 'string' ? value : undefined}
          disabled={disabled}
          onChange={onChange}
          style={rowStyle}
        />
      );
    default:
      return null;
  }
}

function NumberInput({
  label,
  value,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number | undefined;
  unit: string | undefined;
  disabled: boolean;
  onChange: (v: number | undefined) => void;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [invalid, setInvalid] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TextInput
        accessibilityLabel={unit ? `${label} (${unit})` : label}
        editable={!disabled}
        value={text}
        keyboardType="decimal-pad"
        onChangeText={(t) => {
          setText(t);
          const parsed = parseReading(t);
          setInvalid(parsed === null);
          if (parsed !== null) onChange(parsed);
        }}
        placeholder="—"
        placeholderTextColor={colors.subtle}
        style={{
          width: 96,
          textAlign: 'right',
          borderWidth: 1,
          borderColor: invalid ? colors.danger : colors.border,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: colors.text,
        }}
      />
      {unit ? <Text style={{ color: colors.muted, minWidth: 28 }}>{unit}</Text> : null}
    </View>
  );
}

function PhotoItem({
  bookingId,
  item,
  value,
  disabled,
  onChange,
  style,
}: {
  bookingId: string;
  item: ChecklistTemplateItem;
  value: string | undefined;
  disabled: boolean;
  onChange: (v: string | undefined) => void;
  style: object;
}) {
  const [busy, setBusy] = useState(false);
  const take = async () => {
    try {
      const photo = await capturePhoto('camera');
      if (!photo) return;
      setBusy(true);
      try {
        onChange(await uploadPhotoForUrl(photo));
      } catch (err) {
        if (!isNetworkError(err) && !isNotFound(err)) throw err;
        // Offline: keep the evidence as a queued booking photo; the checklist
        // answer itself needs a reachable URL, so ask to retake when online.
        await attachBookingPhoto(bookingId, photo, 'OTHER', item.label);
        Alert.alert(
          'Saved offline',
          'The photo is queued as a job photo. Retake it for this checklist item once you are back online.',
        );
      }
    } catch (err) {
      Alert.alert('Photo failed', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={style}>
      <ItemLabel item={item} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {value ? (
          <Image
            source={{ uri: value }}
            style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#F1F5F9' }}
            accessibilityLabel={item.label}
          />
        ) : null}
        <Button
          small
          variant="outline"
          label={value ? 'Retake' : 'Take photo'}
          loading={busy}
          disabled={disabled}
          onPress={() => void take()}
        />
      </View>
    </View>
  );
}
