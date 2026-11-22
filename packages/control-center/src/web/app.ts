import { emptyProfile, validateProfile } from '../profile';
import type { Preferences, Profile, StoredProfile } from '../profile';
import { sections } from '../protocol';
import type { Section, StudioResponse, StudioState } from '../protocol';
import type { Scope } from '../settings';
import { dashboardPage, iconsPage, themesPage } from './appearance-pages';
import { colorsPage, languagesPage } from './color-page';
import { button, el, icon, select } from './dom';
import type { Request, StudioModel } from './model';
import { profilesPage } from './profiles-page';
import { accessibilityPage, organizerPage, settingsPage } from './settings-pages';

interface WebviewState {
  section: Section;
  scope: Scope;
  draft: Profile;
  baseline: Profile;
  edit?: { profileId: string; revision: number };
  language: string;
  token: string;
  compare: boolean;
}

declare function acquireVsCodeApi(): {
  getState(): WebviewState | undefined;
  setState(state: WebviewState): void;
  postMessage(message: unknown): void;
};
const vscode = acquireVsCodeApi();
const menu = {
  dashboard: ['Panel de control', 'Apariencia activa de VS Code y actividad reciente.'],
  colors: ['Estudio de color', 'Edita colores y estilos de sintaxis por token y lenguaje.'],
  languages: ['Lenguajes', 'Consulta qué puede resaltar cada gramática y proveedor.'],
  themes: ['Temas', 'Elige entre diez temas de color.'],
  icons: ['Estudio de iconos', 'Compara estilos de archivos, carpetas e interfaz.'],
  organizer: ['Organizador', 'Da formato al código y ajusta la indentación del editor.'],
  profiles: ['Perfiles', 'Guarda, duplica, importa y exporta configuraciones.'],
  accessibility: ['Accesibilidad', 'Comprueba el contraste y ajusta la legibilidad del editor.'],
  settings: ['Ajustes', 'Personaliza la interfaz y restaura cambios aplicados.'],
} as const satisfies Record<Section, readonly [string, string]>;

const pages: Record<Section, (model: StudioModel) => HTMLElement> = {
  dashboard: dashboardPage,
  colors: colorsPage,
  languages: languagesPage,
  themes: themesPage,
  icons: iconsPage,
  organizer: organizerPage,
  profiles: profilesPage,
  accessibility: accessibilityPage,
  settings: settingsPage,
};

type DraftState = Pick<WebviewState, 'draft' | 'baseline' | 'edit'>;
type Reply = Extract<StudioResponse, { type: 'result' }>;

class Studio implements StudioModel {
  section: Section;
  state?: StudioState;
  draft = emptyProfile();
  baseline = emptyProfile();
  edit?: WebviewState['edit'];
  scope: Scope = 'user';
  language = '';
  token = 'function-declaration';
  query = '';
  compare = false;
  organizer?: unknown;
  notice = '';
  private isError = false;
  private sequence = 0;
  private pending = new Map<number, Request>();
  private drafts: DraftState[] = [];
  private pointerDown = false;
  private pendingRender = false;
  private readonly live = el('div', 'announcement');
  private readonly frame = el('div', 'studio-frame');

  constructor(readonly root: HTMLElement) {
    const previous = vscode.getState();
    this.section =
      sections.find((section) => section === previous?.section) ??
      sections.find((section) => section === root.dataset.section) ??
      'dashboard';
    if (previous) {
      try {
        this.draft = validateProfile(previous.draft);
        this.baseline = validateProfile(previous.baseline);
        this.edit = previous.edit;
        this.language = previous.language;
        this.token = previous.token;
        this.compare = previous.compare;
        this.scope = previous.scope === 'workspace' ? 'workspace' : 'user';
      } catch {
        this.draft = emptyProfile();
        this.baseline = emptyProfile();
      }
    }
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    root.append(this.frame, this.live);
    root.addEventListener(
      'pointerdown',
      () => {
        this.pointerDown = true;
      },
      true,
    );
    const finishPointer = () => {
      this.pointerDown = false;
      if (this.pendingRender) this.render();
    };
    window.addEventListener('pointerup', () => window.setTimeout(finishPointer, 0));
    window.addEventListener('pointercancel', finishPointer);
    window.addEventListener('blur', finishPointer);
    window.addEventListener('message', (event: MessageEvent<StudioResponse>) =>
      this.receive(event.data),
    );
    this.render();
    this.send({ type: 'ready' });
  }

  get busy() {
    return this.pending.size > 0;
  }

  send = (request: Request) => {
    if (this.busy) return;
    const id = ++this.sequence;
    this.pending.set(id, request);
    this.notice = '';
    this.isError = false;
    vscode.postMessage({ ...request, id });
    this.render();
  };

  navigate = (section: Section) => {
    this.section = section;
    this.render();
    window.scrollTo({ top: 0 });
  };

  private receive(message: StudioResponse) {
    if (message.type === 'state') {
      this.state = message.state;
      if (!message.state.workspace) this.scope = 'user';
    } else if (message.type === 'navigate') {
      this.navigate(message.section);
      return;
    } else {
      const request = this.pending.get(message.id);
      if (!request && message.id !== 0) return;
      this.pending.delete(message.id);
      this.notice = message.message ?? '';
      this.isError = message.type === 'error';
      if (message.type === 'result') this.handleResult(message, request);
    }
    this.render();
  }

