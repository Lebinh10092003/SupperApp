import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('all explicit filter popovers use the responsive shared shell', () => {
  for (const path of [
    'src/features/safety/CasesListPage.tsx',
    'src/features/work-schedule/EventsListPage.tsx',
    'src/features/work-schedule/ExamSchedulePage.tsx',
    'src/features/work-schedule/TasksListPage.tsx'
  ]) {
    const source = read(path);
    assert.match(source, /<FilterPopover/);
    assert.doesNotMatch(source, /<PopoverContent[^>]+w-\[(?:320|340)px\]/);
  }
  const shell = read('src/components/FilterPopover.tsx');
  assert.match(shell, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(shell, /calc\(100vw-2rem\)/);
});

test('dialog and person-picker primitives prevent clipping and overlay footers', () => {
  const dialog = read('src/components/ui/dialog.tsx');
  assert.match(dialog, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(dialog, /overflow-x-hidden overflow-y-auto/);
  assert.match(read('src/features/safety/PersonPicker.tsx'), /min-w-0 flex-1 justify-between overflow-hidden/);

  for (const path of [
    'src/features/work-schedule/EventsListPage.tsx',
    'src/features/work-schedule/components/WorkScheduleImportDialogV4.tsx'
  ]) {
    assert.doesNotMatch(read(path), /<DialogFooter[^>]*sticky/);
  }
});

test('work assignment table has no redundant row action menu', () => {
  const source = read('src/features/work-schedule/TasksListPage.tsx');
  assert.doesNotMatch(source, /MoreHorizontal/);
  assert.doesNotMatch(source, /DropdownMenu/);
  assert.match(source, /<TableRow key=\{t\.id\} className="cursor-pointer" onClick=\{\(\) => setDetail\(t\)\}>/);
});

test('school-wide visibility is functional and shared by all four calendar views', () => {
  const page = read('src/features/work-schedule/EventsListPage.tsx');
  for (const view of ["['day', 'Ngày']", "['week', 'Tuần']", "['month', 'Tháng']", "['agenda', 'Lịch biểu']"]) {
    assert.ok(page.includes(view), `missing calendar view ${view}`);
  }
  assert.match(page, /<Switch checked=\{showSchoolWide\}/);
  assert.match(page, /includeSchoolWide: showSchoolWide/);

  const hook = read('src/features/work-schedule/hooks/useEvents.ts');
  assert.match(hook, /q\.set\('includeSchoolWide', 'false'\)/);
});

test('audited search placeholders describe implemented fields', () => {
  assert.match(read('src/features/work-schedule/EventsListPage.tsx'), /placeholder="Tìm theo tiêu đề"/);
  assert.match(read('src/features/work-schedule/TasksListPage.tsx'), /placeholder="Tìm theo tiêu đề"/);
  assert.match(read('src/features/safety/CasesListPage.tsx'), /Tìm theo mã sự vụ, lớp hoặc nội dung/);
  assert.match(read('src/features/schedules/SchedulesPage.tsx'), /Tìm theo lớp, môn hoặc email giáo viên/);
  assert.match(read('src/features/safety/PersonPicker.tsx'), /Tìm theo tên hoặc email/);
});

test('settings dialog uses the desktop review width without escaping the viewport', () => {
  const dialog = read('src/features/settings/SettingsDialog.tsx');
  const content = read('src/features/settings/SettingsContent.tsx');
  assert.match(dialog, /w-\[94vw\]/);
  assert.match(dialog, /sm:max-w-\[960px\]/);
  assert.match(dialog, /sm:max-h-\[88dvh\]/);
  assert.match(content, /md:grid-cols-\[240px_minmax\(0,1fr\)\]/);
});

test('dark theme centrally maps legacy surfaces and recharts to semantic tokens', () => {
  const styles = read('src/styles.css');
  for (const selector of ['.dark .bg-white', '.dark .border-slate-200', '.dark .text-slate-500', '.recharts-cartesian-axis-tick-value', '.recharts-legend-item-text']) {
    assert.ok(styles.includes(selector), `missing shared dark-mode mapping ${selector}`);
  }
  assert.match(styles, /background-color: hsl\(var\(--card\)\)/);
  assert.match(styles, /fill: hsl\(var\(--muted-foreground\)\)/);

  const pageHeader = read('src/components/PageHeader.tsx');
  assert.match(pageHeader, /text-foreground/);
  assert.doesNotMatch(pageHeader, /text-\[#0f172a\]/);

  const table = read('src/components/ui/table.tsx');
  assert.match(table, /border-border text-foreground/);
});
