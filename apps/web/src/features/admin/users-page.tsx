/**
 * Members management page (Phase 10, TD §3.3, BR-PRM-*). Lets admins/owners view, invite,
 * activate/deactivate, and change roles of members. Owner protection enforced server-side
 * (BR-PRM-06/07/08): admins cannot demote owners, members cannot change their own membership.
 *
 * No direct Firestore writes — all mutations go through the createMember/updateMember/
 * setMemberActive callables (Phase 2, reused here for the Settings UI).
 */
import { useMemo, useState } from 'react';
import { Users, UserCheck, UserX, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { Member } from '@hynish/domain';
import { ROLES } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Field } from '@/components/forms/field';
import { DataList, type Column } from '@/components/data/data-list';
import { RowActions, type RowAction } from '@/components/data/row-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { useRepositories, useAdminService } from '@/hooks/use-master-data';
import { useAuthStore } from '@/stores/auth-store';
import { usePagedList } from '@/hooks/use-paged-list';
import { mapCallableError } from '@/lib/errors';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';

const PARAMS: ListParams = { orderByField: 'email', direction: 'asc', limit: 50, filters: [] };

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager',
  accountant: 'Accountant', shop: 'Shop Staff', staff: 'Staff',
};

function roleBadge(role: string) {
  const variant = role === 'owner' ? 'default' : role === 'admin' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{ROLE_LABELS[role] ?? role}</Badge>;
}

export function UsersPage() {
  const repos = useRepositories();
  const service = useAdminService();
  const currentUid = useAuthStore((s) => s.user?.uid);
  const can = useAuthStore((s) => s.hasPermission);
  const canManage = can('members.manage');
  const { items, loading, error, refresh, hasMore, loadMore, loadingMore } = usePagedList(repos.members, useMemo(() => PARAMS, []));
  const [busy, setBusy] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUid, setInviteUid] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('staff');

  async function handleInvite() {
    if (!inviteUid.trim() || !inviteEmail.trim()) return;
    setBusy(true);
    try {
      await service.members.create({ uid: inviteUid.trim(), email: inviteEmail.trim(), displayName: inviteName.trim() || inviteEmail.trim(), role: inviteRole, locationIds: null });
      toast.success('Member added');
      setInviteOpen(false);
      setInviteUid(''); setInviteEmail(''); setInviteName(''); setInviteRole('staff');
      refresh();
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(m: Member) {
    const activate = !m.active;
    if (m.uid === currentUid) { toast.error("You cannot change your own active status."); return; }
    setBusy(true);
    try {
      await service.members.setActive(m.uid, activate);
      toast.success(activate ? 'Member activated' : 'Member deactivated');
      refresh();
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Member>[] = [
    { header: 'Name / Email', cell: (m) => <div className="min-w-0"><div className="truncate font-medium">{m.displayName ?? m.email}</div><div className="truncate text-xs text-muted-foreground">{m.email}</div></div> },
    { header: 'Role', cell: (m) => roleBadge(m.role) },
    { header: 'Locations', cell: (m) => m.locationIds === null ? <span className="text-xs text-muted-foreground">All</span> : <span className="text-xs">{m.locationIds.length} location(s)</span> },
    { header: 'Status', cell: (m) => m.active ? <Badge variant="outline" className="text-success border-success gap-1"><UserCheck className="size-3" />Active</Badge> : <Badge variant="outline" className="text-destructive border-destructive gap-1"><UserX className="size-3" />Inactive</Badge> },
  ];

  function actionsFor(m: Member): RowAction[] {
    const actions: RowAction[] = [];
    if (!canManage || m.uid === currentUid) return actions;
    if (m.active) {
      actions.push({ label: 'Deactivate', icon: 'archive', danger: true, onSelect: () => void toggleActive(m) });
    } else {
      actions.push({ label: 'Activate', icon: 'restore', onSelect: () => void toggleActive(m) });
    }
    return actions;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        description="Roles, permissions and location access for your business."
        actions={canManage && (
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <ShieldCheck className="size-4" />
            Add Member
          </Button>
        )}
      />

      <SectionCard>
        <DataList
          items={items}
          getRowId={(m) => m.uid}
          columns={columns}
          renderCard={(m) => (
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{m.displayName ?? m.email}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                <div className="mt-1 flex gap-2">{roleBadge(m.role)}</div>
              </div>
              {canManage && m.uid !== currentUid && (
                <RowActions actions={actionsFor(m)} />
              )}
            </div>
          )}
          rowActions={(m) => canManage && m.uid !== currentUid ? <RowActions actions={actionsFor(m)} /> : null}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onRetry={refresh}
          hasMore={hasMore}
          onLoadMore={loadMore}
          empty={{ title: 'No members', description: 'Add a member to get started.', icon: Users }}
        />
      </SectionCard>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <Field label="Firebase UID" htmlFor="inviteUid" required hint="The user must already have a Firebase Auth account.">
              <Input id="inviteUid" value={inviteUid} onChange={(e) => setInviteUid(e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="inviteEmail" required>
              <Input id="inviteEmail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </Field>
            <Field label="Display Name" htmlFor="inviteName">
              <Input id="inviteName" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </Field>
            <Field label="Role" htmlFor="inviteRole">
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="inviteRole"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== 'owner').map((r) => (
                    <SelectItem key={r} value={r}><span className="flex items-center gap-2"><ShieldAlert className="size-3 text-muted-foreground" />{ROLE_LABELS[r] ?? r}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={busy || !inviteUid.trim() || !inviteEmail.trim()}>
              {busy ? 'Adding…' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
