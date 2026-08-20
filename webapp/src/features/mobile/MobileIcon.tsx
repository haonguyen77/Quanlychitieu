/**
 * MobileIcon — Renders a Lucide icon by string name.
 * Used by all mobile components to ensure consistent icon rendering.
 * Maps string icon names from mobileIconMap.ts to actual Lucide components.
 */
import {
  UtensilsCrossed, Coffee, Car, ShoppingBag, Heart, Film, Receipt, GraduationCap,
  Home, Gift, Wallet, TrendingUp, Smartphone, Wifi, Zap, Droplet, Shirt,
  Sparkles, PawPrint, Plane, Dumbbell, MoreHorizontal, Banknote, CreditCard,
  Landmark, ShoppingCart, Gem, Grape, BarChart3, Settings, LayoutGrid, Plus,
  Calendar, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, Search, SlidersHorizontal,
  Trash2, Edit, ArrowLeft, FileText, User, MapPin, Tag, Layers, Shield,
  Camera, Bell, Database, Cloud, Lock, Minus, Check, Save, type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  'utensils': UtensilsCrossed,
  'coffee': Coffee,
  'car': Car,
  'shopping-bag': ShoppingBag,
  'heart': Heart,
  'film': Film,
  'receipt': Receipt,
  'graduation-cap': GraduationCap,
  'home': Home,
  'gift': Gift,
  'wallet': Wallet,
  'trending-up': TrendingUp,
  'smartphone': Smartphone,
  'wifi': Wifi,
  'zap': Zap,
  'droplet': Droplet,
  'shirt': Shirt,
  'sparkles': Sparkles,
  'paw-print': PawPrint,
  'plane': Plane,
  'dumbbell': Dumbbell,
  'more-horizontal': MoreHorizontal,
  'banknote': Banknote,
  'credit-card': CreditCard,
  'landmark': Landmark,
  'shopping-cart': ShoppingCart,
  'gem': Gem,
  'grape': Grape,
  'bar-chart-3': BarChart3,
  'settings': Settings,
  'layout-grid': LayoutGrid,
  'plus': Plus,
  'calendar': Calendar,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'search': Search,
  'sliders-horizontal': SlidersHorizontal,
  'trash-2': Trash2,
  'edit': Edit,
  'arrow-left': ArrowLeft,
  'file-text': FileText,
  'user': User,
  'map-pin': MapPin,
  'tag': Tag,
  'layers': Layers,
  'shield': Shield,
  'camera': Camera,
  'bell': Bell,
  'database': Database,
  'cloud': Cloud,
  'lock': Lock,
  'minus': Minus,
  'check': Check,
  'save': Save,
};

interface Props {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

export function MobileIcon({ name, size = 20, color, className }: Props) {
  const IconComponent = ICON_MAP[name] || MoreHorizontal;
  return <IconComponent size={size} color={color} className={className} />;
}

/**
 * GridChip — Android-style grid chip (72x auto) with icon in rounded square + label below.
 * Reproduces _buildGridChip from add_transaction_screen.dart:
 * - 52x52 icon container with rounded corners (12px)
 * - icon centered, 22px
 * - label below, 11px, max 1 line ellipsis
 * - Selected: thicker border + more opaque bg
 */
interface GridChipProps {
  label: string;
  icon: string;
  iconColor: string;
  isSelected: boolean;
  onTap: () => void;
}

export function GridChip({ label, icon, iconColor, isSelected, onTap }: GridChipProps) {
  return (
    <button onClick={onTap} className="flex flex-col items-center" style={{ width: 72 }}>
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          width: 52,
          height: 52,
          backgroundColor: isSelected ? `${iconColor}26` : `${iconColor}14`,
          border: `${isSelected ? 2 : 1}px solid ${isSelected ? iconColor : `${iconColor}4D`}`,
        }}
      >
        <MobileIcon name={icon} size={22} color={iconColor} />
      </div>
      <span
        className="mt-1 text-center leading-tight truncate w-full"
        style={{
          fontSize: 11,
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? iconColor : '#616161',
        }}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * ModulePill — Android-style horizontal pill for module selection.
 * Reproduces the module row from add_transaction_screen.dart:
 * - Rounded pill (20px radius)
 * - Icon + name
 * - Module color tinting
 */
interface ModulePillProps {
  label: string;
  icon: string;
  color: string;
  isSelected: boolean;
  onTap: () => void;
}

export function ModulePill({ label, icon, color, isSelected, onTap }: ModulePillProps) {
  return (
    <button
      onClick={onTap}
      className="flex items-center gap-1 whitespace-nowrap"
      style={{
        padding: '8px 10px',
        borderRadius: 20,
        backgroundColor: isSelected ? `${color}26` : `${color}0D`,
        border: `${isSelected ? 2 : 1}px solid ${isSelected ? color : `${color}66`}`,
      }}
    >
      <MobileIcon name={icon} size={14} color={color} />
      <span style={{ fontSize: 11, fontWeight: isSelected ? 700 : 500, color }}>{label}</span>
    </button>
  );
}
