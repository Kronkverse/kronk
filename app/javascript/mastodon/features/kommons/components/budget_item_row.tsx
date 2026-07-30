import type { BudgetItem } from '../types';

export const BudgetItemRow: React.FC<{ item: BudgetItem }> = ({ item }) => (
  <tr className={`kommons-budget-row kommons-budget-row--${item.status}`}>
    <td className='kommons-budget-row__description'>{item.description}</td>
    <td className='kommons-budget-row__cost'>
      {item.currency} {item.cost_estimate.toFixed(2)}
    </td>
    <td className='kommons-budget-row__status'>
      <span
        className={`kommons-budget-status kommons-budget-status--${item.status}`}
      >
        {item.status}
      </span>
    </td>
  </tr>
);
