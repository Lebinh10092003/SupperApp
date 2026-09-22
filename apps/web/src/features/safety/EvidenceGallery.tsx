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
import { Alert, Box, Chip, IconButton, Modal, Stack, Tooltip, Typography, CircularProgress } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/VisibilityRounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import CloseIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightIcon from '@mui/icons-material/ChevronRightRounded';
import ZoomInIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutIcon from '@mui/icons-material/ZoomOutRounded';
import { api } from '../../services/api';

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

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Minh chứng đính kèm
      </Typography>
      {!canView && <Typography color="text.secondary">Bạn không đủ quyền xem minh chứng này.</Typography>}
      {canView && evidenceList.length === 0 && <Typography color="text.secondary">Không có file đính kèm.</Typography>}
      {downloadError && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setDownloadError('')}>
          {downloadError}
        </Alert>
      )}
      {canView && evidenceList.length > 0 && (
        <Stack spacing={1} sx={{ mt: 0.5 }}>
          {evidenceList.map((ev) => {
            const preview = previewMap[ev.evidenceId];
            return (
              <Box key={ev.evidenceId}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">
                    {ev.evidenceId} · {ev.fileType} · {formatBytes(ev.sizeBytes)}
                  </Typography>
                  <Chip
                    size="small"
                    label={SCAN_STATUS_LABEL[ev.scanStatus] || ev.scanStatus}
                    sx={ev.scanStatus === 'clear' ? { bgcolor: '#f0fdf4', color: '#16a34a' } : { bgcolor: '#fef9c3', color: '#854d0e' }}
                  />
                  {ev.scanStatus === 'clear' && ev.fileType === 'image' && (
                    <Tooltip title="Xem trực tiếp (phóng to được)">
                      <IconButton
                        size="small"
                        onClick={() => openLightbox(ev.evidenceId)}
                        sx={{ border: '1px solid #e2e8f0', borderRadius: 2, color: '#475569', '&:hover': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' } }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {ev.scanStatus === 'clear' && ev.fileType !== 'image' && (
                    <Tooltip title={preview ? 'Ẩn xem trước' : 'Xem trực tiếp'}>
                      <IconButton
                        size="small"
                        disabled={downloadingId === ev.evidenceId}
                        onClick={() => toggleEvidencePreview(ev.evidenceId, ev.fileType)}
                        sx={{ border: '1px solid #e2e8f0', borderRadius: 2, color: '#475569', '&:hover': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' } }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {ev.scanStatus === 'clear' && (
                    <Tooltip title="Mở tab mới / tải xuống">
                      <IconButton
                        size="small"
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
                        sx={{ border: '1px solid #e2e8f0', borderRadius: 2, color: '#475569', '&:hover': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' } }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                {preview && (
                  <Box sx={{ mt: 1, borderRadius: 2, overflow: 'hidden', border: '1px solid #e2e8f0', maxWidth: 420 }}>
                    {preview.fileType === 'video' && <Box component="video" src={preview.url} controls sx={{ width: '100%', display: 'block' }} />}
                    {preview.fileType === 'audio' && <Box component="audio" src={preview.url} controls sx={{ width: '100%', display: 'block', p: 1 }} />}
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      <Modal open={lightboxIndex !== null} onClose={() => setLightboxIndex(null)}>
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.92)',
            display: 'flex',
            flexDirection: 'column',
            outline: 'none'
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
            <Typography sx={{ color: '#fff' }}>
              {lightboxIndex !== null && imageEvidences[lightboxIndex]
                ? `${imageEvidences[lightboxIndex].evidenceId} (${lightboxIndex + 1}/${imageEvidences.length})`
                : ''}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Thu nhỏ">
                <span>
                  <IconButton onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} sx={{ color: '#fff' }}>
                    <ZoomOutIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Phóng to">
                <span>
                  <IconButton onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} sx={{ color: '#fff' }}>
                    <ZoomInIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Đóng">
                <IconButton onClick={() => setLightboxIndex(null)} sx={{ color: '#fff' }}>
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
            {lightboxIndex !== null && lightboxIndex > 0 && (
              <IconButton
                onClick={() => gotoLightbox(-1)}
                sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              >
                <ChevronLeftIcon fontSize="large" />
              </IconButton>
            )}

            <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {lightboxLoading && <CircularProgress sx={{ color: '#fff' }} />}
              {!lightboxLoading && lightboxIndex !== null && imageEvidences[lightboxIndex] && imageUrlCache[imageEvidences[lightboxIndex].evidenceId] && (
                <Box
                  component="img"
                  src={imageUrlCache[imageEvidences[lightboxIndex].evidenceId]}
                  alt={imageEvidences[lightboxIndex].evidenceId}
                  onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                  sx={{
                    maxWidth: zoom === 1 ? '90%' : 'none',
                    maxHeight: zoom === 1 ? '85vh' : 'none',
                    width: zoom !== 1 ? `${zoom * 100}%` : 'auto',
                    cursor: zoom === 1 ? 'zoom-in' : 'zoom-out',
                    transition: 'width 0.15s, max-width 0.15s'
                  }}
                />
              )}
            </Box>

            {lightboxIndex !== null && lightboxIndex < imageEvidences.length - 1 && (
              <IconButton
                onClick={() => gotoLightbox(1)}
                sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              >
                <ChevronRightIcon fontSize="large" />
              </IconButton>
            )}
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}