  private handleResult(message: Reply, request: Request | undefined) {
    if (message.profile) this.load(message.profile);
    if (message.saved) {
      this.edit = { profileId: message.saved.id, revision: message.saved.revision };
      this.draft = structuredClone(message.saved.profile);
      this.baseline = structuredClone(message.saved.profile);
    }
    if (Object.hasOwn(message, 'organizer')) this.organizer = message.organizer;
    if (
      request?.type === 'deleteProfile' &&
      message.message &&
      this.edit?.profileId === request.profileId
    )
      this.edit = undefined;
  }

  private pushDraft() {
    this.drafts.push({ baseline: this.baseline, draft: this.draft, edit: this.edit });
    if (this.drafts.length > 20) this.drafts.shift();
  }

  load = (profile: Profile, saved?: StoredProfile) => {
    this.pushDraft();
    this.draft = structuredClone(profile);
    this.baseline = structuredClone(profile);
    this.edit = saved ? { profileId: saved.id, revision: saved.revision } : undefined;
    this.render();
  };

  preference = <K extends keyof Preferences>(key: K, value?: Preferences[K]) => {
    this.update((draft) => {
      if (value === undefined) delete draft.preferences[key];
      else draft.preferences[key] = value;
    });
  };

  update = (apply: (draft: Profile) => void) => {
    const next = structuredClone(this.draft);
    apply(next);
    if (JSON.stringify(this.draft) === JSON.stringify(next)) return;
    this.pushDraft();
    this.draft = next;
    this.render();
  };

  private undoDraft() {
    const previous = this.drafts.pop();
    if (previous) {
      this.draft = previous.draft;
      this.baseline = previous.baseline;
      this.edit = previous.edit;
      this.render();
    }
  }

  private sidebar() {
    const brand = el(
      'div',
      'brand',
      el('span', 'brand-mark', icon('brand')),
      el('span', 'brand-type', 'SyntaxCraft', el('span', '', 'Studio')),
    );
    const nav = el('nav', 'nav');
    nav.setAttribute('aria-label', 'Secciones del panel');
    for (const section of sections) {
      const item = button('', () => this.navigate(section), 'nav-link');
      item.id = `nav-${section}`;
      item.append(icon(section), el('span', '', menu[section][0]));
      if (this.section === section) item.setAttribute('aria-current', 'page');
      nav.append(item);
    }
    return el('aside', 'sidebar', brand, nav);
  }

  private toolbar() {
    const target = select(
      'scope',
      this.scope,
      [
        ['user', 'Usuario'],
        ['workspace', 'Proyecto'],
      ],
      (value) => {
        this.scope = value === 'workspace' ? 'workspace' : 'user';
        this.render();
      },
    );
    const project = target.options.namedItem('workspace') ?? target.options[1];
    if (project) project.disabled = !this.state?.targets.workspace.available;
    target.setAttribute('aria-label', 'Ámbito de ajustes');
    const changed = JSON.stringify(this.draft) !== JSON.stringify(this.baseline);
    const scope = this.state?.targets[this.scope];
    const actions = el(
      'div',
      'inline toolbar-actions',
      button('Deshacer edición', () => this.undoDraft(), 'quiet', !this.drafts.length),
      button(
        'Restablecer borrador',
        () => this.update((draft) => Object.assign(draft, structuredClone(this.baseline))),
        'quiet',
        !changed,
      ),
      target,
      button(
        'Aplicar ajustes',
        () => this.send({ type: 'apply', profile: this.draft, scope: this.scope }),
        'primary',
        this.busy || !scope?.available,
      ),
    );
    return el(
      'div',
      'toolbar',
      el(
        'div',
        'draft-summary',
        el('span', 'status-dot'),
        el('span', '', this.draft.name || 'Borrador sin nombre'),
        el('span', 'draft-label', changed ? 'Cambios en borrador' : 'Borrador'),
      ),
      actions,
    );
  }

  render = () => {
    if (this.pointerDown) {
      this.pendingRender = true;
      return;
    }
    this.pendingRender = false;
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
    const [title, description] = menu[this.section];
    const header = el('header', 'page-heading', el('h1', '', title), el('p', '', description));
    const main = el('main', 'main', this.toolbar(), header, pages[this.section](this));
    main.id = 'main-content';
    main.tabIndex = -1;
    const skip = el('a', 'skip', 'Ir al contenido');
    skip.href = '#main-content';
    this.frame.replaceChildren(skip, this.sidebar(), main);
    this.live.textContent = this.notice;
    this.live.classList.toggle('error', this.isError);
    if (focus) document.getElementById(focus)?.focus({ preventScroll: true });
    vscode.setState({
      section: this.section,
      draft: this.draft,
      baseline: this.baseline,
      edit: this.edit,
      scope: this.scope,
      language: this.language,
      token: this.token,
      compare: this.compare,
    });
  };
}

const root = document.getElementById('studio');
if (root) new Studio(root);
