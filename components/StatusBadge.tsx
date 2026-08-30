import { label, colorFor } from "@/lib/format";
import { Circle, Clock, AlertTriangle, MapPin, Layers, CheckCircle2, Wallet, XCircle, PauseCircle } from "lucide-react";

const STATUS_ICON: Record<string, any> = {
  BOOKED: Circle,
  ARRIVED: MapPin,
  VERIFIED: CheckCircle2,
  WEIGHING: Layers,
  PROCUREMENT_IN_PROGRESS: Layers,
  PROCUREMENT_COMPLETED: CheckCircle2,
  PAYMENT_PROCESSING: Wallet,
  PAYMENT_COMPLETED: Wallet,
  CANCELLED: XCircle,
  NO_SHOW: AlertTriangle,
  PENDING: Clock,
  PROCESSING: Wallet,
  PAID: CheckCircle2,
  FAILED: XCircle,
  ON_HOLD: PauseCircle,
};

export default function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICON[status] || Circle;
  return (
    <span className={`badge ${colorFor(status)}`}>
      <Icon size={12} strokeWidth={2.5} />
      {label(status)}
    </span>
  );
}
