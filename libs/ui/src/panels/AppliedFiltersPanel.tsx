import type { Filters } from "@conversational/contracts";
import type { Action } from "@conversational/contracts";

type Props = {
  filters: Filters;
  lastAction?: Action;
};

export function AppliedFiltersPanel({ filters, lastAction }: Props) {
  return (
    <section className="applied-filters">
      <h3>Filtros aplicados</h3>
      <ul>
        <li>Cidade: {filters.cidade ?? "-"}</li>
        <li>Ano: {filters.ano?.join(", ") ?? "-"}</li>
        <li>Mes: {filters.mes?.join(", ") ?? "-"}</li>
        <li>Indicador: {filters.indicador ?? "-"}</li>
      </ul>
      <div className="last-action">
        <strong>Ultima acao:</strong>
        <pre>{lastAction ? JSON.stringify(lastAction, null, 2) : "-"}</pre>
      </div>
    </section>
  );
}
