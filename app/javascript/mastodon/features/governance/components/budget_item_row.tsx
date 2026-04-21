import type { BudgetItem } from './proposal_tabs/tab_plan';

export const BudgetItemRow: React.FC<{ item: BudgetItem }> = ({ item }) => (
  <tr className={`governance-budget-row governance-budget-row--${item.status}`}>
    <td className='governance-budget-row__description'>{item.description}</td>
    <td className='governance-budget-row__cost'>
      {item.currency} {(item.cost_estimate ?? 0).toFixed(2)}
    </td>
    <td className='governance-budget-row__status'>
      <span className={`governance-budget-status governance-budget-status--${item.status}`}>
        {item.status}
      </span>
    </td>
  </tr>
);
