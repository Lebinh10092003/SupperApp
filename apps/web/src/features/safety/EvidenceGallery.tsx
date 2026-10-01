/**
 * EvidenceGallery.tsx — component dùng chung để xem trực tiếp minh chứng
 * (ảnh/video/audio) đính kèm 1 tin báo/hồ sơ, tách ra từ
 * `PendingReportsPage.tsx` (nơi bộ xem trước + lightbox toàn màn hình cho
 * ảnh được xây lần đầu — state: `previewMap`/`imageUrlCache`/`lightboxIndex`/
 * `lightboxLoading`/`zoom`, hàm `toggleEvidencePreview`/`openLightbox`/
 * `gotoLightbox`/`ensureImageUrl`) để `IncidentDetailPage.tsx` dùng lại y
 * hệt thay vì chỉ có nút "Tải xuống". Logic COPY nguyên vẹn từ bản gốc,
 * không viết lại kiểu khác — chỉ đổi từ đọc `detailItem.canViewEvidence`/
 * `detailItem.evidenceList` sang đọc thẳng từ props.
 *
 * Tự reset toàn bộ state nội bộ khi danh sách `evidenceList` đổi (khác
 * report/hồ sơ) — theo dõi qua khoá ghép các `evidenceId`, không cần nơi gọi
 * phải truyền `key` để ép remount.
 */
