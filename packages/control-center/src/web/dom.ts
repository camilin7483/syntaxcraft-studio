type Child = Node | string | number | false | null | undefined;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children)
    if (child !== false && child != null)
      node.append(child instanceof Node ? child : String(child));
  return node;
}

export function button(
  text: string,
  click: () => void,
  kind = '',
  disabled = false,
): HTMLButtonElement {
  const node = el('button', `button ${kind}`, text);
  node.type = 'button';
  node.disabled = disabled;
  node.addEventListener('click', click);
  return node;
}

export function option(value: string, label: string): HTMLOptionElement {
  const node = el('option', '', label);
  node.value = value;
  return node;
}

export function select(
  id: string,
  value: string,
  options: Iterable<readonly [string, string]>,
  change: (value: string) => void,
): HTMLSelectElement {
  const node = el('select');
  node.id = id;
  for (const [key, label] of options) node.append(option(key, label));
  node.value = value;
  node.addEventListener('change', () => change(node.value));
  return node;
}

export function field(label: string, control: HTMLElement, description?: string): HTMLElement {
  const note = description ? el('span', 'field-note', description) : undefined;
  if (note && control.id) {
    note.id = `${control.id}-description`;
    control.setAttribute('aria-describedby', note.id);
  }
  return el('label', 'field', el('span', 'field-name', label), control, note);
}

export function panel(title: string, ...children: Child[]): HTMLElement {
  return el('section', 'panel', el('h2', 'panel-title', title), ...children);
}

export function input(id: string, value: string, type = 'text'): HTMLInputElement {
  const node = el('input');
  node.type = type;
  node.id = id;
  node.value = value;
  return node;
}

export function icon(name: string, className = 'ui-icon'): SVGSVGElement {
  const paths: Record<string, string> = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    colors: 'M12 2 3 14a6 6 0 0 0 6 8h6a6 6 0 0 0 6-8L12 2Z M7 16a3 3 0 0 0 3 3',
    languages: 'm8 6-5 6 5 6m8-12 5 6-5 6m-2-15-4 18',
    themes: 'M3 4h18v16H3zM3 8h18M7 12h3v4H7zm7 0h3v4h-3z',
    icons: 'm12 2 9 5v10l-9 5-9-5V7l9-5Zm-9 5 9 5 9-5m-9 5v10',
    organizer: 'M4 5h16M4 10h10M8 15h12M8 20h12M4 15h.1M4 20h.1',
    profiles: 'M6 5h13v15H6zM3 15V2h13m-6 8h5m-5 4h5',
    accessibility: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v10m-4-5h8',
    settings: 'M4 6h16M4 12h16M4 18h16M9 4v4m6 2v4m-5 2v4',
    arrow: 'M4 12h15m-6-6 6 6-6 6',
    check: 'm5 11 4 4 10-10',
    search: 'M15 15l5 5m-3-9a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
    brand: 'm8 7-5 5 5 5m8-10 5 5-5 5m-2-12-4 14',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(svg.namespaceURI, 'path');
  shape.setAttribute('d', paths[name] ?? '');
  svg.append(shape);
  return svg;
}
