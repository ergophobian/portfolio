// ========== XP RIGHT-CLICK CONTEXT MENUS ==========

(function () {
  let activeMenu = null;

  // Close menu on click outside or Escape
  document.addEventListener('click', () => closeContextMenu());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeContextMenu();
  });

  function closeContextMenu() {
    if (activeMenu) {
      activeMenu.classList.remove('active');
      setTimeout(() => {
        if (activeMenu && activeMenu.parentNode) {
          activeMenu.parentNode.removeChild(activeMenu);
        }
        activeMenu = null;
      }, 80);
    }
  }

  // Menu definitions
  const menus = {
    desktop: [
      {
        label: 'Arrange Icons By',
        submenu: [
          { label: 'Name', action: () => {} },
          { label: 'Size', action: () => {} },
          { label: 'Type', action: () => {} },
          { type: 'separator' },
          { label: 'Auto Arrange', action: () => {}, checked: true },
          { label: 'Align to Grid', action: () => {}, checked: true },
        ],
      },
      { type: 'separator' },
      { label: 'Refresh', action: () => toggleGamesDesktop() },
      { type: 'separator' },
      { label: 'Paste', action: () => {}, disabled: true },
      { label: 'Paste Shortcut', action: () => {}, disabled: true },
      { type: 'separator' },
      {
        label: 'New',
        submenu: [
          {
            label: 'Folder',
            action: () =>
              typeof showNotification === 'function' &&
              showNotification('New Folder', 'Created new folder on desktop'),
          },
          {
            label: 'Shortcut',
            action: () =>
              typeof showNotification === 'function' &&
              showNotification('Shortcut', 'Shortcut wizard not available'),
          },
          {
            label: 'Text Document',
            action: () => {
              if (typeof openWindow === 'function') openWindow('notepad');
            },
          },
          {
            label: 'Briefcase',
            action: () =>
              typeof showNotification === 'function' &&
              showNotification('Briefcase', 'Created new Briefcase'),
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Properties',
        action: () => {
          if (typeof openWindow === 'function') openWindow('about');
        },
      },
    ],

    icon: [
      {
        label: 'Open',
        bold: true,
        action: (target) => {
          if (typeof openWindow === 'function') openWindow(target);
        },
      },
      { type: 'separator' },
      {
        label: 'Explore',
        action: (target) => {
          if (typeof openWindow === 'function') openWindow(target);
        },
      },
      { type: 'separator' },
      { label: 'Cut', action: () => {}, disabled: true },
      { label: 'Copy', action: () => {}, disabled: true },
      { type: 'separator' },
      {
        label: 'Create Shortcut',
        action: () =>
          typeof showNotification === 'function' &&
          showNotification('Shortcut', 'Shortcut created on desktop'),
      },
      {
        label: 'Delete',
        action: (target) => {
          const icon = document.querySelector(`[data-window="${target}"]`);
          if (icon) {
            icon.style.transition = 'opacity 0.3s, transform 0.3s';
            icon.style.opacity = '0';
            icon.style.transform = 'scale(0.5)';
            setTimeout(() => {
              icon.style.display = 'none';
            }, 300);
            if (typeof showNotification === 'function')
              showNotification('Deleted', `${target} moved to Recycle Bin`);
          }
        },
      },
      {
        label: 'Rename',
        action: () =>
          typeof showNotification === 'function' &&
          showNotification('Rename', 'Rename is not available'),
      },
      { type: 'separator' },
      {
        label: 'Properties',
        action: (target) =>
          typeof showNotification === 'function' &&
          showNotification('Properties', `Properties for ${target}`),
      },
    ],

    taskbar: [
      { label: 'Toolbars', submenu: [
        { label: 'Quick Launch', action: () => {}, checked: true },
        { label: 'Desktop', action: () => {} },
        { label: 'Links', action: () => {} },
      ]},
      { type: 'separator' },
      { label: 'Cascade Windows', action: () => cascadeWindows() },
      { label: 'Tile Windows Horizontally', action: () => tileWindows('h') },
      { label: 'Tile Windows Vertically', action: () => tileWindows('v') },
      { label: 'Show the Desktop', action: () => minimizeAll() },
      { type: 'separator' },
      {
        label: 'Lock the Taskbar',
        action: () =>
          typeof showNotification === 'function' &&
          showNotification('Taskbar', 'Taskbar is locked'),
        checked: true,
      },
      {
        label: 'Properties',
        action: () =>
          typeof showNotification === 'function' &&
          showNotification('Taskbar Properties', 'Taskbar and Start Menu Properties'),
      },
      { type: 'separator' },
      {
        label: 'Task Manager',
        action: () =>
          typeof showNotification === 'function' &&
          showNotification('Task Manager', 'Windows Task Manager is not available'),
      },
    ],

    window: [
      {
        label: 'Restore',
        action: (target) => {
          const win = document.getElementById('window-' + target);
          if (win) {
            win.style.width = '600px';
            win.style.height = '450px';
            win.style.top = '80px';
            win.style.left = '100px';
          }
        },
      },
      { label: 'Move', action: () => {}, disabled: true },
      { label: 'Size', action: () => {}, disabled: true },
      {
        label: 'Minimize',
        action: (target) => {
          if (typeof minimizeWindow === 'function') minimizeWindow(target);
        },
      },
      {
        label: 'Maximize',
        action: (target) => {
          if (typeof maximizeWindow === 'function') maximizeWindow(target);
        },
      },
      { type: 'separator' },
      {
        label: 'Close',
        bold: true,
        action: (target) => {
          if (typeof closeWindow === 'function') closeWindow(target);
        },
      },
    ],
  };

  // ---- Window management helpers ----

  function cascadeWindows() {
    const offset = 30;
    const wins = document.querySelectorAll('.window.active');
    wins.forEach((win, i) => {
      win.style.top = 50 + i * offset + 'px';
      win.style.left = 50 + i * offset + 'px';
      win.style.width = '550px';
      win.style.height = '420px';
      win.classList.remove('maximized');
    });
  }

  function tileWindows(direction) {
    const activeWins = Array.from(document.querySelectorAll('.window.active'));
    const count = activeWins.length;
    if (count === 0) return;

    const taskbarH = 36;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - taskbarH;

    activeWins.forEach((win, i) => {
      win.classList.remove('maximized');
      if (direction === 'h') {
        win.style.left = '0';
        win.style.top = Math.floor(i * screenH / count) + 'px';
        win.style.width = screenW + 'px';
        win.style.height = Math.floor(screenH / count) + 'px';
      } else {
        win.style.top = '0';
        win.style.left = Math.floor(i * screenW / count) + 'px';
        win.style.width = Math.floor(screenW / count) + 'px';
        win.style.height = screenH + 'px';
      }
    });
  }

  function minimizeAll() {
    document.querySelectorAll('.window.active').forEach((win) => {
      const id = win.id.replace('window-', '');
      if (typeof minimizeWindow === 'function') minimizeWindow(id);
    });
  }

  // ---- Menu DOM creation ----

  function createMenu(items, targetId) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    items.forEach((item) => {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        menu.appendChild(sep);
        return;
      }

      const el = document.createElement('div');
      el.className = 'context-menu-item' + (item.disabled ? ' disabled' : '');

      // Check mark
      if (item.checked) {
        const check = document.createElement('span');
        check.className = 'context-menu-check';
        check.textContent = '\u2713';
        el.appendChild(check);
      }

      // Label
      const label = document.createElement('span');
      label.className = 'context-menu-label';
      label.textContent = item.label;
      if (item.bold) label.style.fontWeight = 'bold';
      el.appendChild(label);

      // Submenu arrow and content
      if (item.submenu) {
        const arrow = document.createElement('span');
        arrow.className = 'submenu-arrow';
        el.appendChild(arrow);

        const sub = document.createElement('div');
        sub.className = 'context-submenu';

        item.submenu.forEach((subItem) => {
          if (subItem.type === 'separator') {
            const ssep = document.createElement('div');
            ssep.className = 'context-menu-separator';
            sub.appendChild(ssep);
            return;
          }

          const subEl = document.createElement('div');
          subEl.className = 'context-menu-item';

          if (subItem.checked) {
            const subCheck = document.createElement('span');
            subCheck.className = 'context-menu-check';
            subCheck.textContent = '\u2713';
            subEl.appendChild(subCheck);
          }

          const subLabel = document.createElement('span');
          subLabel.className = 'context-menu-label';
          subLabel.textContent = subItem.label;
          subEl.appendChild(subLabel);

          subEl.addEventListener('click', (e) => {
            e.stopPropagation();
            subItem.action(targetId);
            closeContextMenu();
          });
          sub.appendChild(subEl);
        });

        el.appendChild(sub);
      } else if (!item.disabled) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          item.action(targetId);
          closeContextMenu();
        });
      }

      menu.appendChild(el);
    });

    return menu;
  }

  // ---- Public API ----

  window.showContextMenu = function (event, menuType, targetId) {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenu();

    const menuDef = menus[menuType];
    if (!menuDef) return;

    const menu = createMenu(menuDef, targetId);
    document.body.appendChild(menu);

    // Position off-screen first, then measure and reposition
    menu.style.left = '-9999px';
    menu.style.top = '-9999px';
    menu.classList.add('active');

    requestAnimationFrame(() => {
      let x = event.clientX;
      let y = event.clientY;
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;

      // Flip if near edge
      if (x + mw > window.innerWidth) x = window.innerWidth - mw - 4;
      if (y + mh > window.innerHeight) y = window.innerHeight - mh - 4;
      if (x < 0) x = 4;
      if (y < 0) y = 4;

      menu.style.left = x + 'px';
      menu.style.top = y + 'px';

      activeMenu = menu;
    });
  };

  // Prevent default right-click on desktop area only
  // (Agent 3 handles the contextmenu event dispatching; this is a fallback)
  document.addEventListener('contextmenu', (e) => {
    // Only prevent if not on form inputs
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });
})();
