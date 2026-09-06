import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: { fontWeight: 800, letterSpacing: '-0.035em' },
    h2: { fontWeight: 700, letterSpacing: '-0.025em' },
    h3: { fontWeight: 700, letterSpacing: '-0.025em' },
    h4: { fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '-0.015em' },
    subtitle1: { fontWeight: 500, fontSize: '0.9375rem', letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 500, fontSize: '0.875rem' },
    body1: { fontSize: '0.875rem', lineHeight: 1.55 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { fontWeight: 500, textTransform: 'none', fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem', color: '#71717a' }
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#18181b', // Zinc 900 (shadcn primary)
      light: '#27272a',
      dark: '#09090b',
      contrastText: '#fafafa'
    },
    secondary: {
      main: '#f4f4f5', // Zinc 100
      light: '#fafafa',
      dark: '#e4e4e7',
      contrastText: '#18181b'
    },
    success: {
      main: '#10b981',
      light: '#ecfdf5',
      dark: '#059669',
      contrastText: '#ffffff'
    },
    warning: {
      main: '#f59e0b',
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
      main: '#2563eb',
      light: '#eff6ff',
      dark: '#1d4ed8',
      contrastText: '#ffffff'
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff'
    },
    text: {
      primary: '#09090b',
      secondary: '#71717a'
    },
    divider: '#e4e4e7'
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '7px 14px',
          fontWeight: 500,
          fontSize: '0.84rem',
          letterSpacing: '-0.01em',
          transition: 'all 0.15s ease-in-out'
        },
        containedPrimary: {
          backgroundColor: '#18181b',
          color: '#fafafa',
          '&:hover': {
            backgroundColor: '#27272a'
          }
        },
        containedSecondary: {
          backgroundColor: '#f4f4f5',
          color: '#18181b',
          '&:hover': {
            backgroundColor: '#e4e4e7'
          }
        },
        outlined: {
          borderColor: '#e4e4e7',
          color: '#18181b',
          backgroundColor: '#ffffff',
          '&:hover': {
            backgroundColor: '#f4f4f5',
            borderColor: '#d4d4d8'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          border: '1px solid #e4e4e7',
          backgroundColor: '#ffffff',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          '&:hover': {
            borderColor: '#d4d4d8'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundImage: 'none',
          border: '1px solid #e4e4e7',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #f4f4f5',
          padding: '12px 16px',
          fontSize: '0.84rem',
          color: '#09090b'
        },
        head: {
          fontWeight: 600,
          color: '#71717a',
          backgroundColor: '#fcfcfd',
          textTransform: 'uppercase',
          fontSize: '0.72rem',
          letterSpacing: '0.04em',
          borderBottom: '1px solid #e4e4e7'
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.12s ease',
          '&:hover': {
            backgroundColor: 'rgba(244, 244, 245, 0.6) !important'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 6,
          fontSize: '0.75rem',
          height: 24,
          border: '1px solid #e4e4e7',
          backgroundColor: '#f4f4f5',
          color: '#18181b'
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: '#ffffff',
          fontSize: '0.84rem',
          '& fieldset': {
            borderColor: '#e4e4e7'
          },
          '&:hover fieldset': {
            borderColor: '#a1a1aa'
          },
          '&.Mui-focused fieldset': {
            borderColor: '#18181b',
            borderWidth: '1.5px'
          }
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: '1px solid #e4e4e7',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: '0.84rem',
          border: '1px solid #e4e4e7'
        }
      }
    }
  }
});