import { useEffect, useMemo, useState } from 'react';
import { Eye, Download, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface EvidenceGalleryItem {
  evidenceId: string;
  fileType: string;
  sizeBytes: number;
  scanStatus: string;
}

const SCAN_STATUS_LABEL: Record<string, string> = {
  clear: 'An toàn',
  pending_scan: 'Đang quét virus...',
  infected: 'Nhiễm mã độc — đã chặn',
  rejected: 'Bị từ chối'
};

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

export function EvidenceGallery({ evidenceList, canView }: { evidenceList: EvidenceGalleryItem[]; canView: boolean }) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const [previewMap, setPreviewMap] = useState<Record<string, { url: string; fileType: string }>>({});
  const [imageUrlCache, setImageUrlCache] = useState<Record<string, string>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Khoá theo đúng bộ evidenceId hiện có — đổi khi component được dùng lại
  // cho 1 report/hồ sơ khác (props `evidenceList` đổi) mà không bị remount,
  // để không rò rỉ preview/lightbox của lần xem trước sang lần xem sau.
  const evidenceKey = evidenceList.map((ev) => ev.evidenceId).join(',');

  useEffect(() => {
    setPreviewMap({});
    setImageUrlCache({});
    setLightboxIndex(null);
    setLightboxLoading(false);
    setZoom(1);
    setDownloadError('');
    setDownloadingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidenceKey]);

  // Chỉ ảnh mới vào lightbox (video/audio giữ nguyên trình phát nhúng).
  const imageEvidences = useMemo(
    () => (canView ? evidenceList.filter((ev) => ev.fileType === 'image' && ev.scanStatus === 'clear') : []),
    [canView, evidenceList]
  );

  const ensureImageUrl = async (evidenceId: string) => {
    if (imageUrlCache[evidenceId]) return imageUrlCache[evidenceId];
    const d = await api.post<{ url: string }>(`/api/safety/evidence/${evidenceId}/download-url`, {});
    setImageUrlCache((m) => ({ ...m, [evidenceId]: d.url }));
    return d.url;
  };

  const openLightbox = async (evidenceId: string) => {
    const idx = imageEvidences.findIndex((ev) => ev.evidenceId === evidenceId);
    if (idx === -1) return;
    setLightboxIndex(idx);
    setZoom(1);
    setDownloadError('');
    if (!imageUrlCache[evidenceId]) {
      setLightboxLoading(true);
      try {
        await ensureImageUrl(evidenceId);
      } catch (e: any) {
        setDownloadError(e.message || 'Không tải được ảnh.');
        setLightboxIndex(null);
      } finally {
        setLightboxLoading(false);
      }
    }
  };

  const gotoLightbox = async (delta: number) => {
    if (lightboxIndex === null) return;
    const nextIdx = lightboxIndex + delta;
    if (nextIdx < 0 || nextIdx >= imageEvidences.length) return;
    setZoom(1);
    setLightboxIndex(nextIdx);
    const nextEv = imageEvidences[nextIdx];
    if (!imageUrlCache[nextEv.evidenceId]) {
      setLightboxLoading(true);
      try {
        await ensureImageUrl(nextEv.evidenceId);
      } catch (e: any) {
        setDownloadError(e.message || 'Không tải được ảnh.');
      } finally {
        setLightboxLoading(false);
      }
    }
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') gotoLightbox(-1);
      if (e.key === 'ArrowRight') gotoLightbox(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex]);

  const toggleEvidencePreview = async (evidenceId: string, fileType: string) => {
    if (previewMap[evidenceId]) {
      setPreviewMap((m) => {
        const next = { ...m };
        delete next[evidenceId];
        return next;
      });
      return;
    }
    setDownloadError('');
    setDownloadingId(evidenceId);
    try {
      const d = await api.post<{ url: string }>(`/api/safety/evidence/${evidenceId}/download-url`, {});
      setPreviewMap((m) => ({ ...m, [evidenceId]: { url: d.url, fileType } }));
    } catch (e: any) {
      setDownloadError(e.message || 'Không tải được minh chứng.');
    } finally {
      setDownloadingId(null);
    }
  };

  const currentImage = lightboxIndex !== null ? imageEvidences[lightboxIndex] : undefined;

  return (
    <div>
      <p className="text-xs text-slate-500">Minh chứng đính kèm</p>
      {!canView && <p className="text-sm text-slate-500">Bạn không đủ quyền xem minh chứng này.</p>}
      {canView && evidenceList.length === 0 && <p className="text-sm text-slate-500">Không có file đính kèm.</p>}
      {downloadError && (
        <Alert className="mt-2 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{downloadError}</AlertDescription>
        </Alert>
      )}
      {canView && evidenceList.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-2">
          {evidenceList.map((ev) => {
            const preview = previewMap[ev.evidenceId];
            return (
              <div key={ev.evidenceId}>
                <div className="flex items-center gap-2">
                  <p className="text-sm">
                    {ev.evidenceId} · {ev.fileType} · {formatBytes(ev.sizeBytes)}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn('border-transparent', ev.scanStatus === 'clear' ? 'bg-emerald-50 text-emerald-600' : 'bg-yellow-100 text-yellow-800')}
                  >
                    {SCAN_STATUS_LABEL[ev.scanStatus] || ev.scanStatus}
                  </Badge>
                  {ev.scanStatus === 'clear' && ev.fileType === 'image' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon-xs" variant="outline" onClick={() => openLightbox(ev.evidenceId)}>
                          <Eye className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Xem trực tiếp (phóng to được)</TooltipContent>
                    </Tooltip>
                  )}
                  {ev.scanStatus === 'clear' && ev.fileType !== 'image' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-xs"
                          variant="outline"
                          disabled={downloadingId === ev.evidenceId}
                          onClick={() => toggleEvidencePreview(ev.evidenceId, ev.fileType)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{preview ? 'Ẩn xem trước' : 'Xem trực tiếp'}</TooltipContent>
                    </Tooltip>
                  )}
                  {ev.scanStatus === 'clear' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-xs"
                          variant="outline"
                          disabled={downloadingId === ev.evidenceId}
                          onClick={async () => {
                            if (preview) {
                              window.open(preview.url, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            setDownloadError('');
                            setDownloadingId(ev.evidenceId);
                            try {
                              const d = await api.post<{ url: string }>(`/api/safety/evidence/${ev.evidenceId}/download-url`, {});
                              window.open(d.url, '_blank', 'noopener,noreferrer');
                            } catch (e: any) {
                              setDownloadError(e.message || 'Không tải được minh chứng.');
                            } finally {
                              setDownloadingId(null);
                            }
                          }}
                        >
                          <Download className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mở tab mới / tải xuống</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {preview && (
                  <div className="mt-2 max-w-[420px] overflow-hidden rounded-lg border border-slate-200">
                    {preview.fileType === 'video' && <video src={preview.url} controls className="block w-full" />}
                    {preview.fileType === 'audio' && <audio src={preview.url} controls className="block w-full p-2" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/92">
          <div className="flex items-center justify-between p-4">
            <p className="text-white">
              {currentImage ? `${currentImage.evidenceId} (${lightboxIndex + 1}/${imageEvidences.length})` : ''}
            </p>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} className="text-white hover:bg-white/10 hover:text-white">
                    <ZoomOut />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Thu nhỏ</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} className="text-white hover:bg-white/10 hover:text-white">
                    <ZoomIn />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Phóng to</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setLightboxIndex(null)} className="text-white hover:bg-white/10 hover:text-white">
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Đóng</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="relative flex flex-1 overflow-hidden">
            {lightboxIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => gotoLightbox(-1)}
                className="absolute top-1/2 left-2 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <ChevronLeft className="size-7" />
              </Button>
            )}

            <div className="flex flex-1 items-center justify-center overflow-auto">
              {lightboxLoading && <Loader2 className="size-8 animate-spin text-white" />}
              {!lightboxLoading && currentImage && imageUrlCache[currentImage.evidenceId] && (
                <img
                  src={imageUrlCache[currentImage.evidenceId]}
                  alt={currentImage.evidenceId}
                  onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                  className="transition-[width,max-width] duration-150"
                  style={{
                    maxWidth: zoom === 1 ? '90%' : 'none',
                    maxHeight: zoom === 1 ? '85vh' : 'none',
                    width: zoom !== 1 ? `${zoom * 100}%` : 'auto',
                    cursor: zoom === 1 ? 'zoom-in' : 'zoom-out'
                  }}
                />
              )}
            </div>

            {lightboxIndex < imageEvidences.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => gotoLightbox(1)}
                className="absolute top-1/2 right-2 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <ChevronRight className="size-7" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
