import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import {
  Package,
  Warehouse,
  ClipboardCheck,
  ArrowLeftRight,
  RefreshCw,
  ShoppingCart,
  Factory,
  MapPin,
} from 'lucide-react';

export function ProductsPage() {
  return (
    <ModulePlaceholder
      title="Products"
      description="Catalogue, variants, barcodes and pricing."
      icon={Package}
      phase="Phase 2"
      legacyRefs={[
        'Product/variant model; barcode unique (case-insensitive) (BR-PRD-01).',
        'Low-stock threshold default 5 (DEF-023 / BR-STK-04).',
      ]}
    />
  );
}

export function StockPage() {
  return (
    <ModulePlaceholder
      title="Stock"
      description="Location-aware stock and the movement ledger."
      icon={Warehouse}
      phase="Phase 2"
      legacyRefs={['Stock per (product, variant, location); movements immutable (BR-STK-01/02).']}
    />
  );
}

export function StockCountPage() {
  return (
    <ModulePlaceholder
      title="Stock Count"
      description="Physical count and reconciliation."
      icon={ClipboardCheck}
      phase="Phase 4"
      legacyRefs={['Zero-difference count rejected; diff recomputed at apply (BR-STK-10).']}
    />
  );
}

export function TransfersPage() {
  return (
    <ModulePlaceholder
      title="Stock Transfers"
      description="Move stock between locations."
      icon={ArrowLeftRight}
      phase="Phase 4"
      legacyRefs={['transfer_out + transfer_in, atomic, referencing one transfer id (BR-STK-08).']}
    />
  );
}

export function ReorderPage() {
  return (
    <ModulePlaceholder
      title="Reorder Planning"
      description="Velocity-based reorder suggestions."
      icon={RefreshCw}
      phase="Phase 4"
      legacyRefs={['suggestedQty = max(0, ceil(velocity × targetDays − stock)) (BR-STK-13).']}
    />
  );
}

export function PurchasesPage() {
  return (
    <ModulePlaceholder
      title="Purchases"
      description="Record supplier purchases."
      icon={ShoppingCart}
      phase="Phase 4"
      legacyRefs={['purchasePrice updates only on base-unit lines (BR-PUR-05).']}
    />
  );
}

export function SuppliersPage() {
  return (
    <ModulePlaceholder
      title="Suppliers"
      description="Supplier directory and payables."
      icon={Factory}
      phase="Phase 3"
      legacyRefs={['Delete is admin/owner only (BR-CUS-03).']}
    />
  );
}

export function LocationsPage() {
  return (
    <ModulePlaceholder
      title="Locations"
      description="Shops and warehouses."
      icon={MapPin}
      phase="Phase 2"
      legacyRefs={['At least one location always exists; archive instead of hard delete (BR-LOC-01/02).']}
    />
  );
}
