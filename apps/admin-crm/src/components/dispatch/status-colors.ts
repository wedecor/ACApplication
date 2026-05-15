import type { TechnicianStatus } from '@/lib/api/tracking';

/**
 * Single source of truth for status colouring used by both the live map
 * markers and dispatcher tables. The palette mirrors the warning system
 * used at Urban Company / on-call dashboards — vivid for engaged states,
 * muted for inactive.
 */
export const STATUS_COLOR: Record<TechnicianStatus, { fg: string; bg: string; label: string }> = {
  AVAILABLE: { fg: '#0E7A4A', bg: '#D6F3E5', label: 'Available' },
  ONLINE: { fg: '#0061C4', bg: '#D6E8FA', label: 'Online' },
  EN_ROUTE: { fg: '#9A5B00', bg: '#FCEBD0', label: 'En route' },
  WORKING: { fg: '#6028A6', bg: '#ECDDF7', label: 'Working' },
  BUSY: { fg: '#B23030', bg: '#FBDADA', label: 'Busy' },
  ON_BREAK: { fg: '#6F6F6F', bg: '#E5E5E5', label: 'On break' },
  UNREACHABLE: { fg: '#D43A2A', bg: '#FCD7D2', label: 'Unreachable' },
  OFFLINE: { fg: '#52525B', bg: '#E5E7EB', label: 'Offline' },
};
