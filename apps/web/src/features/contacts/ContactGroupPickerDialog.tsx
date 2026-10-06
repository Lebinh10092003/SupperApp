/**
 * ContactGroupPickerDialog.tsx — modal "Sổ danh bạ" mở cạnh các ô tìm
 * người (PersonPicker/PeopleMultiPicker). Viết lại 2026-10-05 (Sin, kèm
 * ảnh chụp lỗi UI thật):
 *   - Modal to/rõ ràng hơn hẳn (sm:max-w-2xl thay vì sm:max-w-lg) — tránh
 *     đúng lỗi tràn/đè lên nút ở dưới khi danh sách gợi ý dài.
 *   - Có thanh TÌM KIẾM ngay đầu modal (trước đây chỉ có ô tìm nhỏ ẩn
 *     trong "Thêm người" của từng nhóm) — gõ là ra kết quả ngay, không cần
 *     mở từng nhóm.
 *   - Chọn ĐƯỢC NHIỀU người cùng lúc (trước đây bấm 1 người là đóng modal
 *     ngay, kể cả khi đang ở chế độ chọn nhiều) — dùng `onPickMultiple` +
 *     nút "Xong" ở cuối; `onPick` (chọn đúng 1 người, đóng ngay) vẫn giữ
 *     cho nơi gọi chỉ cần 1 người (VD "Chủ trì").
 *   - `selected` — hiện SẴN những người đã chọn từ bên ngoài (nếu có) khi
 *     mở modal, đúng yêu cầu "input sẵn những người đã chọn ở ngoài".
 *   - Nút "Quản lý sổ danh bạ" (icon bánh răng ở header) mở sang màn hình
 *     quản lý nhóm (tạo/đổi tên/xoá nhóm, thêm/xoá thành viên) — TÁCH khỏi
 *     màn hình chọn người chính, đúng yêu cầu "nút settings... quản lý mục
 *     danh bạ riêng".
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, Mail, Phone, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { PersonOption } from '../safety/PersonPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  renameContactGroup,
  type ContactDetail,
  type ContactGroup
} from './api';

// Khớp đúng ROLES_USER_MANAGEMENT ở apps/web/src/app/App.tsx — cùng tập
// vai trò được backend cấp capability MANAGE_USERS (contacts.routes.ts).
function usePeopleSearch(query: string) {
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<{ results: PersonOption[] }>(`/api/safety/people/search?q=${encodeURIComponent(q)}`)
        .then((res) => !cancelled && setOptions(res.results || []))
        .catch(() => !cancelled && setOptions([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);
  return { options, loading };
}

/** 1 dòng người — dùng chung cho kết quả tìm kiếm lẫn thành viên nhóm. Chế
 * độ nhiều (`multi`) hiện checkbox, chế độ 1 (!multi) chỉ cần bấm là chọn
 * luôn (đóng modal ngay ở nơi gọi). */
