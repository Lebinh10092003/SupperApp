import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  typography: {
    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: { fontWeight: 800, letterSpacing: '-0.035em' },
    h2: { fontWeight: 700, letterSpacing: '-0.025em' },
    h3: { fontWeight: 700, letterSpacing: '-0.025em' },
    h4: { fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '-0.015em' },
    subtitle1: { fontWeight: 600, fontSize: '0.9375rem', letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
    body1: { fontSize: '0.875rem', lineHeight: 1.55 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: 'none', fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem', color: '#64748b' }
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb', // School Royal Blue
      light: '#3b82f6',
      dark: '#1d4ed8',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#eff6ff', // Light Sky Blue tint
      light: '#f8fafc',
      dark: '#dbeafe',
      contrastText: '#1d4ed8'
    },
    success: {
      main: '#10b981', // Progress Emerald
      light: '#ecfdf5',
      dark: '#059669',
      contrastText: '#ffffff'
    },
    warning: {
      main: '#f59e0b', // Academic Amber
      light: '#fffbeb',
      dark: '#d97706',
      contrastText: '#ffffff'
    },
    error: {
      main: '#ef4444',
      light: '#fef2f2',
      dark: '#dc2626',
      contrastText: '#ffffff'
    },
    info: {
      main: '#0284c7', // Scholastic Cyan/Sky
      light: '#f0f9ff',
      dark: '#0369a1',
      contrastText: '#ffffff'
    },
    background: {
      default: '#f8fafc', // Clean bright background
      paper: '#ffffff'
    },
    text: {
      primary: '#0f172a', // High-contrast Slate 900
      secondary: '#64748b' // Clear readable Slate 500
    },
    divider: '#e2e8f0'
  },
  shape: {
    borderRadius: 10
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '7px 16px',
          fontWeight: 600,
          fontSize: '0.84rem',
          letterSpacing: '-0.01em',
          transition: 'all 0.15s ease-in-out'
        },
        containedPrimary: {
          backgroundColor: '#2563eb',
          color: '#ffffff',
          boxShadow: '0 1px 3px 0 rgba(37, 99, 235, 0.2)',
          '&:hover': {
            backgroundColor: '#1d4ed8',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
          }
        },
        containedSecondary: {
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
          '&:hover': {
            backgroundColor: '#dbeafe'
          }
        },
        outlined: {
          borderColor: '#cbd5e1',
          color: '#334155',
          backgroundColor: '#ffffff',
          '&:hover': {
            backgroundColor: '#f8fafc',
            borderColor: '#94a3b8'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          '&:hover': {
            borderColor: '#cbd5e1',
            boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.06)'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #f1f5f9',
          padding: '12px 16px',
          fontSize: '0.84rem',
          color: '#0f172a'
        },
        head: {
          fontWeight: 700,
          color: '#475569',
          backgroundColor: '#f8fafc',
          textTransform: 'uppercase',
          fontSize: '0.72rem',
          letterSpacing: '0.05em',
          borderBottom: '1px solid #e2e8f0'
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.12s ease',
          '&:hover': {
            backgroundColor: 'rgba(239, 246, 255, 0.6) !important'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 6,
          fontSize: '0.75rem',
          height: 24,
          border: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          color: '#334155'
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#ffffff',
          fontSize: '0.84rem',
          '& fieldset': {
            borderColor: '#cbd5e1'
          },
          '&:hover fieldset': {
            borderColor: '#94a3b8'
          },
          '&.Mui-focused fieldset': {
            borderColor: '#2563eb',
            borderWidth: '1.5px'
          }
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04)'
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontSize: '0.84rem',
          border: '1px solid #e2e8f0'
        }
      }
    }
  }
});