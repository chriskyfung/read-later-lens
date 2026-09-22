import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveFolder, setActiveTab } from '../src/core/state.js';
import { renderAll } from '../src/views/main-view.js';
import { renderSidebar } from '../src/views/sidebar.js';
import { renderBookmarkCards } from '../src/views/bookmarks.js';
import { renderTrashView } from '../src/views/trash.js';
import { renderWordCloud } from '../src/views/wordcloud.js';
import { renderDomainChart } from '../src/views/domains.js';
import { renderConceptLinkageGraph } from '../src/views/linkage.js';

vi.mock('../src/views/sidebar.js', () => ({ renderSidebar: vi.fn() }));
vi.mock('../src/views/bookmarks.js', () => ({ renderBookmarkCards: vi.fn() }));
vi.mock('../src/views/trash.js', () => ({ renderTrashView: vi.fn() }));
vi.mock('../src/views/wordcloud.js', () => ({ renderWordCloud: vi.fn() }));
vi.mock('../src/views/domains.js', () => ({ renderDomainChart: vi.fn() }));
vi.mock('../src/views/linkage.js', () => ({ renderConceptLinkageGraph: vi.fn() }));

const analytics = {
  wordcloud: renderWordCloud,
  domains: renderDomainChart,
  linkage: renderConceptLinkageGraph,
};

beforeEach(() => {
  vi.clearAllMocks();
  setActiveTab('bookmarks');
  setActiveFolder('ALL');
});
afterEach(() => {
  setActiveTab('bookmarks');
  setActiveFolder('ALL');
});

describe('renderAll', () => {
  it.each(['bookmarks', 'wordcloud', 'domains', 'linkage'])(
    'renders sidebar and cards before only the active analytics view (%s)',
    (tab) => {
      setActiveTab(tab);
      renderAll();

      expect(renderSidebar).toHaveBeenCalledExactlyOnceWith();
      expect(renderBookmarkCards).toHaveBeenCalledExactlyOnceWith();
      expect(renderSidebar.mock.invocationCallOrder[0]).toBeLessThan(
        renderBookmarkCards.mock.invocationCallOrder[0],
      );
      for (const [name, render] of Object.entries(analytics)) {
        if (name === tab) {
          expect(render).toHaveBeenCalledExactlyOnceWith();
          expect(renderBookmarkCards.mock.invocationCallOrder[0]).toBeLessThan(
            render.mock.invocationCallOrder[0],
          );
        } else {
          expect(render).not.toHaveBeenCalled();
        }
      }
    },
  );

  it('reads the live activeTab binding on successive renders', () => {
    setActiveTab('wordcloud');
    renderAll();
    setActiveTab('domains');
    renderAll();
    setActiveTab('linkage');
    renderAll();
    setActiveTab('bookmarks');
    renderAll();

    expect(renderSidebar).toHaveBeenCalledTimes(4);
    expect(renderBookmarkCards).toHaveBeenCalledTimes(4);
    for (const render of Object.values(analytics)) expect(render).toHaveBeenCalledTimes(1);
  });
  it('renders the trash view instead of the grid while the trash folder is active', () => {
    setActiveFolder('TRASH');
    renderAll();

    expect(renderTrashView).toHaveBeenCalledExactlyOnceWith();
    expect(renderBookmarkCards).not.toHaveBeenCalled();

    setActiveFolder('ALL');
  });
});
