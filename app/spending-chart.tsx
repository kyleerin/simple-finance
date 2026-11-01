import { formatMoney } from "../lib/budget";
import { pieSlices, type CategorySummary } from "../lib/overview";

export function SpendingChart({ categories, currency }: { categories: CategorySummary[]; currency: string }) {
  const slices = pieSlices(categories);
  return (
    <section className="category" aria-labelledby="spending-chart-heading">
      <h2 id="spending-chart-heading">Monthly spending by category</h2>
      {slices.length === 0 ? <p>No spending recorded for this month.</p> : (
        <figure className="spending-chart">
          <svg viewBox="0 0 200 200" role="img" aria-label="Spending pie chart. Exact amounts and percentages are in the breakdown below.">
            {slices.length === 1
              ? <circle cx="100" cy="100" r="90" fill={slices[0].color} />
              : slices.map((slice) => <path key={slice.id} d={slice.path} fill={slice.color} stroke="currentColor" strokeWidth="1" />)}
          </svg>
          <figcaption>Actual spending only—not unspent budget. Includes archived categories.</figcaption>
          <table>
            <caption className="sr-only">Monthly spending breakdown</caption>
            <thead><tr><th scope="col">Category</th><th scope="col">Spent</th><th scope="col">Share</th></tr></thead>
            <tbody>{slices.map((slice) => (
              <tr key={slice.id}>
                <th scope="row"><span className="swatch" style={{ background: slice.color }} aria-hidden="true" />
                  {slice.name}{slice.archived_at ? " (archived)" : ""}</th>
                <td>{formatMoney(slice.spent_cents, currency)}</td>
                <td>{(slice.share * 100).toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
        </figure>
      )}
    </section>
  );
}
