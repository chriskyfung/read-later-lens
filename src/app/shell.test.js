import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveFolder, setActiveTab } from '@/core/state';
import { renderAll } from './shell.js';
import { renderSidebar } from '@/features/sidebar';
import { renderBookmarkCards } from '@/features/bookmarks';
import { renderTrashView } from '@/features/trash';
import { renderWordCloud } from '@/features/wordcloud';
import { renderDomainChart } from '@/features/domains';
import { renderConceptLinkageGraph } from '@/features/linkage';

vi.mock('@/features/sidebar', () => ({ renderSidebar: vi.fn() }));
vi.mock('@/features/bookmarks', () => ({ renderBookmarkCards: vi.fn() }));
vi.mock('@/features/trash', () => ({ renderTrashView: vi.fn() }));
vi.mock('@/features/wordcloud', () => ({ renderWordCloud: vi.fn() }));
vi.mock('@/features/domains', () => ({ renderDomainChart: vi.fn() }));
vi.mock('@/features/linkage', () => ({ renderConceptLinkageGraph: vi.fn() }));

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
  it('does not hide the grid while the trash folder is active', () => {
    setActiveFolder('TRASH');
    renderAll();

    // The trash view is NOT rendered here — it owns the dedicated modal
    // (openTrashModal() from the sidebar row), so the grid stays mounted.
    expect(renderSidebar).toHaveBeenCalledTimes(1);
    expect(renderBookmarkCards).toHaveBeenCalledTimes(1);
    expect(renderTrashView).not.toHaveBeenCalled();
  });
});
