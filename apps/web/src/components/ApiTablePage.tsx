import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TablePagination,
  TextField,
  InputAdornment,
  Box,
  Typography,
  Chip,
  Skeleton,
  Alert,
  Button,
  Stack
} from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import CloudSyncIcon from '@mui/icons-material/CloudSyncRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from './PageHeader';
import { api } from '../services/api';

export function ApiTablePage({
  title,
  subtitle,
  path,
  columns,
  action
}: {
  title: string;
  subtitle?: string;
  path: string;
  columns: { key: string; label: string; render?: (val: any, row: any) => React.ReactNode }[];
  action?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadData = () => {
    setLoading(true);
    setErr('');
    api<{ items: any[] }>(path)
      .then((x) => {
        setItems(x.items || []);
      })
      .catch((e) => {
        console.warn('API fetch notice:', e.message);
        setErr(`Không thể kết nối máy chủ hoặc chưa có dữ liệu: ${e.message}`);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [path]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const query = q.toLowerCase();
    return items.filter((x) =>
      Object.values(x).some((val) => String(val ?? '').toLowerCase().includes(query))
    );
  }, [items, q]);

  const pagedItems = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const renderCellContent = (c: any, row: any) => {
    if (c.render) return c.render(row[c.key], row);
    const val = row[c.key];

    if (c.key === 'status') {
      const isLive = String(val).toUpperCase() === 'LIVE';
      return (
        <Chip
          label={val || 'Hoàn thành'}
          size="small"
          sx={{
            bgcolor: isLive ? '#fef2f2' : '#f8fafc',
            color: isLive ? '#dc2626' : '#334155',
            border: isLive ? '1px solid #fecaca' : '1px solid #e2e8f0',
            fontWeight: 700,
            fontSize: '0.72rem',
            height: 24
          }}
        />
      );
    }

    if (c.key === 'attendanceRate' || c.key.includes('Rate')) {
      const num = Number(val);
      if (!isNaN(num)) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: num >= 90 ? '#10b981' : num >= 75 ? '#f59e0b' : '#ef4444', fontSize: '0.84rem' }}>
              {num}%
            </Typography>
          </Box>
        );
      }
    }

    return String(val ?? '—');
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {action}
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={loadData}
              sx={{
                bgcolor: '#ffffff',
                borderColor: '#cbd5e1',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.8125rem',
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' }
              }}
            >
              Làm mới
            </Button>
          </Box>
        }
      />

      {/* Filter Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Lọc dữ liệu tìm kiếm..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          sx={{ width: { xs: '100%', sm: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#64748b', fontSize: 19 }} />
              </InputAdornment>
            ),
            sx: { height: 38, fontSize: '0.84rem', bgcolor: '#ffffff' }
          }}
        />

        <Chip
          label={`Tổng cộng ${filtered.length} bản ghi`}
          size="small"
          sx={{
            bgcolor: '#eff6ff',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
            fontWeight: 700,
            fontSize: '0.75rem',
            height: 28,
            px: 0.5
          }}
        />
      </Box>

      {err && (
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2, border: '1px solid #bfdbfe', bgcolor: '#eff6ff', color: '#1e40af' }}>
          {err}
        </Alert>
      )}

      {/* Table Card */}
      <Card sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)', bgcolor: '#ffffff' }}>
        <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
          <Table size="medium">
            <TableHead sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={{ fontWeight: 700, color: '#475569', py: 1.5, fontSize: '0.75rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c.key} sx={{ py: 1.75 }}>
                        <Skeleton variant="text" width="80%" height={22} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ py: 8, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2.5,
                        border: '1px solid #bfdbfe',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        color: '#2563eb',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        boxShadow: '0 4px 10px rgba(37, 99, 235, 0.12)'
                      }}
                    >
                      <SchoolIcon sx={{ fontSize: 26 }} />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', mb: 0.5 }}>
                      Chưa có dữ liệu từ Google Classroom
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 460, mx: 'auto', mb: 3, fontSize: '0.84rem', lineHeight: 1.6 }}>
                      Toàn bộ thông tin học tập và danh bạ được đồng bộ trực tiếp từ Google Classroom. Hãy kết nối tài khoản hoặc tiến hành đồng bộ để hiển thị danh sách.
                    </Typography>
                    <Stack direction="row" spacing={1.5} justifyContent="center">
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<CloudSyncIcon sx={{ fontSize: 18 }} />}
                        onClick={() => navigate('/connections')}
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          px: 2.5,
                          py: 0.85,
                          borderRadius: 2
                        }}
                      >
                        Kết nối & Đồng bộ Classroom
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
                        onClick={loadData}
                        sx={{ borderColor: '#cbd5e1', color: '#334155', fontWeight: 600, fontSize: '0.84rem', borderRadius: 2 }}
                      >
                        Thử lại
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a', mb: 0.5 }}>
                      Không tìm thấy kết quả phù hợp với "{q}"
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Vui lòng thử tìm kiếm bằng từ khóa khác
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((x, i) => (
                  <TableRow
                    key={x.id || i}
                    sx={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.12s ease',
                      '&:hover': { bgcolor: 'rgba(239, 246, 255, 0.6) !important' }
                    }}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} sx={{ py: 1.5, fontSize: '0.84rem' }}>
                        {renderCellContent(c, x)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {filtered.length > rowsPerPage && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={filtered.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Số hàng mỗi trang:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count}`}
            sx={{
              borderTop: '1px solid #e2e8f0',
              color: '#64748b',
              fontSize: '0.78rem',
              '& .MuiTablePagination-select': { fontSize: '0.78rem' },
              '& .MuiTablePagination-displayedRows': { fontSize: '0.78rem' }
            }}
          />
        )}
      </Card>
    </>
  );
}