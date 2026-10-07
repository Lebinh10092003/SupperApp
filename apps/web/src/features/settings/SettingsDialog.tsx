import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SettingsContent, type SettingsSection } from './SettingsContent';

export function SettingsDialog({ open, onOpenChange, initialSection = 'appearance' }: { open: boolean; onOpenChange: (open: boolean) => void; initialSection?: SettingsSection }) {
  const [section, setSection] = useState<SettingsSection>(initialSection);

  useEffect(() => {
    if (open) setSection(initialSection);
  }, [initialSection, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-auto max-h-[90dvh] w-[94vw] max-w-[94vw] flex-col gap-4 overflow-hidden p-4 sm:max-h-[88dvh] sm:w-[min(94vw,960px)] sm:max-w-[960px] sm:p-6">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>Cài đặt</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-0.5">
          <SettingsContent section={section} onSectionChange={setSection} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
