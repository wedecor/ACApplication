import {
  AirVent,
  BatteryCharging,
  Brush,
  CloudFog,
  CookingPot,
  Droplets,
  Fan,
  type LucideIcon,
  Microwave,
  PlugZap,
  Refrigerator,
  ShowerHead,
  Tv,
  UtensilsCrossed,
  WashingMachine,
  Wind,
  Wrench,
} from 'lucide-react-native';

import { colors } from '@/theme/tokens';

const ICONS: Record<string, LucideIcon> = {
  AC_REPAIR: AirVent,
  AC_INSTALLATION: AirVent,
  AC_SERVICING: AirVent,
  WASHING_MACHINE: WashingMachine,
  REFRIGERATOR: Refrigerator,
  MICROWAVE: Microwave,
  TELEVISION: Tv,
  GEYSER: ShowerHead,
  WATER_PURIFIER: Droplets,
  CHIMNEY: CloudFog,
  DISHWASHER: UtensilsCrossed,
  AIR_COOLER: Wind,
  INVERTER_UPS: BatteryCharging,
  CEILING_FAN: Fan,
  OVEN: CookingPot,
  VACUUM_CLEANER: Brush,
  ELECTRICAL_WIRING: PlugZap,
};

/** One consistent line-icon per appliance category (replaces emoji, which render differently per OS). */
export function ApplianceIcon({
  category,
  size = 22,
  color = colors.brand,
}: {
  category: string | null | undefined;
  size?: number;
  color?: string;
}) {
  const Icon = (category && ICONS[category]) || Wrench;
  return <Icon size={size} color={color} strokeWidth={1.75} accessibilityElementsHidden importantForAccessibility="no" />;
}
