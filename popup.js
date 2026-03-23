// popup.js — Jenteck Extension Manager

let allExtensions = [];
let currentTab = 'all';
let searchQuery = '';

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadExtensions();

  document.getElementById('search').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    render();
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      render();
    });
  });

  document.getElementById('btn-all-on').addEventListener('click', () => bulkToggle(true));
  document.getElementById('btn-all-off').addEventListener('click', () => bulkToggle(false));
});

// ── LOAD ──────────────────────────────────────────────────
function loadExtensions() {
  chrome.management.getAll((extensions) => {
    // Filter out this extension itself, and only include enabled/disabled (not themes by default)
    const selfId = chrome.runtime.id;
    allExtensions = extensions
      .filter(ext => ext.id !== selfId)
      .sort((a, b) => a.name.localeCompare(b.name));
    render();
  });
}

// ── FILTER ────────────────────────────────────────────────
function getFiltered() {
  return allExtensions.filter(ext => {
    const matchesTab =
      currentTab === 'all' ||
      (currentTab === 'enabled' && ext.enabled) ||
      (currentTab === 'disabled' && !ext.enabled);
    const matchesSearch =
      !searchQuery || ext.name.toLowerCase().includes(searchQuery);
    return matchesTab && matchesSearch;
  });
}

// ── RENDER ────────────────────────────────────────────────
function render() {
  const list = document.getElementById('ext-list');
  const filtered = getFiltered();
  const total = allExtensions.length;
  const enabledCount = allExtensions.filter(e => e.enabled).length;

  // Update badges
  document.getElementById('count-badge').textContent = `${total} extension${total !== 1 ? 's' : ''}`;
  document.getElementById('footer-stats').textContent = `${enabledCount} on · ${total - enabledCount} off`;

  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🔍</div>
        <div class="empty-text">No extensions found</div>
      </div>`;
    return;
  }

  filtered.forEach((ext, i) => {
    const card = buildCard(ext, i);
    list.appendChild(card);
  });
}

// ── BUILD CARD ────────────────────────────────────────────
function buildCard(ext, index) {
  const card = document.createElement('div');
  card.className = `ext-card${ext.enabled ? '' : ' disabled'}`;
  card.style.animationDelay = `${index * 30}ms`;
  card.style.opacity = '0';

  // Icon
  let iconEl;
  const iconUrl = getBestIcon(ext);
  if (iconUrl) {
    iconEl = document.createElement('img');
    iconEl.className = 'ext-icon';
    iconEl.src = iconUrl;
    iconEl.alt = '';
    iconEl.onerror = () => {
      const fallback = makeFallback(ext.name);
      iconEl.replaceWith(fallback);
    };
  } else {
    iconEl = makeFallback(ext.name);
  }

  // Info
  const info = document.createElement('div');
  info.className = 'ext-info';

  const name = document.createElement('div');
  name.className = 'ext-name';
  name.textContent = ext.name;
  name.title = ext.name;

  const type = document.createElement('div');
  type.className = 'ext-type';
  type.textContent = ext.type === 'extension' ? 'extension' : ext.type;

  info.appendChild(name);
  info.appendChild(type);

  // Toggle
  const label = document.createElement('label');
  label.className = 'toggle';
  label.title = ext.enabled ? 'Disable' : 'Enable';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = ext.enabled;

  const track = document.createElement('div');
  track.className = 'toggle-track';
  const thumb = document.createElement('div');
  thumb.className = 'toggle-thumb';

  label.appendChild(input);
  label.appendChild(track);
  label.appendChild(thumb);

  input.addEventListener('change', () => {
    const newState = input.checked;
    label.title = newState ? 'Disable' : 'Enable';

    chrome.management.setEnabled(ext.id, newState, () => {
      if (chrome.runtime.lastError) {
        // Revert on error
        input.checked = !newState;
        return;
      }
      // Update local state
      const found = allExtensions.find(e => e.id === ext.id);
      if (found) found.enabled = newState;
      card.classList.toggle('disabled', !newState);

      // Update footer stats
      const total = allExtensions.length;
      const enabledCount = allExtensions.filter(e => e.enabled).length;
      document.getElementById('footer-stats').textContent = `${enabledCount} on · ${total - enabledCount} off`;

      // If tab filter would hide this, re-render after short delay
      if (currentTab !== 'all') {
        setTimeout(render, 300);
      }
    });
  });

  card.appendChild(iconEl);
  card.appendChild(info);
  card.appendChild(label);

  return card;
}

// ── HELPERS ───────────────────────────────────────────────
function getBestIcon(ext) {
  if (!ext.icons || ext.icons.length === 0) return null;
  const sorted = [...ext.icons].sort((a, b) => b.size - a.size);
  // Prefer 32 or 48 for our display size
  const ideal = sorted.find(i => i.size >= 32) || sorted[0];
  return ideal ? ideal.url : null;
}

function makeFallback(name) {
  const div = document.createElement('div');
  div.className = 'ext-icon-fallback';
  div.textContent = (name || '?')[0].toUpperCase();
  return div;
}

// ── BULK TOGGLE ───────────────────────────────────────────
function bulkToggle(enable) {
  const filtered = getFiltered();
  const toChange = filtered.filter(ext => ext.enabled !== enable);
  if (toChange.length === 0) return;

  let done = 0;
  toChange.forEach(ext => {
    chrome.management.setEnabled(ext.id, enable, () => {
      if (!chrome.runtime.lastError) {
        const found = allExtensions.find(e => e.id === ext.id);
        if (found) found.enabled = enable;
      }
      done++;
      if (done === toChange.length) render();
    });
  });
}
