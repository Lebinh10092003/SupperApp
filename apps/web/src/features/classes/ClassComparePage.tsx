import { useEffect, useState, useMemo } from 'react';
import { ArrowLeftRight, Award, CheckCircle2, Lightbulb, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface ClassItem {
  id: string;
  classId: string;
  className: string;
  grade: number | null;
  source: string;
  active: boolean;
  homeroomTeacher: string;
  teacherEmail: string;
  room: string;
  expectedStudents: number;
  studentCount: number;
  courseCount: number;
  totalCoursework: number;
  submissionsTotal: number;
  submissionsTurnedIn: number;
  submissionsLate: number;
  completionRate: number;
  onTimeRate: number;
  averageScore: number | null;
}

export interface DuelData {
  classA: ClassItem | null;
  classB: ClassItem | null;
  deltas: {
    completionRate: number;
    onTimeRate: number;
    averageScore: number;
    attendanceRate: number;
    totalCoursework: number;
  } | null;
  radarData: Array<{
    metric: string;
    classA: number;
    classB: number;
    fullMark: number;
  }>;
  insights: string[];
  recommendations: string[];
}

export interface CompareBenchmarkData {
  total: number;
  grade: string;
  benchmarks: {
    avgCompletion: number;
    avgOnTime: number;
    avgScore: number;
  };
  items: ClassItem[];
}

const GRADES = [
  { value: 'all', label: 'Tất cả các khối' },
  { value: '6', label: 'Khối 6' },
  { value: '7', label: 'Khối 7' },
  { value: '8', label: 'Khối 8' },
  { value: '9', label: 'Khối 9' },
  { value: '10', label: 'Khối 10' },
  { value: '11', label: 'Khối 11' },
  { value: '12', label: 'Khối 12' }
];

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]', className)}>{children}</div>;
}

function StatBlock({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <p className="block text-xs text-slate-500">{label}</p>
      <p className={cn('text-lg font-bold text-[#0f172a]', valueClassName)}>{value}</p>
    </div>
  );
}

