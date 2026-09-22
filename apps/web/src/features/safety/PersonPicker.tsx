/**
 * PersonPicker.tsx — ô chọn 1 người theo tên, gọi
 * `GET /api/safety/people/search?q=` (`people-search.ts`, K7). Backend chỉ
 * trả `{perId, name}` (KHÔNG email/uid vì lý do bảo mật) — component này
 * KHÔNG tự suy ra thêm thông tin gì khác ngoài 2 field đó.
 */
import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { api } from '../../services/api';

export interface PersonOption {
  perId: string;
  name: string;
}

export function PersonPicker({
  label,
  value,
  onChange,
  disabled
}: {
  label: string;
  value: PersonOption | null;
  onChange: (person: PersonOption | null) => void;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (value && !options.some((o) => o.perId === value.perId)) return [value, ...options];
    return options;
  }, [options, value]);

  return (
    <Autocomplete
      value={value}
      onChange={(_, v) => onChange(v)}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      options={optionsWithSelected}
      getOptionLabel={(o) => (o ? `${o.name} (${o.perId})` : '')}
      isOptionEqualToValue={(a, b) => a.perId === b.perId}
      loading={loading}
      disabled={disabled}
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
  );
}
