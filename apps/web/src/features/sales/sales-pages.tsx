import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import {
  FilePlus2,
  FileText,
  FileSpreadsheet,
  Truck,
  FileMinus,
  FilePlus,
  Wallet,
  CircleDollarSign,
} from 'lucide-react';

export function NewInvoicePage() {
  return (
    <ModulePlaceholder
      title="New Bill"
      description="Create a customer invoice."
      icon={FilePlus2}
      phase="Phase 3"
      legacyRefs={[
        'New Bill opens as Without GST by default (DEF-016 / BR-INV-01).',
        'Separate GST and Non-GST numbering series (BR-NUM-01).',
        'Line GST rate snapshotted when added; stock shortage & credit limit warn, never block (BR-INV-05/06).',
      ]}
    />
  );
}

export function InvoicesPage() {
  return (
    <ModulePlaceholder
      title="Invoices"
      description="Manage customer invoices and payments."
      icon={FileText}
      phase="Phase 3"
      legacyRefs={['Edit is undo-then-reapply; delete reverses stock + journals (BR-INV-11/13).']}
    />
  );
}

export function QuotationsPage() {
  return (
    <ModulePlaceholder
      title="Quotations"
      description="Prepare and convert quotations."
      icon={FileSpreadsheet}
      phase="Phase 4"
      legacyRefs={['Never touch stock/accounting; convert to invoice (BR-QUO-02/03).']}
    />
  );
}

export function DeliveryNotesPage() {
  return (
    <ModulePlaceholder
      title="Delivery Notes"
      description="Dispatch goods before a tax invoice."
      icon={Truck}
      phase="Phase 4"
      legacyRefs={['Stock out on save; no GST; pending → invoiced/returned (BR-DN-01/03).']}
    />
  );
}

export function CreditNotesPage() {
  return (
    <ModulePlaceholder
      title="Credit Notes"
      description="Issue credit against an invoice."
      icon={FileMinus}
      phase="Phase 4"
      legacyRefs={['Inherit original invoice tax type; restock optional (BR-CN-02/04).']}
    />
  );
}

export function DebitNotesPage() {
  return (
    <ModulePlaceholder
      title="Debit Notes"
      description="Issue debit against a purchase."
      icon={FilePlus}
      phase="Phase 4"
      legacyRefs={['No GST math: amount = qty × rate (BR-DBN-02).']}
    />
  );
}

export function PaymentsPage() {
  return (
    <ModulePlaceholder
      title="Payments"
      description="Record customer and supplier payments."
      icon={Wallet}
      phase="Phase 3"
      legacyRefs={['payment_in / payment_out journals respect the real payment mode (BR-PAY-03/04).']}
    />
  );
}

export function DuesPage() {
  return (
    <ModulePlaceholder
      title="Outstanding Dues"
      description="Receivables and payables."
      icon={CircleDollarSign}
      phase="Phase 3"
      legacyRefs={['Outstanding when gap > 50 paise; Due Soon ≤ 7 days (BR-DUE-02/04).']}
    />
  );
}