function PersonRow({
  person,
  detail,
  multi,
  checked,
  onToggle
}: {
  person: PersonOption;
  detail?: ContactDetail;
  multi: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800',
        checked && multi && 'bg-secondary/60'
      )}
    >
      {multi && (
        <span
          className={cn(
            'grid size-4 shrink-0 place-items-center rounded border-2',
            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-slate-300'
          )}
        >
          {checked && <Check className="size-3" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{person.name}</p>
        {detail && (detail.email || detail.phone) && (
          <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
            {detail.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3" /> {detail.email}
              </span>
            )}
            {detail.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {detail.phone}
              </span>
            )}
          </p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------
// Màn hình QUẢN LÝ — tạo/đổi tên/xoá nhóm, thêm/xoá thành viên. Mở từ
// nút bánh răng trong màn hình chọn người, KHÔNG xen vào luồng chọn.
// ---------------------------------------------------------------------
export function ContactGroupsManager({ canCreateSchoolGroup, onBack }: { canCreateSchoolGroup: boolean; onBack?: () => void }) {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [details, setDetails] = useState<Record<string, ContactDetail>>({});
  const [loading, setLoading] = useState(true);
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
  useEffect(load, []);

  return (
    <div className="flex flex-col gap-3">
      {onBack && <Button variant="ghost" size="sm" className="w-fit px-1.5 text-slate-500" onClick={onBack}><ArrowLeft className="size-3.5" />Quay lại chọn người</Button>}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Đang tải...
        </div>
      )}

      {!loading &&
        groups.map((g) => (
          <ManageGroupSection
            key={g.groupId}
            group={g}
            details={details}
            canManage={g.mine || (g.scope === 'school' && canCreateSchoolGroup)}
            onChanged={load}
          />
        ))}

      {!loading && !creating && (
        <Button variant="ghost" size="sm" className="w-fit px-1.5 text-primary" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          Nhóm mới
        </Button>
      )}
      {!loading && creating && (
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
  );
}

function ManageGroupSection({
  group,
  details,
  canManage,
  onChanged
}: {
  group: ContactGroup;
  details: Record<string, ContactDetail>;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const { options, loading: searching } = usePeopleSearch(q);

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        {renaming ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-7 text-sm"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && nameDraft.trim()) {
                  await renameContactGroup(group.groupId, nameDraft.trim());
                  setRenaming(false);
                  onChanged();
                }
              }}
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!nameDraft.trim()}
              onClick={async () => {
                await renameContactGroup(group.groupId, nameDraft.trim());
                setRenaming(false);
                onChanged();
              }}
            >
              Lưu
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRenaming(false)}>
              Huỷ
            </Button>
          </div>
        ) : (
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
        )}
        {canManage && !renaming && !confirmingDelete && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" className="text-slate-400 hover:text-primary" onClick={() => setRenaming(true)}>
                  <Plus className="size-3.5 rotate-45" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Đổi tên</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" className="text-slate-400 hover:text-red-500" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Xoá nhóm</TooltipContent>
            </Tooltip>
          </div>
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
            <div key={perId} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
              <div className="min-w-0 flex-1">
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
              </div>
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

      {canManage && !adding && (
        <Button variant="ghost" size="sm" className="mt-2 w-fit px-1.5 text-primary" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          Thêm người
        </Button>
      )}
      {canManage && adding && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
          <Input autoFocus placeholder="Gõ tên để tìm..." value={q} onChange={(e) => setQ(e.target.value)} />
          {searching && <Loader2 className="size-4 animate-spin text-slate-400" />}
          {!searching && q.trim().length >= 2 && options.length === 0 && <p className="text-xs text-slate-500">Không tìm thấy.</p>}
          <div className="flex flex-col gap-1">
            {options.map((o) => (
              <button
                key={o.perId}
                type="button"
                onClick={async () => {
                  await addContactGroupMember(group.groupId, o.perId);
                  setAdding(false);
                  setQ('');
                  onChanged();
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Màn hình CHỌN NGƯỜI — mặc định khi mở modal.
// ---------------------------------------------------------------------
function PickPeopleView({
  multi,
  selected,
  onPick,
  onConfirmMultiple
}: {
  multi: boolean;
  selected: PersonOption[];
  onPick?: (p: PersonOption) => void;
  onConfirmMultiple?: (people: PersonOption[]) => void;
}) {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [details, setDetails] = useState<Record<string, ContactDetail>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { options: searchResults, loading: searching } = usePeopleSearch(query);
  // Giỏ chọn RIÊNG của modal — khởi tạo từ `selected` truyền vào ngoài
  // (Sin yêu cầu "input sẵn những người đã chọn ở ngoài nếu có"), chỉ áp
  // dụng khi đóng bằng nút "Xong" (không ảnh hưởng form cha cho tới lúc đó).
  const [picked, setPicked] = useState<PersonOption[]>(selected);
  const [pickedGroupIds, setPickedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    listContactGroups()
      .then(async (results) => {
        setGroups(results);
        const allPerIds = Array.from(new Set(results.flatMap((g) => g.perIds)));
        setDetails(await fetchContactDetails(allPerIds));
      })
      .finally(() => setLoading(false));
  }, []);

  const detailsByPerId = useMemo(() => {
    const merged = { ...details };
    for (const p of searchResults) if (!merged[p.perId] && p.email) merged[p.perId] = { perId: p.perId, name: p.name, email: p.email, phone: null };
    return merged;
  }, [details, searchResults]);

  const isChecked = (perId: string) => picked.some((p) => p.perId === perId);
  const handleToggle = (person: PersonOption) => {
    if (!multi) {
      onPick?.(person);
      return;
    }
    setPickedGroupIds((previous) => previous.filter((groupId) => !groups.find((group) => group.groupId === groupId)?.perIds.includes(person.perId)));
    setPicked((prev) => (prev.some((p) => p.perId === person.perId) ? prev.filter((p) => p.perId !== person.perId) : [...prev, person]));
  };

  const pickedGroupPeople = new Set(groups.filter((group) => pickedGroupIds.includes(group.groupId)).flatMap((group) => group.perIds));
  const individuallyPicked = picked.filter((person) => !pickedGroupPeople.has(person.perId));
  const visiblePoolItems = individuallyPicked.slice(0, Math.max(0, 4 - pickedGroupIds.length));
  const hiddenPoolCount = individuallyPicked.length - visiblePoolItems.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Tìm theo tên hoặc email..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>

      {multi && picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {groups.filter((group) => pickedGroupIds.includes(group.groupId)).slice(0, 4).map((group) => (
            <Badge key={group.groupId} variant="outline" className="gap-1 border-transparent bg-violet-50 text-violet-700">
              <Users className="size-3" />{group.name}
              <span role="button" tabIndex={-1} onClick={() => { setPickedGroupIds((previous) => previous.filter((id) => id !== group.groupId)); setPicked((previous) => previous.filter((person) => !group.perIds.includes(person.perId))); }}><X className="size-3" /></span>
            </Badge>
          ))}
          {visiblePoolItems.map((p) => (
            <Badge key={p.perId} variant="outline" className="gap-1 border-transparent bg-secondary text-[#1d4ed8]">
              {p.name}
              <span role="button" tabIndex={-1} onClick={() => setPicked((prev) => prev.filter((x) => x.perId !== p.perId))}>
                <X className="size-3" />
              </span>
            </Badge>
          ))}
          {hiddenPoolCount > 0 && <Badge variant="outline" className="border-transparent bg-slate-100 text-slate-600" title={individuallyPicked.slice(visiblePoolItems.length).map((person) => person.name).join(', ')}>+{hiddenPoolCount} người khác</Badge>}
        </div>
      )}

      {query.trim().length >= 2 && (
        <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          <p className="mb-1 px-1 text-xs font-bold tracking-wide text-slate-500 uppercase">Kết quả tìm kiếm</p>
          {searching && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Đang tìm...
            </div>
          )}
          {!searching && searchResults.length === 0 && <p className="px-1 py-1 text-xs text-slate-500">Không tìm thấy.</p>}
          {!searching &&
            searchResults.map((p) => (
              <PersonRow key={p.perId} person={p} detail={detailsByPerId[p.perId]} multi={multi} checked={isChecked(p.perId)} onToggle={() => handleToggle(p)} />
            ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Đang tải...
        </div>
      )}

      {!loading &&
        groups.map((g) => {
          const groupPeople = g.perIds.map((perId) => ({ perId, name: details[perId]?.name || perId }));
          const allSelected = groupPeople.length > 0 && groupPeople.every((person) => isChecked(person.perId));
          const toggleGroup = () => {
            const groupIds = new Set(groupPeople.map((person) => person.perId));
            if (allSelected) {
              setPickedGroupIds((ids) => ids.filter((id) => id !== g.groupId));
              setPicked((previous) => previous.filter((person) => !groupIds.has(person.perId)));
              return;
            }
            setPickedGroupIds((ids) => [...new Set([...ids, g.groupId])]);
            setPicked((previous) => {
              const merged = new Map(previous.map((person) => [person.perId, person]));
              for (const person of groupPeople) merged.set(person.perId, person);
              return [...merged.values()];
            });
          };
          return (
          <div key={g.groupId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5"><p className="text-sm font-bold">{g.name}</p>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px] font-bold',
                  g.scope === 'school' ? 'bg-secondary text-primary' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {g.scope === 'school' ? 'Toàn trường' : 'Của tôi'}
              </span>
              </div>
              {multi && g.perIds.length > 0 && <Button variant={allSelected ? 'secondary' : 'outline'} size="sm" className="h-7 text-xs" onClick={toggleGroup}>{allSelected ? 'Bỏ chọn nhóm' : `Chọn nhóm (${g.perIds.length})`}</Button>}
            </div>
            {g.perIds.length === 0 && <p className="text-xs text-slate-400">Chưa có ai trong nhóm.</p>}
            {g.perIds.map((perId) => {
              const d = details[perId];
              const person: PersonOption = { perId, name: d?.name || perId };
              return <PersonRow key={perId} person={person} detail={d} multi={multi} checked={isChecked(perId)} onToggle={() => handleToggle(person)} />;
            })}
          </div>
          );
        })}

      {multi && (
        <DialogFooter>
          <Button disabled={picked.length === 0} onClick={() => onConfirmMultiple?.(picked)}>
            Xong — đã chọn {picked.length} người
          </Button>
        </DialogFooter>
      )}
    </div>
  );
}

export function ContactGroupPickerButton({
  onPick,
  onPickMultiple,
  selected
}: {
  /** Chọn ĐÚNG 1 người, đóng modal ngay — dùng cho ô chỉ nhận 1 người (VD "Chủ trì"). */
  onPick?: (person: PersonOption) => void;
  /** Chọn NHIỀU người, chỉ áp dụng khi bấm "Xong" — dùng cho ô nhiều người. */
  onPickMultiple?: (people: PersonOption[]) => void;
  /** Người đã chọn sẵn từ ngoài (chế độ nhiều) — hiện checked ngay khi mở modal. */
  selected?: PersonOption[];
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const multi = !!onPickMultiple;

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => handleOpenChange(true)}>
            <Users className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Chọn từ sổ danh bạ</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] min-w-0 overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Sổ danh bạ</DialogTitle></DialogHeader>
          <Button variant="ghost" size="sm" className="w-fit px-1 text-primary" onClick={() => { setOpen(false); navigate('/settings?section=contacts'); }}>
            Chỉnh sửa sổ danh bạ trong Cài đặt
          </Button>
          <PickPeopleView
              multi={multi}
              selected={selected || []}
              onPick={(p) => {
                onPick?.(p);
                setOpen(false);
              }}
              onConfirmMultiple={(people) => {
                onPickMultiple?.(people);
                setOpen(false);
              }}
            />
        </DialogContent>
      </Dialog>
    </>
  );
}
