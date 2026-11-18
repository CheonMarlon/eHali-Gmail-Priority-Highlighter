(() => {
  "use strict";

  const ROW_SELECTOR = "tr.zA, tr[role='main'], [role='main'] tr[role='row'], [role='main'] .zA";
  const BAR_ID = "ehali-filter-bar";
  let settings = {
    enabled: true,
    rules: EHALI_DEFAULT_RULES.map(ehaliNormalizeRule),
    fallback: { ...EHALI_DEFAULT_FALLBACK }
  };
  let settingsVersion = 0;
  let scanTimer = null;
  let observer = null;
  let activeFilter = null;
  let filterBar = null;

  const text = el => (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();

  function emailData(row) {
    const senderNode = row.querySelector("[email], .yW span[email], .yP span[email]");
    const subjectNode = row.querySelector(".bog, .bqe");
    const snippetNode = row.querySelector(".y2");
    const sender = senderNode?.getAttribute("email") || text(row.querySelector(".yW, .yP"));
    return {
      sender,
      subject: text(subjectNode),
      snippet: text(snippetNode)
    };
  }

  function allRuleMatches(data) {
    return settings.rules
      .filter(rule => rule.enabled !== false)
      .filter(rule => ehaliMatch(data, [rule], { enabled: false }).some(hit => hit.id === rule.id));
  }

  function clearRow(row) {
    row.querySelectorAll(".ehali-badge").forEach(n => n.remove());
    row.classList.remove("ehali-highlight", "ehali-filter-hidden");
    row.style.removeProperty("--ehali-color");
    delete row.dataset.ehaliSignature;
    delete row.dataset.ehaliMatchIds;
  }

  function anchorFor(row) {
    return row.querySelector(".y6") || row.querySelector("td.a4W") ||
      row.querySelector("td:nth-last-child(2)") || row.querySelector("td") || row;
  }

  function applyRow(row) {
    if (!settings.enabled) {
      if (row.dataset.ehaliSignature) clearRow(row);
      return;
    }

    const data = emailData(row);
    const sig = [settingsVersion, data.sender, data.subject, data.snippet].join("|");
    if (row.dataset.ehaliSignature !== sig) {
      row.querySelectorAll(".ehali-badge").forEach(n => n.remove());
      row.dataset.ehaliSignature = sig;

      const allMatches = allRuleMatches(data);
      const visibleMatches = allMatches.slice(0, 2);
      const shownMatches = visibleMatches.length
        ? visibleMatches
        : (settings.fallback.enabled ? [{ ...settings.fallback, id: "fallback" }] : []);

      row.dataset.ehaliMatchIds = JSON.stringify(allMatches.map(rule => rule.id));
      row.classList.toggle("ehali-highlight", shownMatches.length > 0);
      if (shownMatches.length) row.style.setProperty("--ehali-color", shownMatches[0].color || "#4F46E5");
      else row.style.removeProperty("--ehali-color");

      const anchor = anchorFor(row);
      const fragment = document.createDocumentFragment();
      shownMatches.forEach(rule => {
        const badge = document.createElement("span");
        badge.className = "ehali-badge";
        badge.textContent = rule.name;
        badge.style.setProperty("--ehali-badge-color", rule.color || "#4F46E5");
        badge.setAttribute("role", "button");
        badge.setAttribute("tabindex", "0");
        badge.setAttribute("aria-label", `Filter inbox by ${rule.name}`);
        badge.title = `Show emails labeled ${rule.name}`;
        const activate = event => {
          event.preventDefault();
          event.stopPropagation();
          setActiveFilter(rule.id);
        };
        badge.addEventListener("click", activate);
        badge.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") activate(event);
        });
        fragment.appendChild(badge);
      });
      anchor.insertBefore(fragment, anchor.firstChild);
    }
  }

  function getRows() {
    return [...document.querySelectorAll(ROW_SELECTOR)];
  }

  function labelsForFilter() {
    const labels = settings.rules.filter(rule => rule.enabled !== false);
    if (settings.fallback.enabled) labels.push({ ...settings.fallback, id: "fallback" });
    return labels;
  }

  function ensureFilterBar(rows) {
    const firstRow = rows[0];
    if (!firstRow) return null;
    const table = firstRow.closest("table");
    const parent = table?.parentElement || firstRow.parentElement;
    if (!parent) return null;

    if (!filterBar) {
      filterBar = document.createElement("section");
      filterBar.id = BAR_ID;
      filterBar.className = "ehali-filter-bar";
      filterBar.setAttribute("aria-label", "Filter Gmail messages by eHali label");
    }
    if (filterBar.parentElement !== parent) {
      if (table && table.parentElement === parent) parent.insertBefore(filterBar, table);
      else parent.insertBefore(filterBar, firstRow);
    }
    return filterBar;
  }

  function renderFilterBar(rows) {
    if (!settings.enabled) {
      if (filterBar) filterBar.hidden = true;
      activeFilter = null;
      rows.forEach(row => row.classList.remove("ehali-filter-hidden"));
      return;
    }
    const bar = ensureFilterBar(rows);
    if (!bar) return;
    bar.hidden = false;
    bar.replaceChildren();

    const activeLabel = labelsForFilter().find(rule => rule.id === activeFilter);
    if (activeFilter && !activeLabel) activeFilter = null;

    const heading = document.createElement("div");
    heading.className = "ehali-filter-heading";
    const title = document.createElement("strong");
    title.textContent = "eHali filters";
    const count = document.createElement("span");
    count.className = "ehali-filter-count";
    heading.append(title, count);

    const chips = document.createElement("div");
    chips.className = "ehali-filter-chips";
    const addChip = (id, label, color, isActive) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ehali-filter-chip" + (isActive ? " is-active" : "");
      button.textContent = label;
      button.style.setProperty("--ehali-badge-color", color || "#5145C8");
      button.setAttribute("aria-pressed", String(isActive));
      button.addEventListener("click", () => setActiveFilter(id));
      chips.appendChild(button);
    };
    addChip(null, "All", "#5145C8", activeFilter === null);
    labelsForFilter().forEach(rule => addChip(rule.id, rule.name, rule.color, activeFilter === rule.id));
    bar.append(heading, chips);

    let visible = 0;
    rows.forEach(row => {
      const ids = JSON.parse(row.dataset.ehaliMatchIds || "[]");
      const matches = activeFilter === null
        ? true
        : activeFilter === "fallback" ? ids.length === 0 && settings.fallback.enabled : ids.includes(activeFilter);
      row.classList.toggle("ehali-filter-hidden", !matches);
      if (matches) visible++;
    });
    count.textContent = activeFilter === null
      ? `${rows.length} shown`
      : `${visible} matching`;
  }

  function setActiveFilter(id) {
    activeFilter = id;
    scheduleScan();
  }

  function scan() {
    scanTimer = null;
    const rows = getRows();
    rows.forEach(applyRow);
    renderFilterBar(rows);
  }

  function scheduleScan() {
    if (scanTimer !== null) return;
    scanTimer = setTimeout(scan, 180);
  }

  function onlyOwnBadgeMutation(mutation) {
    if (mutation.target?.nodeType === Node.ELEMENT_NODE && mutation.target.closest?.("#" + BAR_ID)) return true;
    const changed = [...mutation.addedNodes, ...mutation.removedNodes];
    return changed.length > 0 && changed.every(node =>
      node.nodeType === Node.ELEMENT_NODE && node.matches?.(".ehali-badge, #" + BAR_ID)
    );
  }

  function loadSettings(callback) {
    chrome.storage.local.get({ enabled: true, rules: null, fallback: null }, stored => {
      if (chrome.runtime.lastError) return;
      settings.enabled = stored.enabled !== false;
      settings.rules = Array.isArray(stored.rules)
        ? stored.rules.map(ehaliNormalizeRule)
        : EHALI_DEFAULT_RULES.map(ehaliNormalizeRule);
      settings.fallback = stored.fallback && typeof stored.fallback === "object"
        ? {
            enabled: stored.fallback.enabled === true,
            name: String(stored.fallback.name || "Other"),
            color: stored.fallback.color || "#6B7280"
          }
        : { ...EHALI_DEFAULT_FALLBACK };
      settingsVersion++;
      callback?.();
    });
  }

  function start() {
    if (!document.body) { setTimeout(start, 50); return; }
    loadSettings(() => {
      observer = new MutationObserver(mutations => {
        if (mutations.every(onlyOwnBadgeMutation)) return;
        scheduleScan();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      scheduleScan();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !["enabled", "rules", "fallback"].some(key => key in changes)) return;
    loadSettings(scheduleScan);
  });

  start();
})();