export default function ClassComparePage() {
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [classAId, setClassAId] = useState<string>('');
  const [classBId, setClassBId] = useState<string>('');
  const [duelData, setDuelData] = useState<DuelData | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<CompareBenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [duelLoading, setDuelLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Tải danh sách lớp và benchmark theo khối
  const loadClassesAndBenchmarks = async (grade = selectedGrade) => {
    setLoading(true);
    setError('');
    try {
      const res = await api<CompareBenchmarkData>(`/api/classes/compare?grade=${grade}`);
      setBenchmarkData(res);
      setAllClasses(res.items || []);

      if (res.items && res.items.length > 0) {
        // Mặc định chọn 2 lớp đầu tiên nếu chưa chọn hoặc lớp hiện tại không thuộc khối
        const first = res.items[0]!.classId;
        const second = res.items.length > 1 ? res.items[1]!.classId : res.items[0]!.classId;
        setClassAId((prev) => (res.items.some((c) => c.classId === prev) ? prev : first));
        setClassBId((prev) => (res.items.some((c) => c.classId === prev && c.classId !== first) ? prev : second));
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu so sánh lớp học');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassesAndBenchmarks(selectedGrade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrade]);

  // 2. Tải dữ liệu đối đầu 1-vs-1 khi thay đổi Lớp A hoặc Lớp B
  const loadDuel = async (aId: string, bId: string) => {
    if (!aId || !bId || aId === bId) return;
    setDuelLoading(true);
    try {
      const res = await api<DuelData>(`/api/classes/duel?classA=${encodeURIComponent(aId)}&classB=${encodeURIComponent(bId)}`);
      setDuelData(res);
    } catch (err: any) {
      console.warn('Lỗi tải duel:', err);
    } finally {
      setDuelLoading(false);
    }
  };

  useEffect(() => {
    if (classAId && classBId && classAId !== classBId) {
      loadDuel(classAId, classBId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classAId, classBId]);

  // Danh sách các lớp lọc theo khối hiện tại
  const availableClasses = useMemo(() => {
    if (selectedGrade === 'all') return allClasses;
    return allClasses.filter((c) => String(c.grade) === selectedGrade);
  }, [allClasses, selectedGrade]);

  return (
    <div className="mx-auto max-w-[1440px] p-4 md:p-6">
      <PageHeader
        title="So sánh & Đối đầu Lớp học"
        subtitle="Phân tích đối đầu trực diện 1-vs-1 giữa các lớp học và xếp hạng chỉ số học tập so với chuẩn toàn khối."
        icon={<ArrowLeftRight className="text-primary" />}
        action={
          <Button variant="outline" onClick={() => loadClassesAndBenchmarks(selectedGrade)} disabled={loading} className="rounded-lg font-semibold">
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
        }
      />

      {error && <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* THANH ĐIỀU KHIỂN CHỌN LỚP ĐỐI ĐẦU */}
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold tracking-wide text-slate-700 uppercase">Thiết lập cặp lớp so sánh đối đầu (Head-to-Head Duel)</p>
        </div>
        <div className="grid grid-cols-1 items-center gap-4 p-5 sm:grid-cols-[repeat(12,minmax(0,1fr))]">
          {/* Lọc Khối */}
          <div className="sm:col-span-3">
            <p className="mb-1.5 text-xs font-medium text-slate-600">Phạm vi khối</p>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chọn Lớp A */}
          <div className="sm:col-span-4">
            <p className="mb-1.5 text-xs font-semibold text-primary">Lớp A (Đội Xanh)</p>
            <Select value={classAId} onValueChange={setClassAId}>
              <SelectTrigger className="w-full border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((c) => (
                  <SelectItem key={c.classId} value={c.classId} disabled={c.classId === classBId}>
                    {c.className} {c.homeroomTeacher ? `(${c.homeroomTeacher})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* VS Badge */}
          <div className="flex justify-center sm:col-span-1">
            <span className="inline-flex size-[38px] items-center justify-center rounded-full bg-[#0f172a] text-[0.8rem] font-black tracking-wide text-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
              VS
            </span>
          </div>

          {/* Chọn Lớp B */}
          <div className="sm:col-span-4">
            <p className="mb-1.5 text-xs font-semibold text-violet-600">Lớp B (Đội Tím)</p>
            <Select value={classBId} onValueChange={setClassBId}>
              <SelectTrigger className="w-full border-violet-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((c) => (
                  <SelectItem key={c.classId} value={c.classId} disabled={c.classId === classAId}>
                    {c.className} {c.homeroomTeacher ? `(${c.homeroomTeacher})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* NỘI DUNG ĐỐI ĐẦU 1-VS-1 */}
      {duelLoading ? (
        <div className="p-16 text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-primary" />
          <p className="mt-4 text-sm text-slate-500">Đang tổng hợp dữ liệu đối đầu và phân tích nhận định...</p>
        </div>
      ) : duelData && duelData.classA && duelData.classB ? (
        <>
          {/* HÀNG THẺ LỚP A & LỚP B */}
          <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Thẻ Lớp A */}
            <Card className="border-2 border-blue-300 shadow-[0_4px_12px_rgba(37,99,235,0.08)]">
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="mb-1 border-transparent bg-secondary font-bold text-[#1d4ed8]">
                      ĐỘI XANH
                    </Badge>
                    <p className="text-xl font-extrabold text-[#0f172a]">{duelData.classA.className}</p>
                    <p className="text-sm text-slate-500">
                      GVCN: <strong>{duelData.classA.homeroomTeacher || 'Chưa phân công'}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="border-transparent bg-slate-100 font-semibold">
                      {duelData.classA.grade ? `Khối ${duelData.classA.grade}` : '—'}
                    </Badge>
                    <p className="mt-1 text-xs text-slate-500">Phòng: {duelData.classA.room || '—'}</p>
                  </div>
                </div>
                <div className="my-3 border-t border-slate-200" />
                <div className="grid grid-cols-3 gap-2">
                  <StatBlock label="Tỷ lệ nộp bài" value={`${duelData.classA.completionRate}%`} valueClassName="text-primary" />
                  <StatBlock label="Nộp đúng hạn" value={`${duelData.classA.onTimeRate}%`} valueClassName="text-emerald-600" />
                  <StatBlock label="Sĩ số lớp" value={`${duelData.classA.expectedStudents || duelData.classA.studentCount || 0} HS`} />
                </div>
              </div>
            </Card>

            {/* Thẻ Lớp B */}
            <Card className="border-2 border-violet-300 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="mb-1 border-transparent bg-violet-50 font-bold text-violet-700">
                      ĐỘI TÍM
                    </Badge>
                    <p className="text-xl font-extrabold text-[#0f172a]">{duelData.classB.className}</p>
                    <p className="text-sm text-slate-500">
                      GVCN: <strong>{duelData.classB.homeroomTeacher || 'Chưa phân công'}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="border-transparent bg-slate-100 font-semibold">
                      {duelData.classB.grade ? `Khối ${duelData.classB.grade}` : '—'}
                    </Badge>
                    <p className="mt-1 text-xs text-slate-500">Phòng: {duelData.classB.room || '—'}</p>
                  </div>
                </div>
                <div className="my-3 border-t border-slate-200" />
                <div className="grid grid-cols-3 gap-2">
                  <StatBlock label="Tỷ lệ nộp bài" value={`${duelData.classB.completionRate}%`} valueClassName="text-violet-600" />
                  <StatBlock label="Nộp đúng hạn" value={`${duelData.classB.onTimeRate}%`} valueClassName="text-emerald-600" />
                  <StatBlock label="Sĩ số lớp" value={`${duelData.classB.expectedStudents || duelData.classB.studentCount || 0} HS`} />
                </div>
              </div>
            </Card>
          </div>

          {/* BIỂU ĐỒ RADAR 5 CHIỀU VÀ BẢNG CHÊNH LỆCH */}
          <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-12">
            {/* Radar Chart */}
            <Card className="md:col-span-7">
              <div className="border-b border-slate-200 p-5">
                <p className="font-bold text-[#0f172a]">Radar So sánh 5 Chỉ số Toàn diện</p>
                <p className="text-xs text-slate-500">Quy đổi trên thang chuẩn 100 điểm: Nộp bài, Đúng hạn, Điểm số, Chuyên cần, Bài tập đã giao</p>
              </div>
              <div className="h-[360px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={duelData.radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" />
                    <Radar name={duelData.classA.className} dataKey="classA" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.4} />
                    <Radar name={duelData.classB.className} dataKey="classB" stroke="#7c3aed" fill="#8b5cf6" fillOpacity={0.4} />
                    <Legend />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Thẻ Delta Chênh Lệch */}
            <Card className="md:col-span-5">
              <div className="border-b border-slate-200 p-5">
                <p className="font-bold text-[#0f172a]">Chênh lệch Chỉ số (Delta: Lớp A − Lớp B)</p>
                <p className="text-xs text-slate-500">Giá trị dương (+) nghĩa là Lớp A đang dẫn trước</p>
              </div>
              {duelData.deltas && (
                <div className="flex flex-col gap-3 p-5">
                  <div className={cn('rounded-lg p-3', duelData.deltas.completionRate >= 0 ? 'bg-secondary' : 'bg-violet-50')}>
                    <p className="text-xs font-semibold text-slate-500">TỶ LỆ NỘP BÀI TẬP</p>
                    <p className={cn('text-lg font-extrabold', duelData.deltas.completionRate >= 0 ? 'text-primary' : 'text-violet-600')}>
                      {duelData.deltas.completionRate > 0 ? `+${duelData.deltas.completionRate}%` : `${duelData.deltas.completionRate}%`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {duelData.deltas.completionRate > 0
                        ? `${duelData.classA.className} hoàn thành tốt hơn`
                        : `${duelData.classB.className} có tỷ lệ nộp vượt trội hơn`}
                    </p>
                  </div>
                  <div className={cn('rounded-lg p-3', duelData.deltas.onTimeRate >= 0 ? 'bg-green-50' : 'bg-red-50')}>
                    <p className="text-xs font-semibold text-slate-500">TỶ LỆ NỘP ĐÚNG HẠN</p>
                    <p className={cn('text-lg font-extrabold', duelData.deltas.onTimeRate >= 0 ? 'text-green-700' : 'text-red-700')}>
                      {duelData.deltas.onTimeRate > 0 ? `+${duelData.deltas.onTimeRate}%` : `${duelData.deltas.onTimeRate}%`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {duelData.deltas.onTimeRate > 0
                        ? `${duelData.classA.className} kiểm soát hạn chót tốt hơn`
                        : `${duelData.classB.className} có kỷ luật nộp bài đúng giờ hơn`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">CHÊNH LỆCH ĐIỂM SỐ TRUNG BÌNH</p>
                    <p className="text-lg font-extrabold text-[#0f172a]">
                      {duelData.deltas.averageScore > 0 ? `+${duelData.deltas.averageScore} điểm` : `${duelData.deltas.averageScore} điểm`}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* NHẬN ĐỊNH SƯ PHẠM & KHUYẾN NGHỊ BGH */}
          <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Insights */}
            <Card className="border-blue-200 bg-[#f8faff]">
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="size-5 text-primary" />
                  <p className="font-bold text-blue-900">Nhận định Chuyên môn Tự động</p>
                </div>
                <div className="flex flex-col gap-2.5">
                  {duelData.insights.map((text, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-primary" />
                      <p className="text-sm leading-relaxed text-slate-700">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Recommendations */}
            <Card className="border-amber-200 bg-[#fffdf5]">
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Lightbulb className="size-5 text-amber-600" />
                  <p className="font-bold text-amber-900">Khuyến nghị Điều hành Ban Giám hiệu</p>
                </div>
                <div className="flex flex-col gap-2.5">
                  {duelData.recommendations.map((text, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <Award className="mt-0.5 size-[18px] shrink-0 text-amber-600" />
                      <p className="text-sm leading-relaxed text-amber-950">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {/* BẢNG XẾP HẠNG & BENCHMARK TOÀN KHỐI / TOÀN TRƯỜNG */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="font-bold text-[#0f172a]">Bảng Xếp hạng & Đối sánh Chuẩn (Benchmark)</p>
            <p className="text-xs text-slate-500">So sánh chỉ số từng lớp với mức trung bình của toàn khối</p>
          </div>
          {benchmarkData?.benchmarks && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-transparent bg-secondary font-bold text-[#1d4ed8]">
                TB Hoàn thành: {benchmarkData.benchmarks.avgCompletion}%
              </Badge>
              <Badge variant="outline" className="border-transparent bg-emerald-50 font-bold text-emerald-700">
                TB Đúng hạn: {benchmarkData.benchmarks.avgOnTime}%
              </Badge>
            </div>
          )}
        </div>

        <Table className="min-w-[750px]">
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-slate-50">
              <TableHead className="text-[0.85rem] font-bold text-slate-600">Thứ hạng</TableHead>
              <TableHead className="text-[0.85rem] font-bold text-slate-600">Lớp học</TableHead>
              <TableHead className="text-[0.85rem] font-bold text-slate-600">Khối</TableHead>
              <TableHead className="text-[0.85rem] font-bold text-slate-600">Giáo viên Chủ nhiệm</TableHead>
              <TableHead className="text-[0.85rem] font-bold text-slate-600">Sĩ số</TableHead>
              <TableHead className="text-[0.85rem] font-bold text-slate-600">Khóa học số</TableHead>
              <TableHead className="text-[0.85rem] font-bold text-slate-600">Tỷ lệ nộp bài</TableHead>
              <TableHead className="text-[0.85rem] font-bold text-slate-600">Đúng hạn</TableHead>
              <TableHead className="text-right text-[0.85rem] font-bold text-slate-600">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allClasses.map((cls, idx) => {
              const isDuelA = cls.classId === classAId;
              const isDuelB = cls.classId === classBId;
              return (
                <TableRow key={cls.classId} className={cn(isDuelA && 'bg-blue-50/50', isDuelB && 'bg-violet-50/50')}>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex size-7 items-center justify-center rounded-full text-xs font-extrabold text-[#0f172a]',
                        idx === 0 ? 'bg-yellow-200' : idx === 1 ? 'bg-slate-200' : idx === 2 ? 'bg-orange-200' : 'bg-slate-100'
                      )}
                    >
                      {idx + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#0f172a]">{cls.className}</p>
                      {isDuelA && (
                        <Badge variant="outline" className="h-5 border-transparent bg-blue-100 text-[0.65rem] font-bold text-[#1d4ed8]">
                          Đội Xanh
                        </Badge>
                      )}
                      {isDuelB && (
                        <Badge variant="outline" className="h-5 border-transparent bg-violet-100 text-[0.65rem] font-bold text-violet-700">
                          Đội Tím
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-md">
                      {cls.grade ? `Khối ${cls.grade}` : '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-800">{cls.homeroomTeacher || 'Chưa phân công'}</span>
                  </TableCell>
                  <TableCell>{cls.expectedStudents || cls.studentCount || 0} HS</TableCell>
                  <TableCell>{cls.courseCount || 0} khóa</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'font-bold',
                        cls.completionRate >= 70 ? 'text-green-700' : cls.completionRate >= 50 ? 'text-amber-700' : 'text-red-700'
                      )}
                    >
                      {cls.completionRate}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-600">{cls.onTimeRate}%</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="xs" variant={isDuelA ? 'default' : 'outline'} onClick={() => setClassAId(cls.classId)} className="min-w-16">
                        Chọn A
                      </Button>
                      <Button
                        size="xs"
                        variant={isDuelB ? 'default' : 'outline'}
                        onClick={() => setClassBId(cls.classId)}
                        className={cn('min-w-16', isDuelB && 'bg-violet-600 hover:bg-violet-700')}
                      >
                        Chọn B
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
