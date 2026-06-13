import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="w-screen h-screen bg-surface-base flex items-center justify-center text-fg">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold">Algo salió mal en la interfaz</p>
            <p className="text-xs text-fg/40 mt-1 break-words">{this.state.error?.message}</p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <RotateCw size={13} /> Reintentar
          </button>
        </div>
      </div>
    );
  }
}
