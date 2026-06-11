import { Component, type ReactNode } from 'react';
import { APP_NAME } from './brand';

// App-wide safety net: a render/runtime error shows a recoverable screen and a
// "Reload" action instead of a blank white page in production.
type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 18px', lineHeight: 1.5 }}>
            {APP_NAME} hit an unexpected error. Reloading usually fixes it. If it keeps happening, sign out and back in.
          </p>
          <button onClick={() => window.location.reload()} style={btn}>Reload {APP_NAME}</button>
        </div>
      </div>
    );
  }
}

const wrap: React.CSSProperties = { minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#f8fafc', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' };
const card: React.CSSProperties = { maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '32px 28px', boxShadow: '0 10px 40px rgba(2,6,23,0.06)' };
const btn: React.CSSProperties = { height: 44, padding: '0 22px', borderRadius: 12, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' };
