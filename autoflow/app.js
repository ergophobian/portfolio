/* ============================================
   Auto Flow — Website Scripts
   ============================================ */

(function () {
  'use strict';

  var CURRENT_VERSION = '10.8.13';
  var LS_KEY = 'af_changelog_seen';

  // --- Changelog Modal ---
  var modal = document.getElementById('changelogModal');
  var dismissBtn = document.getElementById('dismissChangelog');

  function showModal() {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function hideModal() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
    try {
      localStorage.setItem(LS_KEY, CURRENT_VERSION);
    } catch (e) { /* storage unavailable */ }
  }

  // Show modal if user hasn't seen this version
  // Extension can trigger with ?changelog or ?v=10.8.13
  var params = new URLSearchParams(window.location.search);
  var forceShow = params.has('changelog') || params.has('v');
  var seenVersion = null;
  try { seenVersion = localStorage.getItem(LS_KEY); } catch (e) {}

  if (forceShow || seenVersion !== CURRENT_VERSION) {
    setTimeout(showModal, 400);
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', hideModal);
  }
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) hideModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      hideModal();
    }
  });

  // --- Scroll Reveal ---
  var revealEls = document.querySelectorAll('.feature-row, .explainer-group, .accordion, .agent-band, .teaser-card, .cl-entry, .cta-banner');
  revealEls.forEach(function (el) { el.classList.add('reveal'); });

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(function (el) { revealObserver.observe(el); });

  // --- Mobile Nav Toggle ---
  var hamburger = document.getElementById('hamburger');
  var headerNav = document.getElementById('headerNav');

  if (hamburger && headerNav) {
    hamburger.addEventListener('click', function () {
      headerNav.classList.toggle('open');
    });
    headerNav.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        headerNav.classList.remove('open');
      });
    });
  }

  // --- Active Nav (by current page, no scroll listener) ---
  // Derive the active link from the URL filename instead of reading layout on
  // every scroll frame. Cheap, and correct for a multi-page site.
  var navLinks = document.querySelectorAll('.header-nav .nav-link');
  var currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (currentPage === '') currentPage = 'index.html';
  navLinks.forEach(function (link) {
    var target = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
    if (target === currentPage) {
      link.classList.add('nav-link--active');
    }
  });

  // --- Smooth Scroll ---
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // --- Hash on Load ---
  if (window.location.hash) {
    var hashTarget = document.querySelector(window.location.hash);
    if (hashTarget) {
      setTimeout(function () {
        hashTarget.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

})();
