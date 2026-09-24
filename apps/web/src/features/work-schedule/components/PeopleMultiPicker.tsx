/**
 * PeopleMultiPicker.tsx — chọn NHIỀU người theo tên, dùng chung
 * `GET /api/safety/people/search?q=` với PersonPicker.tsx (module An
 * toàn) — endpoint đọc từ hạ tầng identity dùng chung, không riêng module
 * nào, nên tái dùng thẳng thay vì viết lại lời gọi API.
 *
 * Nút "Chọn toàn bộ" (Sin yêu cầu 2026-09-21) — tự động chọn HẾT người có
 * tài khoản qua `GET /api/safety/people/all`, thay vì bấm chọn từng người
 * khi muốn mời toàn trường tham dự 1 lịch.
 */
import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../../services/api';
import type { PersonOption } from '../../safety/PersonPicker';

export function PeopleMultiPicker({
  label,
  value,
  onChange,
  disabled
}: {
  label: string;
  value: PersonOption[];
  onChange: (people: PersonOption[]) => void;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const query = inputValue.trim();

  useEffect(() => {
    if (query.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<{ results: PersonOption[] }>(`/api/safety/people/search?q=${encodeURIComponent(query)}`)
        .then((res) => {
          if (!cancelled) setOptions(res.results || []);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const optionsWithSelected = useMemo(() => {
    const extra = value.filter((v) => !options.some((o) => o.perId === v.perId));
    return [...extra, ...options];
  }, [options, value]);

  const selectAll = async () => {
    setSelectingAll(true);
    try {
      const res = await api.get<{ results: PersonOption[] }>('/api/safety/people/all');
      onChange(res.results || []);
    } catch {
      // Best-effort — lỗi tải danh sách không cần chặn form, người dùng vẫn
      // chọn tay được như bình thường.
    } finally {
      setSelectingAll(false);
    }
  };

  return (
    <Stack spacing={0.75}>
      <Autocomplete
        multiple
        value={value}
        onChange={(_, v) => onChange(v)}
        inputValue={inputValue}
        onInputChange={(_, v) => setInputValue(v)}
        options={optionsWithSelected}
        getOptionLabel={(o) => `${o.name} (${o.perId})`}
        isOptionEqualToValue={(a, b) => a.perId === b.perId}
        loading={loading}
        disabled={disabled}
        // Trường ~100 người, bấm "Chọn toàn bộ" trước đây render HẾT từng
        // chip trong ô -> modal dài vô tận (Sin phản hồi 2026-09-24). Chỉ
        // hiện 4 chip đầu + "+N" còn lại (limitTags chuẩn MUI), vẫn đủ để
        // bỏ chọn từng người nếu cần (bấm vào ô để xem/xoá lại).
        limitTags={4}
        getLimitTagsText={(more) => `+${more} người khác`}
        noOptionsText={query.length < 2 ? 'Gõ ít nhất 2 ký tự để tìm' : 'Không tìm thấy'}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Gõ tên để tìm..."
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              )
            }}
          />
        )}
      />
      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={selectAll} disabled={disabled || selectingAll} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
          {selectingAll ? 'Đang tải...' : 'Chọn toàn bộ'}
        </Button>
        {value.length > 0 && (
          <Button size="small" color="inherit" onClick={() => onChange([])} disabled={disabled} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
            Bỏ chọn hết
          </Button>
        )}
        {value.length > 0 && (
          <Typography variant="caption" sx={{ color: '#64748b', alignSelf: 'center' }}>
            Đã chọn {value.length} người
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
