import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Aquí podrías enviar el error a un servicio de logs como Sentry
    console.error("Error capturado por el Boundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, error: null, retryKey: prev.retryKey + 1 }));
  };

  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <div className="h-full min-h-[200px] flex flex-col items-center justify-center p-6 text-center animate-fade-in bg-slate-800/50 rounded-2xl border border-red-500/20">
          <div className="p-3 bg-red-500/10 rounded-full mb-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 mb-1">{t('errors.somethingWrong')}</h3>
          <p className="text-xs text-slate-400 mb-4 max-w-[200px]">
            {t('errors.couldNotLoad')}
          </p>
          <button 
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <RefreshCw size={14} /> {t('errors.retry')}
          </button>
        </div>
      );
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

const ErrorBoundary = (props) => {
  const { t } = useTranslation();
  return <ErrorBoundaryInner {...props} t={t} />;
};

export default ErrorBoundary;