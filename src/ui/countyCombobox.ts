import { CountyDataCompleteness } from "../types";

export function mountAccessibleCountySelector(
  rootEl: HTMLElement,
  counties: CountyDataCompleteness[],
  activeFips: string,
  onSelect: (selected: CountyDataCompleteness) => void
): void {
  const sorted = [...counties].sort((a, b) => {
    if (a.state === "CA" && b.state !== "CA") return -1;
    if (a.state !== "CA" && b.state === "CA") return 1;
    return `${a.state}-${a.name}`.localeCompare(`${b.state}-${b.name}`);
  });

  const active = sorted.find((c) => c.fips === activeFips) ?? sorted[0];

  rootEl.innerHTML = `
    <label for="city-pretty-county-input" class="sr-only">Search County, Parish, or City</label>
    <input
      id="city-pretty-county-input"
      type="text"
      role="combobox"
      aria-expanded="false"
      aria-autocomplete="list"
      aria-controls="city-pretty-county-listbox"
      value="${active ? `${active.name}, ${active.state}` : "Los Angeles County, CA"}"
      placeholder="Search 637+ counties, parishes, cities…"
    />
    <ul id="city-pretty-county-listbox" role="listbox" hidden></ul>
  `;

  const inputEl = rootEl.querySelector<HTMLInputElement>("#city-pretty-county-input")!;
  const listEl = rootEl.querySelector<HTMLUListElement>("#city-pretty-county-listbox")!;

  const renderOptions = (query: string) => {
    const q = query.trim().toLowerCase();
    const matches = sorted
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.fips.startsWith(q)
      )
      .slice(0, 40);

    listEl.innerHTML = matches
      .map(
        (c) => `
        <li
          role="option"
          tabindex="-1"
          data-fips="${c.fips}"
          aria-selected="${c.fips === activeFips}"
        >
          <span>${c.name}, ${c.state}</span>
          <small>[${c.readiness_tier}]</small>
        </li>`
      )
      .join("");
    listEl.hidden = matches.length === 0;
    inputEl.setAttribute("aria-expanded", String(matches.length > 0));
  };

  inputEl.addEventListener("focus", () => renderOptions(""));
  inputEl.addEventListener("input", () => renderOptions(inputEl.value));

  listEl.addEventListener("click", (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLLIElement>("li[data-fips]");
    if (!li) return;
    const chosen = sorted.find((c) => c.fips === li.dataset.fips);
    if (chosen) {
      inputEl.value = `${chosen.name}, ${chosen.state}`;
      listEl.hidden = true;
      inputEl.setAttribute("aria-expanded", "false");
      onSelect(chosen);
    }
  });
}
