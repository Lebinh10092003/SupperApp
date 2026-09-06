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
            bgcolor: isLive ? '#fef2f2' : '#f4f4f5',
            color: isLive ? '#b91c1c' : '#18181b',
            border: isLive ? '1px solid #fecaca' : '1px solid #e4e4e7',
            fontWeight: 600,
            fontSize: '0.72rem',
            height: 22
          }}
        />
      );
    }

    if (c.key === 'attendanceRate' || c.key.includes('Rate')) {
      const num = Number(val);
      if (!isNaN(num)) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: num >= 95 ? '#15803d' : '#b45309', fontSize: '0.8125rem' }}>
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
                borderColor: '#e4e4e7',
                color: '#18181b',
                fontWeight: 500,
                fontSize: '0.78rem',
                '&:hover': { bgcolor: '#f4f4f5', borderColor: '#d4d4d8' }
              }}
            >
              Làm mới
            </Button>
          </Box>
        }
      />

      {/* shadcn Filter Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Lọc dữ liệu tìm kiếm..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          sx={{ width: { xs: '100%', sm: 300 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#a1a1aa', fontSize: 18 }} />
              </InputAdornment>
            ),
            sx: { height: 36, fontSize: '0.84rem' }
          }}
        />

        <Chip
          label={`Tổng cộng ${filtered.length} bản ghi`}
          size="small"
          sx={{
            bgcolor: '#f4f4f5',
            color: '#18181b',
            border: '1px solid #e4e4e7',
            fontWeight: 500,
            fontSize: '0.75rem',
            height: 26
          }}
        />
      </Box>

      {err && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 1.5, border: '1px solid #e4e4e7', bgcolor: '#f4f4f5', color: '#18181b' }}>
          {err}
        </Alert>
      )}

      {/* shadcn Table Block */}
      <Card sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', bgcolor: '#ffffff' }}>
        <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
          <Table size="medium">
            <TableHead sx={{ bgcolor: '#fcfcfd', borderBottom: '1px solid #e4e4e7' }}>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={{ fontWeight: 600, color: '#71717a', py: 1.25, fontSize: '0.72rem', letterSpacing: '0.04em' }}>
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
                      <TableCell key={c.key} sx={{ py: 1.5 }}>
                        <Skeleton variant="text" width="80%" height={20} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ py: 8, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        border: '1px solid #e4e4e7',
                        bgcolor: '#f4f4f5',
                        color: '#71717a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2
                      }}
                    >
                      <SchoolIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#09090b', mb: 0.5 }}>
                      Chưa có dữ liệu từ Google Classroom
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#71717a', maxWidth: 440, mx: 'auto', mb: 2.5, fontSize: '0.8125rem' }}>
                      Toàn bộ thông tin học tập và danh bạ được nạp trực tiếp từ Google Classroom. Hãy kết nối tài khoản hoặc tiến hành đồng bộ để hiển thị danh sách.
                    </Typography>
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button
                        variant="contained"
                        startIcon={<CloudSyncIcon sx={{ fontSize: 16 }} />}
                        onClick={() => navigate('/connections')}
                        sx={{
                          bgcolor: '#18181b',
                          color: '#fafafa',
                          fontWeight: 500,
                          fontSize: '0.8125rem',
                          px: 2,
                          py: 0.75,
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: '#27272a' }
                        }}
                      >
                        Kết nối & Đồng bộ Classroom
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                        onClick={loadData}
                        sx={{ borderColor: '#e4e4e7', color: '#18181b', fontWeight: 500, fontSize: '0.8125rem' }}
                      >
                        Thử lại
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#09090b', mb: 0.5 }}>
                      Không tìm thấy kết quả phù hợp với "{q}"
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#71717a' }}>
                      Vui lòng thử tìm kiếm bằng từ khóa khác
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((x, i) => (
                  <TableRow
                    key={x.id || i}
                    sx={{
                      borderBottom: '1px solid #f4f4f5',
                      '&:hover': { bgcolor: 'rgba(244, 244, 245, 0.5) !important' }
                    }}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} sx={{ py: 1.25, fontSize: '0.84rem' }}>
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
              borderTop: '1px solid #e4e4e7',
              color: '#71717a',
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