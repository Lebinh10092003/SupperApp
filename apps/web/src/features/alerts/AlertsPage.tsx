import { useEffect, useState, useMemo } from 'react';
import { BellRing, CheckCircle2, CheckCheck, CircleAlert, TriangleAlert, Info, SlidersHorizontal, Play } from 'lucide-react';

import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function AlertsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState('0');
  const [resolveTarget, setResolveTarget] = useState<any>(null);
  const [resolutionText, setResolutionText] = useState('Đã kiểm tra và xử lý cùng GVCN');
  const [toast, setToast] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const load = () => {
    api<{ items: any[] }>('/api/alerts')
      .then((x) => {
        setItems(x.items || []);
      })
      .catch(() => setItems([]));

    api<{ rules: any[] }>('/api/alerts/rules')
      .then((x) => {
        if (x.rules) setRules(x.rules);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolve = async () => {
    if (!resolveTarget) return;
    try {
      await api(`/api/alerts/${resolveTarget.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution: resolutionText.trim(), notes: resolutionText.trim() })
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === resolveTarget.id
            ? { ...item, resolved: true, status: 'RESOLVED', resolution: resolutionText, resolvedBy: 'Ban Giám Hiệu' }
            : item
        )
      );
      setToast('Đã đánh dấu xử lý cảnh báo thành công!');
      setResolveTarget(null);
    } catch (e: any) {
      setToast(`Lỗi: ${e.message}`);
    }
  };

  const handleTriggerEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await api.post('/api/alerts/evaluate');
      setToast(`Quét cảnh báo hoàn tất! Đã quét ${res.scannedCourses || 0} lớp học.`);
      load();
    } catch (e: any) {
      setToast(`Lỗi: ${e.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const handleUpdateRule = async (ruleId: string, threshold: number, enabled: boolean) => {
    try {
      await api.patch(`/api/alerts/rules/${ruleId}`, { threshold, enabled });
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, threshold, enabled } : r))
      );
    } catch (e: any) {
      alert(`Lỗi cập nhật quy tắc: ${e.message}`);
    }
  };

  const filtered = useMemo(() => {
    if (tab === '0') return items.filter((x) => !x.resolved);
    if (tab === '1') return items.filter((x) => x.resolved);
    return items;
  }, [items, tab]);

  const severityProps = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'CRITICAL':
        return { icon: CircleAlert, className: 'text-red-500 bg-red-50 border-red-200', borderL: 'border-l-red-500', label: 'Khẩn cấp' };
      case 'HIGH':
        return { icon: CircleAlert, className: 'text-orange-500 bg-orange-50 border-orange-200', borderL: 'border-l-orange-500', label: 'Mức cao' };
      case 'WARNING':
        return { icon: TriangleAlert, className: 'text-amber-500 bg-amber-50 border-amber-200', borderL: 'border-l-amber-500', label: 'Cảnh báo' };
      default:
        return { icon: Info, className: 'text-primary bg-secondary border-blue-200', borderL: 'border-l-primary', label: 'Thông tin' };
    }
  };

  const openCount = items.filter((x) => !x.resolved).length;

  return (
    <>
      <PageHeader
        title="Trung tâm cảnh báo sớm"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTriggerEvaluate} disabled={evaluating}>
              <Play className="size-4" />
              Chạy quét cảnh báo
            </Button>
            <Button onClick={() => setRulesOpen(true)}>
              <SlidersHorizontal className="size-4" />
              Cấu hình quy tắc động
            </Button>
          </div>
        }
      />

      {toast && (
        <Alert className="mb-5 border-emerald-200 bg-emerald-50">
          <AlertDescription className="text-emerald-700">{toast}</AlertDescription>
        </Alert>
      )}

      {/* Segmented Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-6 w-fit">
        <TabsList>
          <TabsTrigger value="0" className="gap-1.5 font-semibold">
            Cần xử lý
            {openCount > 0 && <Badge className="bg-red-500 px-1.5 text-xs text-white">{openCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="1" className="font-semibold">
            Đã giải quyết
          </TabsTrigger>
          <TabsTrigger value="2" className="font-semibold">
            Tất cả cảnh báo
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Alert List */}
      <div className="flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
            <CheckCircle2 className="mx-auto mb-2 size-[3.2rem] text-emerald-500" />
            <p className="font-bold text-[#0f172a]">Không có cảnh báo nào đang mở</p>
            <p className="text-sm text-slate-500">Toàn bộ lớp học số, tiến độ giao nộp bài và chuyên cần của trường đang ở ngưỡng an toàn</p>
          </div>
        ) : (
          filtered.map((x) => {
            const sp = severityProps(x.severity);
            const SevIcon = sp.icon;
            return (
              <div
                key={x.id}
                className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border-l-4', sp.borderL)}
              >
                <div className="mb-3 flex flex-col items-start justify-between gap-2.5 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn('h-6 gap-1 font-bold', sp.className)}>
                      <SevIcon className="size-3.5" />
                      {sp.label}
                    </Badge>
                    <Badge variant="outline" className="bg-slate-50 text-slate-700">
                      {x.targetName || x.targetId || 'Lớp học'}
                    </Badge>
                    <p className="text-sm font-bold text-[#0f172a]">
                      {x.targetType === 'STUDENT' ? 'Cảnh báo học sinh' : x.targetType === 'CLASS' ? 'Cảnh báo tập thể lớp' : 'Cảnh báo Classroom'}
                    </p>
                  </div>

                  {!x.resolved ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setResolveTarget(x);
                        setResolutionText('Đã chỉ đạo giáo viên bộ môn và chủ nhiệm đôn đốc');
                      }}
                      className="font-bold"
                    >
                      <CheckCheck className="size-4" />
                      Tiếp nhận & Xử lý
                    </Button>
                  ) : (
                    <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="size-3.5" />
                      Đã giải quyết
                    </Badge>
                  )}
                </div>

                {/* Lý do cảnh báo */}
                <p className="mb-3 text-sm font-semibold text-[#0f172a]">{x.reason || x.message}</p>

                {/* Bằng chứng & Số liệu chứng minh */}
                {x.evidence && (
                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-medium text-slate-500">Số liệu chứng minh (Evidence)</p>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">Chỉ số đo lường:</p>
                        <p className="text-sm font-semibold text-[#0f172a]">{x.evidence.metricName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Giá trị thực tế:</p>
                        <p className="text-sm font-bold text-red-600">{x.evidence.actualValue}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Chi tiết:</p>
                        <p className="text-sm text-slate-700">{x.evidence.details}</p>
                      </div>
                    </div>
                  </div>
                )}

                {x.principalNotes && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-800">
                      <strong>Ghi chú Ban Giám hiệu:</strong> {x.principalNotes} ({x.resolvedBy || 'Hiệu trưởng'})
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Dialog Xử lý Cảnh báo */}
      <Dialog open={Boolean(resolveTarget)} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xử Lý & Đóng Cảnh Báo Điều Hành</DialogTitle>
          </DialogHeader>
          {resolveTarget && (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Đối tượng: <strong>{resolveTarget.targetName}</strong>
              </p>
              <p className="text-sm text-slate-500">Nguyên nhân: {resolveTarget.reason}</p>
              <div>
                <Label htmlFor="resolution-text" className="mb-1.5 block">
                  Biện pháp xử lý / Ghi chú của Ban Giám hiệu
                </Label>
                <Textarea id="resolution-text" rows={3} value={resolutionText} onChange={(e) => setResolutionText(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveTarget(null)} className="text-slate-500">
              Hủy
            </Button>
            <Button onClick={handleResolve}>
              Lưu & Đóng cảnh báo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cấu hình Dynamic Rules */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cấu Hình Quy Tắc Cảnh Báo Sớm (Dynamic Rules)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Ban Giám hiệu có thể điều chỉnh ngưỡng phát hiện tự động để cảnh báo phù hợp với quy mô và tiêu chuẩn thực tế của trường:
          </p>

          <div className="flex flex-col gap-4">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-bold text-[#0f172a]">{rule.name}</p>
                  <label className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-500">{rule.enabled ? 'Đang bật' : 'Tạm tắt'}</span>
                    <Switch checked={rule.enabled} onCheckedChange={(checked) => handleUpdateRule(rule.id, rule.threshold, checked)} />
                  </label>
                </div>
                <p className="mb-3 text-xs text-slate-500">{rule.description}</p>
                <div className="flex items-center gap-4">
                  <p className="min-w-36 text-sm font-bold text-[#0f172a]">
                    Ngưỡng: {rule.threshold} {rule.unit}
                  </p>
                  <Slider
                    value={[rule.threshold]}
                    min={1}
                    max={rule.unit === '%' ? 100 : 30}
                    disabled={!rule.enabled}
                    onValueChange={([v]) => handleUpdateRule(rule.id, v ?? rule.threshold, rule.enabled)}
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setRulesOpen(false)}>
              Hoàn tất cấu hình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
