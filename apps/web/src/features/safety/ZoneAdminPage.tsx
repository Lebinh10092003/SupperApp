import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { CAMPUS_IDS, CAMPUS_LABEL } from './constants';

/**
 * Quản lý khu vực — CRUD dạng bảng cho campus_zones/zone_categories/
 * campus_map_markers (zone-admin.routes.ts, đã có đủ backend từ trước).
 *
 * KHÁC bản Firebase cũ CÓ Ý: bản gốc là trình vẽ kéo-thả trực quan
 * (Konva.js canvas — vẽ hình chữ nhật/tròn trực tiếp trên bản đồ, resize
 * bằng tay cầm góc). Việc dựng lại canvas đó là 1 hạng mục lớn riêng
 * (tương đương độ phức tạp cả 1 module), CHƯA làm ở đợt này — polygon
 * (toạ độ % viền khu vực) ở đây nhập bằng JSON tay thay vì vẽ, CẦN Sin
 * xác nhận có thực sự cần bản vẽ trực quan hay bảng nhập liệu tạm đủ
 * dùng trước khi đầu tư thêm.
 */

// Khớp đúng VALID_ZONE_ICON_KEYS ở backend (zoneStats.ts) — server từ chối
// mọi giá trị ngoài danh sách này, nên UI dùng select thay vì text tự do.
const ZONE_ICON_KEYS = [
  'restroom', 'plant', 'health', 'library', 'canteen', 'stairs', 'parking',
  'gate', 'sports', 'water', 'trash', 'security', 'electrical',
  'fire_extinguisher', 'other'
];

interface ZoneCategory {
  categoryId: string;
  label: string;
  color: string;
  order: number;
  active: boolean;
}

interface CampusZone {
  zoneId: string;
  campusId: string;
  label: string;
  order: number;
  polygonPercent: Array<{ x: number; y: number }>;
  shapeType: string;
  categoryId: string | null;
  color: string | null;
  parentZoneId: string | null;
  active: boolean;
}

