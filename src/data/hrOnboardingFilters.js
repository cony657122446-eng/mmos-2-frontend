import { displayText } from './displayText.js';

export function filterOnboardingRows(rows, filters = {}) {
  const query = displayText(filters.query || '').trim().toLowerCase();
  return rows.filter(person => {
    const signature = person.contractSigned === true ? 'signed' : person.contractSigned === false ? 'unsigned' : 'unknown';
    const materials = person.materialsComplete === true ? 'complete' : person.materialsComplete === false ? 'incomplete' : 'unknown';
    return (!query || displayText(`${person.name} ${person.employeeNo} ${person.recruitmentNo}`).toLowerCase().includes(query)) &&
      (!filters.project || person.projectIds.includes(filters.project)) &&
      (!filters.signature || signature === filters.signature) &&
      (!filters.materials || materials === filters.materials) &&
      (!filters.checklist || person.checklistStatus === filters.checklist);
  });
}
