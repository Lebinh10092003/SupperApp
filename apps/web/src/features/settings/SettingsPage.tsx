import { useEffect, useState } from 'react';
import { BookUser, Palette } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { ContactGroupsManager } from '../contacts/ContactGroupPickerDialog';
import { AppearanceSettings } from '../../layout/SettingsPanel';
import { cn } from '@/lib/utils';

type Section = 'contacts' | 'appearance';
const MANAGE_SCHOOL_GROUP_ROLES = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const [section, setSection] = useState<Section>(requested === 'contacts' ? 'contacts' : 'appearance');
  const { profile } = useAuth();
  useEffect(() => { if (requested === 'contacts' || requested === 'appearance') setSection(requested); }, [requested]);
  const select = (next: Section) => { setSection(next); setParams({ section: next }, { replace: true }); };

  return <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[220px_1fr]">
    <aside className="h-fit rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
      {([{ id: 'appearance', label: 'Giao diện', icon: Palette }, { id: 'contacts', label: 'Quản lý sổ danh bạ', icon: BookUser }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => select(id)} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold', section === id ? 'bg-secondary text-primary' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900')}><Icon className="size-4" />{label}</button>)}
    </aside>
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5"><h1 className="text-xl font-bold">{section === 'contacts' ? 'Quản lý sổ danh bạ' : 'Giao diện'}</h1><p className="mt-1 text-sm text-slate-500">{section === 'contacts' ? 'Tạo nhóm và quản lý thành viên dùng chung trong các bộ chọn người.' : 'Chọn chế độ sáng/tối và cỡ chữ phù hợp.'}</p></div>
      {section === 'appearance' ? <AppearanceSettings /> : <ContactGroupsManager canCreateSchoolGroup={MANAGE_SCHOOL_GROUP_ROLES.includes(profile?.role || '')} />}
    </section>
  </div>;
}
