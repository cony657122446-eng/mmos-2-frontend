import React from 'react';
import { DASHBOARD_KEY, loadPreview } from '../data/operationsDashboard';

export function useOperationsPreview() {
  const [state, setState] = React.useState(null), [error, setError] = React.useState('');
  const reload = React.useCallback(() => { try { setState(loadPreview()); setError(''); } catch (e) { setError(e.message); } }, []);
  React.useEffect(() => {
    reload();
    const sync = e => { if (!e.key || e.key === DASHBOARD_KEY) reload(); };
    window.addEventListener('storage', sync);
    window.addEventListener('mmos:operations-updated', reload);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('mmos:operations-updated', reload); };
  }, [reload]);
  return { state, setState, error, reload };
}
