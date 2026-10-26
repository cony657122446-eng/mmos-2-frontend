export function scopeManagerTodos(rows, role, manager = 'all', actor = '王然', ownerField = 'pm') {
  if (role === 'PM') return rows.filter(row => row[ownerField] === actor);
  if (role === 'PMO') return manager === 'all' ? rows : rows.filter(row => row[ownerField] === manager);
  return [];
}
