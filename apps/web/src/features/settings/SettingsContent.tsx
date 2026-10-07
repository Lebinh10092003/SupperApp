import { BookUser, Palette } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { ContactGroupsManager } from '../contacts/ContactGroupPickerDialog';
import { AppearanceSettings } from '../../layout/SettingsPanel';
import { cn } from '@/lib/utils';

export type SettingsSection = 'contacts' | 'appearance';

const MANAGE_SCHOOL_GROUP_ROLES = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

export function SettingsContent({ section, onSectionChange }: { section: SettingsSection; onSectionChange: (section: SettingsSection) => void }) {
  const { profile } = useAuth();

  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Mục cài đặt" className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950 md:block md:h-fit md:space-y-1">
        {([
          { id: 'appearance', label: 'Giao diện', icon: Palette },
          { id: 'contacts', label: 'Quản lý sổ danh bạ', icon: BookUser },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors md:w-full',
              section === id
                ? 'bg-secondary text-primary'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:p-5">
        <div className="mb-5">
          <h2 className="text-xl font-bold">{section === 'contacts' ? 'Quản lý sổ danh bạ' : 'Giao diện'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {section === 'contacts'
              ? 'Tạo nhóm và quản lý thành viên dùng chung trong các bộ chọn người.'
              : 'Chọn chế độ sáng/tối và cỡ chữ phù hợp.'}
          </p>
        </div>
        {section === 'appearance' ? <AppearanceSettings /> : <ContactGroupsManager canCreateSchoolGroup={MANAGE_SCHOOL_GROUP_ROLES.includes(profile?.role || '')} />}
      </section>
    </div>
  );
}
