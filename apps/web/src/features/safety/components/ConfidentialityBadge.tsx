import { Chip } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

export function ConfidentialityBadge({
  confidentiality,
  redacted
}: {
  confidentiality: 'C1' | 'C2' | 'C3' | 'C4';
  redacted?: boolean;
}) {
  if (redacted) {
    return (
      <Chip
        icon={<LockOutlinedIcon sx={{ fontSize: '14px !important' }} />}
        label={confidentiality}
        size="small"
        sx={{ bgcolor: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.7rem', height: 22 }}
      />
    );
  }
  return (
    <Chip
      label={confidentiality}
      size="small"
      sx={{ bgcolor: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.7rem', height: 22 }}
    />
  );
}
