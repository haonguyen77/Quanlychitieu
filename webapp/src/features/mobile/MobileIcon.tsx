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

/** True if `name` maps to a real icon (not the fallback). Used to decide
 *  whether a category's stored icon is a direct Lucide name we can render. */
export function hasMobileIcon(name?: string | null): boolean {
  return !!name && ICON_MAP[name] !== undefined;
}

interface Props {
  name: string;
  /** Numeric px, or any CSS length string (e.g. "1em") for responsive sizing. */
  size?: number | string;
  color?: string;
  className?: string;
}

export function MobileIcon({ name, size = 20, color, className }: Props) {
  const IconComponent = ICON_MAP[name] || MoreHorizontal;
  // Layer 2: numeric sizes scale with the mobile density token (--m). We drive
  // the size through a font-size:em wrapper so the SVG follows var(--m) without
  // changing the icon or its meaning. String sizes (e.g. "1em") pass through
  // unchanged — the caller is already controlling size responsively.
  if (typeof size === 'number') {
    return (
      <span
        style={{ fontSize: `calc(${size}px * var(--m))`, lineHeight: 0, display: 'inline-flex' }}
        className={className}
      >
        <IconComponent size="1em" color={color} />
      </span>
    );
  }
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
  fluid?: boolean;
}

export function GridChip({ label, icon, iconColor, isSelected, onTap, fluid }: GridChipProps) {
  // Responsive sizing keyed on viewport width (no transform scale, no UA sniffing).
  // Clamps are tuned so at ~390px+ (iPhone) the values match the previous fixed
  // sizes (52px box / 22px icon / 11px label), and shrink on narrower Android.
  //   box height:  clamp(42px, 13.3vw, 52px)  → 390px≈52 · 360px≈48 · 320px≈43
  //   icon size:   clamp(18px, 5.7vw, 22px)   → 390px≈22 · 360px≈20 · 320px≈18
  //   label font:  clamp(10px, 2.9vw, 11px)   → 390px≈11 · 320px≈10 (min 10, still legible)
  const boxH = 'clamp(42px, 13.3vw, 52px)';
  const iconSize = 'clamp(18px, 5.7vw, 22px)';
  const labelFont = 'clamp(10px, 2.9vw, 11px)';
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center"
      // minWidth:0 lets the fluid grid track shrink below content size so the
      // 4-column grid never forces horizontal overflow on narrow screens.
      style={{ width: fluid ? '100%' : 72, minWidth: 0 }}
    >
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          width: fluid ? '100%' : 52,
          maxWidth: 60,
          height: boxH,
          minWidth: 0,
          backgroundColor: isSelected ? `${iconColor}26` : `${iconColor}14`,
          border: `${isSelected ? 2 : 1}px solid ${isSelected ? iconColor : `${iconColor}4D`}`,
        }}
      >
        {/* Wrap so we can drive the icon size via responsive CSS font-size (em). */}
        <span style={{ fontSize: iconSize, lineHeight: 0, display: 'inline-flex' }}>
          <MobileIcon name={icon} size="1em" color={iconColor} />
        </span>
      </div>
      <span
        className="mt-1 text-center leading-tight truncate w-full"
        style={{
          fontSize: labelFont,
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