interface CampusMapMarker {
  markerId: string;
  campusId: string;
  iconKey: string;
  xPercent: number;
  yPercent: number;
  color: string | null;
  active: boolean;
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function CategoriesPanel() {
  const [items, setItems] = useState<ZoneCategory[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ZoneCategory | null>(null);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [order, setOrder] = useState(0);

  const load = () => {
    api.get<ZoneCategory[]>('/api/safety/zone-categories').then(setItems).catch((e: any) => setError(e.message));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setLabel('');
    setColor('#2563eb');
    setOrder(items.length);
    setOpen(true);
  };
  const openEdit = (c: ZoneCategory) => {
    setEditing(c);
    setLabel(c.label);
    setColor(c.color);
    setOrder(c.order);
    setOpen(true);
  };

  const save = async () => {
    setError('');
    try {
      await api.post('/api/safety/zone-categories', {
        categoryId: editing?.categoryId || genId('cat'),
        label: label.trim(),
        color,
        order
      });
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Lưu thất bại.');
    }
  };

  const remove = async (categoryId: string) => {
    setError('');
    try {
      await api.delete(`/api/safety/zone-categories/${categoryId}`);
      load();
    } catch (e: any) {
      setError(e.message || 'Xoá thất bại (có thể đang được khu vực nào đó dùng).');
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Button startIcon={<AddCircleOutlineIcon />} onClick={openCreate} sx={{ mb: 2 }}>
        Thêm nhóm khu vực
      </Button>
      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tên nhóm</TableCell>
              <TableCell>Màu</TableCell>
              <TableCell>Thứ tự</TableCell>
              <TableCell align="right">Hành động</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.categoryId}>
                <TableCell>{c.label}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.color} sx={{ bgcolor: c.color, color: '#fff' }} />
                </TableCell>
                <TableCell>{c.order}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openEdit(c)}>Sửa</Button>
                  <Button size="small" color="error" onClick={() => remove(c.categoryId)}>Xoá</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editing ? 'Sửa nhóm khu vực' : 'Thêm nhóm khu vực'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Tên nhóm *" value={label} onChange={(e) => setLabel(e.target.value)} fullWidth />
            <TextField label="Màu (hex) *" value={color} onChange={(e) => setColor(e.target.value)} fullWidth type="color" />
            <TextField label="Thứ tự" type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={save} disabled={!label.trim()}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ZonesPanel() {
  const [campusId, setCampusId] = useState('MAIN_CAMPUS');
  const [items, setItems] = useState<CampusZone[]>([]);
  const [categories, setCategories] = useState<ZoneCategory[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CampusZone | null>(null);
  const [label, setLabel] = useState('');
  const [order, setOrder] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [polygonText, setPolygonText] = useState('[{"x":10,"y":10},{"x":60,"y":10},{"x":60,"y":50},{"x":10,"y":50}]');

  const load = () => {
    api.get<CampusZone[]>(`/api/safety/campus-zones/admin?campusId=${campusId}`).then(setItems).catch((e: any) => setError(e.message));
  };
  useEffect(load, [campusId]);
  useEffect(() => {
    api.get<ZoneCategory[]>('/api/safety/zone-categories').then(setCategories).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setLabel('');
    setOrder(items.length);
    setCategoryId('');
    setPolygonText('[{"x":10,"y":10},{"x":60,"y":10},{"x":60,"y":50},{"x":10,"y":50}]');
    setOpen(true);
  };
  const openEdit = (z: CampusZone) => {
    setEditing(z);
    setLabel(z.label);
    setOrder(z.order);
    setCategoryId(z.categoryId || '');
    setPolygonText(JSON.stringify(z.polygonPercent));
    setOpen(true);
  };

  const save = async () => {
    setError('');
    let polygonPercent;
    try {
      polygonPercent = JSON.parse(polygonText);
    } catch {
      setError('Toạ độ khu vực (JSON) không hợp lệ.');
      return;
    }
    try {
      await api.post('/api/safety/campus-zones', {
        zoneId: editing?.zoneId || genId('zone'),
        campusId,
        label: label.trim(),
        order,
        polygonPercent,
        shapeType: 'rect',
        categoryId: categoryId || null
      });
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Lưu thất bại.');
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField select size="small" label="Cơ sở" value={campusId} onChange={(e) => setCampusId(e.target.value)} sx={{ minWidth: 180 }}>
          {CAMPUS_IDS.map((c) => (
            <MenuItem key={c} value={c}>
              {CAMPUS_LABEL[c]}
            </MenuItem>
          ))}
        </TextField>
        <Button startIcon={<AddCircleOutlineIcon />} onClick={openCreate}>
          Thêm khu vực
        </Button>
      </Stack>
      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tên khu vực</TableCell>
              <TableCell>Nhóm</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Hành động</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((z) => (
              <TableRow key={z.zoneId}>
                <TableCell>{z.label}</TableCell>
                <TableCell>{categories.find((c) => c.categoryId === z.categoryId)?.label || '—'}</TableCell>
                <TableCell>{z.active ? 'Đang dùng' : 'Đã tắt'}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openEdit(z)}>Sửa</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editing ? 'Sửa khu vực' : 'Thêm khu vực'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Tên khu vực *" value={label} onChange={(e) => setLabel(e.target.value)} fullWidth />
            <TextField select label="Nhóm khu vực" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} fullWidth>
              <MenuItem value="">Không thuộc nhóm nào</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.categoryId} value={c.categoryId}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Thứ tự" type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} fullWidth />
            <TextField
              label="Toạ độ viền khu vực (JSON, % 0-100, tối thiểu 3 điểm) *"
              value={polygonText}
              onChange={(e) => setPolygonText(e.target.value)}
              multiline
              rows={3}
              fullWidth
              helperText="Chưa có trình vẽ trực quan — nhập toạ độ tay dạng [{x,y},...]. Sẽ nâng cấp thành canvas kéo-thả nếu cần."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={save} disabled={!label.trim()}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function MarkersPanel() {
  const [campusId, setCampusId] = useState('MAIN_CAMPUS');
  const [items, setItems] = useState<CampusMapMarker[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [iconKey, setIconKey] = useState('other');
  const [xPercent, setXPercent] = useState(50);
  const [yPercent, setYPercent] = useState(50);

  const load = () => {
    api.get<CampusMapMarker[]>(`/api/safety/campus-map-markers?campusId=${campusId}`).then(setItems).catch((e: any) => setError(e.message));
  };
  useEffect(load, [campusId]);

  const save = async () => {
    setError('');
    try {
      await api.post('/api/safety/campus-map-markers', {
        markerId: genId('marker'),
        campusId,
        iconKey,
        xPercent,
        yPercent
      });
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Lưu thất bại.');
    }
  };

  const remove = async (markerId: string) => {
    try {
      await api.delete(`/api/safety/campus-map-markers/${markerId}`);
      load();
    } catch (e: any) {
      setError(e.message || 'Xoá thất bại.');
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField select size="small" label="Cơ sở" value={campusId} onChange={(e) => setCampusId(e.target.value)} sx={{ minWidth: 180 }}>
          {CAMPUS_IDS.map((c) => (
            <MenuItem key={c} value={c}>
              {CAMPUS_LABEL[c]}
            </MenuItem>
          ))}
        </TextField>
        <Button
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => {
            setIconKey('other');
            setXPercent(50);
            setYPercent(50);
            setOpen(true);
          }}
        >
          Thêm icon ghim
        </Button>
      </Stack>
      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Icon</TableCell>
              <TableCell>Vị trí (%)</TableCell>
              <TableCell align="right">Hành động</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((m) => (
              <TableRow key={m.markerId}>
                <TableCell>{m.iconKey}</TableCell>
                <TableCell>{m.xPercent}%, {m.yPercent}%</TableCell>
                <TableCell align="right">
                  <Button size="small" color="error" onClick={() => remove(m.markerId)}>Xoá</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Thêm icon ghim</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Mã icon (iconKey) *" value={iconKey} onChange={(e) => setIconKey(e.target.value)} fullWidth>
              {ZONE_ICON_KEYS.map((k) => (
                <MenuItem key={k} value={k}>
                  {k}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Vị trí X (%)" type="number" value={xPercent} onChange={(e) => setXPercent(Number(e.target.value))} fullWidth />
            <TextField label="Vị trí Y (%)" type="number" value={yPercent} onChange={(e) => setYPercent(Number(e.target.value))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={save} disabled={!iconKey.trim()}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function ZoneAdminPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Quản lý khu vực" subtitle="Nhóm khu vực, khu vực trong khuôn viên, icon ghim trên bản đồ" icon={<MapRoundedIcon />} />

      <Alert severity="info" sx={{ mb: 2 }}>
        Bản này là bảng nhập liệu — chưa có trình vẽ kéo-thả trực quan như bản cũ (Konva.js canvas). Toạ độ khu vực nhập bằng JSON tay.
      </Alert>

      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none', p: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Nhóm khu vực" />
          <Tab label="Khu vực" />
          <Tab label="Icon ghim" />
        </Tabs>
        {tab === 0 && <CategoriesPanel />}
        {tab === 1 && <ZonesPanel />}
        {tab === 2 && <MarkersPanel />}
      </Paper>
    </Box>
  );
}
