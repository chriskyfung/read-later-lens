export let activeFolder = 'ALL';
/** @type {'ALL' | 'en' | 'zh' | 'ja' | 'other'} */
export let activeLang = 'ALL';
export let activeTag = null;
/** @type {'bookmarks' | 'wordcloud' | 'domains' | 'linkage'} */
export let activeTab = 'bookmarks';
export let searchQuery = '';
/** @type {'relevance' | 'newer' | 'older' | 'title_asc' | 'title_desc'} */
export let sortBy = 'relevance';
/** @type {Set<string>} */
export let selectedIds = new Set();

export function setActiveFolder(v) {
  activeFolder = v;
}
export function setActiveLang(v) {
  activeLang = v;
}
export function setActiveTag(v) {
  activeTag = v;
}
export function setActiveTab(v) {
  activeTab = v;
}
export function setSearchQuery(v) {
  searchQuery = v;
}
export function setSortBy(v) {
  sortBy = v;
}
export function setSelectedIds(v) {
  selectedIds = v;
}
