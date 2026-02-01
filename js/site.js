
(function(){
  const root = document.documentElement;
  const themeToggleBtn = document.getElementById('themeToggle');
  const soundToggleBtn = document.getElementById('soundToggle');
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggleBtn = document.querySelector('.sidebar__toggle');

  // Theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') root.classList.add('theme-dark');
  function setThemeIcon(){
    const dark = root.classList.contains('theme-dark');
    if (themeToggleBtn){
      themeToggleBtn.dataset.label = dark ? 'Light mode' : 'Dark mode';
      const iconEl = themeToggleBtn.querySelector('.icon');
      if (iconEl) iconEl.textContent = dark ? '☀️' : '🌙';
    }
  }
  setThemeIcon();
  themeToggleBtn && themeToggleBtn.addEventListener('click', () => {
    const dark = root.classList.toggle('theme-dark');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    setThemeIcon();
  });

  // Sidebar expand
  const savedSidebar = localStorage.getItem('sidebar');
  if (savedSidebar === 'expanded') sidebar && sidebar.classList.add('sidebar--expanded');
  sidebarToggleBtn && sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar--expanded');
    const expanded = sidebar.classList.contains('sidebar--expanded');
    localStorage.setItem('sidebar', expanded ? 'expanded' : 'collapsed');
  });

  // Sound toggle
  function setSoundIcon(){
    if (!soundToggleBtn || !window.AppUtil) return;
    const muted = window.AppUtil.SFX.isMuted();
    soundToggleBtn.dataset.label = muted ? 'Sound OFF' : 'Sound ON';
    const iconEl = soundToggleBtn.querySelector('.icon');
    if (iconEl) iconEl.textContent = muted ? '🔇' : '🔊';
  }
  soundToggleBtn && soundToggleBtn.addEventListener('click', () => {
    window.AppUtil && window.AppUtil.SFX.toggle();
    setSoundIcon();
  });
  setSoundIcon();
})();

window.disablePreviewButtons = function() {
    const ids = ["quizPreview", "memPreview", "clozePreview", "shootPreview"];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = true;
            btn.classList.add("disabled-preview");
        }
    });
};

window.enablePreviewButtons = function() {
    const ids = ["quizPreview", "memPreview", "clozePreview", "shootPreview"];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = false;
            btn.classList.remove("disabled-preview");
        }
    });
};
