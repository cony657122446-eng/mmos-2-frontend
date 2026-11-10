import React from 'react';
import { subscribeHr } from '../data/hrWorkspace';

export function useHrFeature(read, dependencies) {
  const signature = JSON.stringify(dependencies);
  const [stored, setView] = React.useState(null);
  const [error, setError] = React.useState('');
  const refresh = React.useCallback(() => {
    try { setView({ view: read(), signature }); setError(''); }
    catch (failure) { setView(null); setError(failure.message || '数据读取失败'); }
  }, dependencies);
  React.useEffect(() => { refresh(); return subscribeHr(refresh); }, [refresh]);
  return { view: stored?.signature === signature ? stored.view : null, error, refresh };
}
