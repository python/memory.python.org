import {
  Settings,
  Server,
  Zap,
  Bug,
  Gauge,
  Shield,
  Search,
  Code2,
  AlertCircle,
  Monitor,
  Cpu,
  HardDrive,
  Rocket,
  Star,
  Heart,
  Target,
  Trophy,
  Briefcase,
  PenTool,
  Wrench,
  Database,
  Cloud,
  Coffee,
  type LucideIcon,
} from 'lucide-react';

// Map of icon names to Lucide icon components
const iconMap: Record<string, LucideIcon> = {
  settings: Settings,
  server: Server,
  zap: Zap,
  bug: Bug,
  gauge: Gauge,
  shield: Shield,
  search: Search,
  code2: Code2,
  alertCircle: AlertCircle,
  monitor: Monitor,
  cpu: Cpu,
  hardDrive: HardDrive,
  rocket: Rocket,
  star: Star,
  heart: Heart,
  target: Target,
  trophy: Trophy,
  briefcase: Briefcase,
  tool: PenTool,
  wrench: Wrench,
  database: Database,
  cloud: Cloud,
  coffee: Coffee,
};

/**
 * Get a Lucide icon component by name
 * @param iconName - The name of the icon
 * @returns The Lucide icon component or a fallback icon
 */
export function getIconByName(iconName?: string): LucideIcon {
  if (!iconName) return Settings;
  
  const icon = iconMap[iconName.toLowerCase()];
  return icon || Settings; // Fallback to Settings icon
}

/**
 * Get available icon names
 * @returns Array of available icon names
 */
export function getAvailableIconNames(): string[] {
  return Object.keys(iconMap);
}