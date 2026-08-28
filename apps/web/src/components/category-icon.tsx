import {
  UtensilsCrossed,
  Car,
  Tv,
  Home,
  Gamepad2,
  HeartPulse,
  ShoppingBag,
  Wallet,
  ArrowLeftRight,
  Receipt,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react';

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  alimentacao: UtensilsCrossed,
  transporte: Car,
  assinaturas: Tv,
  moradia: Home,
  lazer: Gamepad2,
  saude: HeartPulse,
  compras: ShoppingBag,
  receita: Wallet,
  transferencias: ArrowLeftRight,
  taxas: Receipt,
  outros: CircleHelp,
};

export function CategoryIcon({
  slug,
  className,
}: {
  slug?: string | null;
  className?: string;
}) {
  const Icon = (slug && ICON_BY_SLUG[slug]) || CircleHelp;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
