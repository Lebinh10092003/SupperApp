/**
 * PeopleMultiPicker.tsx — chọn NHIỀU người theo tên, dùng chung
 * `GET /api/safety/people/search?q=` với PersonPicker.tsx (module An
 * toàn) — endpoint đọc từ hạ tầng identity dùng chung, không riêng module
 * nào, nên tái dùng thẳng thay vì viết lại lời gọi API.
 */
import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
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

  return (
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
