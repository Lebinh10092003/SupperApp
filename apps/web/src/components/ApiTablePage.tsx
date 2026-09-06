import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardContent,
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
            bgcolor: isLive ? '#fee2e2' : '#f1f5f9',
            color: isLive ? '#dc2626' : '#475569',
            fontWeight: 700,
            fontSize: '0.75rem'
          }}
        />
      );
    }

    if (c.key === 'attendanceRate' || c.key.includes('Rate')) {
      const num = Number(val);
      if (!isNaN(num)) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: num >= 95 ? '#16a34a' : '#ea580c' }}>
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
              startIcon={<RefreshIcon />}
              onClick={loadData}
              sx={{ bgcolor: '#fff', borderColor: '#cbd5e1', color: '#334155', fontWeight: 600 }}
            >
              Làm mới
            </Button>
          </Box>
        }
      />

      <Card sx={{ mb: 3, borderRadius: 2.5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Tìm kiếm trong danh sách..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              sx={{ width: { xs: '100%', sm: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                  </InputAdornment>
                )
              }}
            />

            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
              Tổng cộng {filtered.length} bản ghi
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {err && (
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
          {err}
        </Alert>
      )}

      <Card sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
          <Table size="medium">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={{ fontWeight: 700, color: '#334155', py: 1.75 }}>
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
                      <TableCell key={c.key}>
                        <Skeleton variant="text" width="80%" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ py: 8, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        bgcolor: '#eff6ff',
                        color: '#2563eb',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2
                      }}
                    >
                      <SchoolIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#1e293b', mb: 0.5 }}>
                      Chưa có dữ liệu từ Google Classroom
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 480, mx: 'auto', mb: 3 }}>
                      Toàn bộ thông tin học tập và danh bạ được nạp trực tiếp từ Google Classroom. Hãy kết nối tài khoản hoặc tiến hành đồng bộ để hiển thị danh sách.
                    </Typography>
                    <Stack direction="row" spacing={1.5} justifyContent="center">
                      <Button
                        variant="contained"
                        startIcon={<CloudSyncIcon />}
                        onClick={() => navigate('/connections')}
                        sx={{
                          bgcolor: '#2563eb',
                          fontWeight: 700,
                          px: 2.5,
                          py: 1,
                          borderRadius: 2,
                          '&:hover': { bgcolor: '#1d4ed8' }
                        }}
                      >
                        Kết nối & Đồng bộ Classroom
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={loadData}
                        sx={{ borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
                      >
                        Thử lại
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center' }}>
                    <Box sx={{ color: '#94a3b8', fontSize: '2rem', mb: 1 }}>🔍</Box>
                    <Typography variant="body1" fontWeight={700} color="text.secondary">
                      Không tìm thấy kết quả phù hợp với từ khóa "{q}"
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Vui lòng thử tìm kiếm bằng tên, email hoặc mã lớp khác
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((x, i) => (
                  <TableRow
                    key={x.id || i}
                    hover
                    sx={{
                      '&:hover': { bgcolor: '#f8fafc' },
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} sx={{ py: 1.5 }}>
                        {renderCellContent(c, x)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {items.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filtered.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Số dòng mỗi trang:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count}`}
            sx={{ borderTop: '1px solid #f1f5f9' }}
          />
        )}
      </Card>
    </>
  );
}