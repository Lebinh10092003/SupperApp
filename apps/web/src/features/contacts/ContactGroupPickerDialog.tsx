/**
 * ContactGroupPickerDialog.tsx — modal "Sổ danh bạ" mở cạnh các ô tìm
 * người (PersonPicker/PeopleMultiPicker), bổ sung 2026-10-02 (Sin: "cạnh
 * mấy cái input search người có một cái nút modal mở để chọn người cho dễ
 * và hiển thị chi tiết"). Duyệt theo NHÓM LIÊN HỆ thay vì gõ tên — nhóm
 * toàn trường (BGH tạo, ai cũng thấy) + nhóm cá nhân tự tạo. Thành viên
 * luôn là người có sẵn trong hệ thống (accounts.perId) — chọn người để
 * thêm vào nhóm qua `/api/safety/people/search` (giống PersonPicker).
 * "Chi tiết" hiển thị = email/SĐT (tra qua `/api/safety/people/contact`,
 * cùng nguồn dữ liệu ContactInfoButton.tsx đang dùng).
 */
import { useEffect, useState } from 'react';
import { Loader2, Mail, Phone, Plus, Trash2, Users, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../auth/AuthProvider';
import type { PersonOption } from '../safety/PersonPicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  addContactGroupMember,
  createContactGroup,
  deleteContactGroup,
  fetchContactDetails,
  listContactGroups,
  removeContactGroupMember,
  type ContactDetail,
  type ContactGroup
} from './api';

// Khớp đúng ROLES_USER_MANAGEMENT ở apps/web/src/app/App.tsx — cùng tập
// vai trò được backend cấp capability MANAGE_USERS (contacts.routes.ts).
const CAN_MANAGE_SCHOOL_GROUPS = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

function GroupAddMemberRow({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .get<{ results: PersonOption[] }>(`/api/safety/people/search?q=${encodeURIComponent(query)}`)
        .then((res) => !cancelled && setOptions(res.results || []))
        .catch(() => !cancelled && setOptions([]))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  if (!adding) {
    return (
      <Button variant="ghost" size="sm" className="w-fit px-1.5 text-primary" onClick={() => setAdding(true)}>
        <Plus className="size-3.5" />
        Thêm người
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
      <Input autoFocus placeholder="Gõ tên để tìm..." value={q} onChange={(e) => setQ(e.target.value)} />
      {searching && <Loader2 className="size-4 animate-spin text-slate-400" />}
      {!searching && q.trim().length >= 2 && options.length === 0 && (
        <p className="text-xs text-slate-500">Không tìm thấy.</p>
      )}
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <button
            key={o.perId}
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await addContactGroupMember(groupId, o.perId);
                setAdding(false);
                setQ('');
                setOptions([]);
                onAdded();
              } finally {
                setSaving(false);
              }
            }}
            className="rounded px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {o.name}
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="w-fit px-1.5 text-slate-500" onClick={() => setAdding(false)}>
        Huỷ
      </Button>
    </div>
  );
}

function GroupSection({
  group,
  details,
  canManage,
  onPick,
  onChanged
}: {
  group: ContactGroup;
  details: Record<string, ContactDetail>;
  canManage: boolean;
  onPick: (person: PersonOption) => void;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  // Xác nhận xoá nằm NGAY TRONG UI (2 bước: bấm thùng rác -> hiện nút
  // "Xác nhận"/"Huỷ") thay vì window.confirm() — dự án đã cố tình bỏ hộp
  // thoại mặc định của trình duyệt vì nó CHẶN toàn bộ renderer/sự kiện
  // (gặp thật khi tự QA: tab treo cứng, không thao tác gì tiếp được).
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold">{group.name}</p>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[11px] font-bold',
              group.scope === 'school' ? 'bg-secondary text-primary' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            {group.scope === 'school' ? 'Toàn trường' : 'Của tôi'}
          </span>
        </div>
        {canManage && !confirmingDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-slate-400 hover:text-red-500"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Xoá nhóm</TooltipContent>
          </Tooltip>
        )}
        {canManage && confirmingDelete && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Xoá nhóm?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await deleteContactGroup(group.groupId);
                  onChanged();
                } finally {
                  setDeleting(false);
                  setConfirmingDelete(false);
                }
              }}
            >
              Xác nhận
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
              Huỷ
            </Button>
          </div>
        )}
      </div>

      {group.perIds.length === 0 && <p className="mb-2 text-xs text-slate-400">Chưa có ai trong nhóm.</p>}

      <div className="flex flex-col gap-1">
        {group.perIds.map((perId) => {
          const d = details[perId];
          return (
            <div
              key={perId}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onPick({ perId, name: d?.name || perId })}
              >
                <p className="truncate text-sm font-medium">{d?.name || perId}</p>
                <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                  {d?.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" /> {d.email}
                    </span>
                  )}
                  {d?.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" /> {d.phone}
                    </span>
                  )}
                  {!d?.email && !d?.phone && <span className="text-slate-400">Chưa có email/SĐT</span>}
                </p>
              </button>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-slate-400 hover:text-red-500"
                  onClick={async () => {
                    await removeContactGroupMember(group.groupId, perId);
                    onChanged();
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {canManage && <div className="mt-2">{<GroupAddMemberRow groupId={group.groupId} onAdded={onChanged} />}</div>}
    </div>
  );
}

export function ContactGroupPickerButton({ onPick }: { onPick: (person: PersonOption) => void }) {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const canCreateSchoolGroup = CAN_MANAGE_SCHOOL_GROUPS.includes(profile?.role || '');

  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [details, setDetails] = useState<Record<string, ContactDetail>>({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'personal' | 'school'>('personal');

  const load = () => {
    setLoading(true);
    listContactGroups()
      .then(async (results) => {
        setGroups(results);
        const allPerIds = Array.from(new Set(results.flatMap((g) => g.perIds)));
        setDetails(await fetchContactDetails(allPerIds));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)}>
            <Users className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Chọn từ sổ danh bạ</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sổ danh bạ</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          )}

          {!loading && (
            <div className="flex flex-col gap-3">
              {groups.map((g) => (
                <GroupSection
                  key={g.groupId}
                  group={g}
                  details={details}
                  canManage={g.mine || (g.scope === 'school' && canCreateSchoolGroup)}
                  onPick={(p) => {
                    onPick(p);
                    setOpen(false);
                  }}
                  onChanged={load}
                />
              ))}

              {!creating && (
                <Button variant="ghost" size="sm" className="w-fit px-1.5 text-primary" onClick={() => setCreating(true)}>
                  <Plus className="size-3.5" />
                  Nhóm mới
                </Button>
              )}
              {creating && (
                <div className="flex flex-col gap-2 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
                  <Input autoFocus placeholder="Tên nhóm..." value={newName} onChange={(e) => setNewName(e.target.value)} />
                  {canCreateSchoolGroup && (
                    <div className="flex gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setNewScope('personal')}
                        className={cn(
                          'rounded border px-2 py-1 font-semibold',
                          newScope === 'personal' ? 'border-primary bg-secondary text-primary' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                        )}
                      >
                        Của riêng tôi
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewScope('school')}
                        className={cn(
                          'rounded border px-2 py-1 font-semibold',
                          newScope === 'school' ? 'border-primary bg-secondary text-primary' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                        )}
                      >
                        Toàn trường
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!newName.trim()}
                      onClick={async () => {
                        await createContactGroup(newName.trim(), newScope);
                        setNewName('');
                        setCreating(false);
                        setNewScope('personal');
                        load();
                      }}
                    >
                      Tạo nhóm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                      Huỷ
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
