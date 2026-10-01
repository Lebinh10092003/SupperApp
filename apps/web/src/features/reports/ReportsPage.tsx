import { useState } from 'react';
import { ClipboardList, Download, FileCheck2, BookOpenCheck, Video, Loader2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { download } from '../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const reportTemplates = [
  {
    id: 'rep-summary',
    title: 'Báo cáo Tổng quan Chuyên cần & Điểm danh',
    desc: 'Tổng hợp số tiết học, số lượt có mặt, đi muộn, vắng mặt và tỷ lệ chuyên cần theo từng lớp trong 30 ngày.',
    path: '/api/reports/summary.csv?days=30',
    filename: 'bao-cao-chuyen-can-thcs-giang-vo.csv',
    icon: <FileCheck2 className="size-5 text-primary" />,
    tag: 'Định kỳ',
    theme: 'bg-secondary text-[#1d4ed8] border-blue-200'
  },
  {
    id: 'rep-classroom',
    title: 'Báo cáo Hoạt động Google Classroom',
    desc: 'Thống kê tình hình nộp bài tập, số bài đã giao, tỷ lệ hoàn thành đúng hạn của học sinh theo từng bộ môn.',
    path: '/api/reports/classroom.csv',
    filename: 'bao-cao-google-classroom.csv',
    icon: <BookOpenCheck className="size-5 text-emerald-500" />,
    tag: 'Google Classroom',
    theme: 'bg-emerald-50 text-emerald-600 border-emerald-200'
  },
  {
    id: 'rep-meet',
    title: 'Báo cáo Chi tiết Phòng học Google Meet',
    desc: 'Ghi nhận thời gian bắt đầu, kết thúc, số lượng học sinh tham gia và thời lượng trung bình của các phiên Meet.',
    path: '/api/reports/meet.csv',
    filename: 'bao-cao-phien-hoc-google-meet.csv',
    icon: <Video className="size-5 text-violet-500" />,
    tag: 'Google Meet',
    theme: 'bg-violet-50 text-violet-600 border-violet-200'
  }
];

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [toast, setToast] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  const handleDownload = async (rep: (typeof reportTemplates)[number]) => {
    setDownloading(rep.id);
    const downloadPath = rep.id === 'rep-summary' ? `/api/reports/summary.csv?days=${period}` : rep.path;
    try {
      await download(downloadPath, rep.filename);
      setToast({ text: `Đã xuất báo cáo "${rep.title}" thành công!`, severity: 'success' });
    } catch (e: any) {
      setToast({
        text: `Không thể tải báo cáo: ${e.message}. Hãy đảm bảo hệ thống đã có dữ liệu đồng bộ từ Google Classroom.`,
        severity: 'error'
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <PageHeader title="Trung tâm báo cáo & xuất số liệu" icon={<ClipboardList />} />

      {toast && (
        <Alert className={cn('mb-5', toast.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')}>
          <AlertDescription className={toast.severity === 'error' ? 'text-red-700' : 'text-emerald-700'}>{toast.text}</AlertDescription>
        </Alert>
      )}

      {/* Filter Card */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="min-w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 ngày gần nhất</SelectItem>
              <SelectItem value="30">30 ngày gần nhất (1 tháng)</SelectItem>
              <SelectItem value="90">Học kỳ II (90 ngày)</SelectItem>
              <SelectItem value="180">Cả năm học 2025–2026</SelectItem>
            </SelectContent>
          </Select>

          <p className="text-[0.8125rem] text-slate-500">
            Định dạng xuất chuẩn: <strong className="text-[#0f172a]">CSV (UTF-8 có BOM tiếng Việt)</strong> tương thích hoàn toàn với Microsoft Excel
            và Google Sheets.
          </p>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {reportTemplates.map((rep) => (
          <div
            key={rep.id}
            className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-blue-200 hover:shadow-[0_4px_12px_rgba(37,99,235,0.08)]"
          >
            <div className="flex-1 p-6">
              <div className="mb-3 flex items-start justify-between">
                <div className="grid place-items-center rounded-[10px] bg-secondary p-2.5">{rep.icon}</div>
                <Badge variant="outline" className={cn('font-semibold', rep.theme)}>
                  {rep.tag}
                </Badge>
              </div>
              <p className="mb-1.5 font-bold tracking-tight text-[#0f172a]">{rep.title}</p>
              <p className="text-[0.8125rem] leading-relaxed text-slate-500">{rep.desc}</p>
            </div>
            <div className="p-4 pt-0">
              <Button
                className="w-full font-semibold shadow-[0_2px_6px_rgba(37,99,235,0.2)]"
                disabled={downloading === rep.id}
                onClick={() => handleDownload(rep)}
              >
                {downloading === rep.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {downloading === rep.id ? 'Đang kết xuất CSV...' : 'Tải báo cáo CSV'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
