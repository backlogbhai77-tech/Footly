var firebaseConfig = {
  apiKey: "AIzaSyCsyMAdibDZ2EUgSH2cFgqdqC9bhY-Aygc",
  authDomain: "footly-21dd2.firebaseapp.com",
  projectId: "footly-21dd2",
  storageBucket: "footly-21dd2.firebasestorage.app",
  messagingSenderId: "616919026401",
  appId: "1:616919026401:web:9c401e1378b0d2e2cf05a0"
};

var firestoreDb = null;
try {
  firebase.initializeApp(firebaseConfig);
  firestoreDb = firebase.firestore();
} catch (e) {
  console.warn("Firebase Init Error:", e);
}

var cachedData = localStorage.getItem('footly_offline_db');
var db = cachedData ? JSON.parse(cachedData) : {};
var allShortKeys = [];
var currentFilterCat = 'All';
var activeDrillKey = null;
var activeDrillType = 'masterclass';
var lastFocusedElement = null;
var loaderTimeoutTimer = null;

var fallbackSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22320%22%20height%3D%22180%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23047857%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%23ffffff%22%20font-size%3D%2214%22%20font-weight%3D%22bold%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EFOOTLY%3C%2Ftext%3E%3C%2Fsvg%3E";

function initTheme() {
  var isDark = localStorage.getItem('footly_dark_mode') === 'true';
  if (isDark) document.body.classList.add('dark-mode');
  var btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerText = isDark ? '☀️' : '🌙';
}

var themeBtn = document.getElementById('themeToggleBtn');
if (themeBtn) {
  themeBtn.addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    var isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('footly_dark_mode', isDark);
    themeBtn.innerText = isDark ? '☀️' : '🌙';
    if (navigator.vibrate) navigator.vibrate(20);
  });
}

function getSavedDrills() {
  try {
    var stored = localStorage.getItem('footly_saved_drills');
    return stored ? JSON.parse(stored) : [];
  } catch (err) { return []; }
}

function getRoutineDrills() {
  try {
    var stored = localStorage.getItem('footly_routine_drills');
    return stored ? JSON.parse(stored) : [];
  } catch (err) { return []; }
}

function toggleRoutineDrill(drillKey, ev) {
  if (ev) ev.stopPropagation();
  var routine = getRoutineDrills();
  if (routine.indexOf(drillKey) !== -1) {
    routine = routine.filter(function(k) { return k !== drillKey; });
  } else {
    routine.push(drillKey);
  }
  localStorage.setItem('footly_routine_drills', JSON.stringify(routine));
  renderRoutineView();
  initFeeds();
  if (navigator.vibrate) navigator.vibrate(25);
}

function toggleSaveDrill(drillKey, ev) {
  if (ev) ev.stopPropagation();
  var saved = getSavedDrills();
  if (saved.indexOf(drillKey) !== -1) {
    saved = saved.filter(function(k) { return k !== drillKey; });
  } else {
    saved.push(drillKey);
  }
  localStorage.setItem('footly_saved_drills', JSON.stringify(saved));
  updateBookmarkIcons();
  if (navigator.vibrate) navigator.vibrate(25);
}

function updateBookmarkIcons() {
  var saved = getSavedDrills();
  document.querySelectorAll('.bookmark-btn').forEach(function(btn) {
    var key = btn.dataset.drillKey || '';
    if (saved.indexOf(key) !== -1) {
      btn.classList.add('saved');
      btn.innerText = '❤️';
    } else {
      btn.classList.remove('saved');
      btn.innerText = '🤍';
    }
  });
}

function createCard(key, item, isShort, isFullWidth) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = isShort ? 'reel-card-sm' : 'reel-card-lg';
  if (isFullWidth) btn.style.flex = 'auto';
  btn.setAttribute('data-cat', item.cat);
  btn.setAttribute('data-key', key);
  btn.addEventListener('click', function() { openDrillModal(key); });

  var thumbUrl = 'https://i.ytimg.com/vi/' + item.videoId + '/hqdefault.jpg';
  var pillText = item.tagPill || (isShort ? 'Short' : 'Class');
  var routineList = getRoutineDrills();
  var isInRoutine = routineList.indexOf(key) !== -1;

  var html = '<div class="reel-thumb">' +
    '<img src="' + thumbUrl + '" alt="' + item.title + '" loading="lazy">' +
    '<span class="category-pill">' + item.cat + '</span>' +
    '<span class="length-pill">' + pillText + '</span>' +
    '<button type="button" class="bookmark-btn" data-drill-key="' + key + '" aria-label="Bookmark">🤍</button>' +
    '<div class="play-btn-glass">▶</div>' +
    '</div>' +
    '<div class="reel-body">' +
    '<h4>' + item.title + '</h4>' +
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">' +
    '<p>' + (isShort ? 'Watch Drill →' : 'Watch Class →') + '</p>' +
    '<button type="button" onclick="toggleRoutineDrill(\'' + key + '\', event)" style="background:' + (isInRoutine ? '#047857' : 'var(--card)') + '; color:' + (isInRoutine ? '#fff' : 'var(--text)') + '; border:1px solid var(--border); font-size:9px; font-weight:800; padding:3px 8px; border-radius:6px; cursor:pointer;">' + (isInRoutine ? '✓ In Routine' : '+ Add Routine') + '</button>' +
    '</div>' +
    '</div>';

  btn.innerHTML = html;

  var img = btn.querySelector('img');
  if (img) img.addEventListener('error', function() { img.src = fallbackSvg; });

  var bkmk = btn.querySelector('.bookmark-btn');
  if (bkmk) bkmk.addEventListener('click', function(e) { toggleSaveDrill(key, e); });

  return btn;
}

function updateDynamicFilterChips() {
  var chipBox = document.getElementById('dynamicFilterChips');
  if (!chipBox) return;

  var counts = { All: Object.keys(db).length, Saved: getSavedDrills().length };
  Object.keys(db).forEach(function(k) {
    var c = db[k].cat;
    if (c) counts[c] = (counts[c] || 0) + 1;
  });

  var categories = ['All', 'Saved'];
  Object.keys(db).forEach(function(k) {
    var c = db[k].cat;
    if (c && categories.indexOf(c) === -1) categories.push(c);
  });

  chipBox.innerHTML = '';
  categories.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.category = cat;
    btn.setAttribute('aria-pressed', currentFilterCat === cat ? 'true' : 'false');
    var label = cat === 'Saved' ? '❤️ Saved' : (cat === 'All' ? 'All Topics' : cat);
    btn.innerText = label + ' (' + (counts[cat] || 0) + ')';
    btn.addEventListener('click', function() { applyHomeFilter(cat); });
    chipBox.appendChild(btn);
  });
}

function renderDynamicHomeSections() {
  var container = document.getElementById('homeDynamicSections');
  var skeleton = document.getElementById('skeletonLoaderSection');
  if (!container) return;
  if (skeleton) skeleton.style.display = 'none';

  container.innerHTML = '';

  var shorts = [];
  var classesByCat = {};

  Object.keys(db).forEach(function(k) {
    var item = db[k];
    var isShort = (item.type || '').toLowerCase().indexOf('short') !== -1;
    if (isShort) {
      shorts.push({ key: k, item: item });
    } else {
      var cat = item.cat || 'Masterclasses';
      if (!classesByCat[cat]) classesByCat[cat] = [];
      classesByCat[cat].push({ key: k, item: item });
    }
  });

  if (shorts.length > 0) {
    var sGroup = document.createElement('div');
    sGroup.className = 'home-section-group';
    sGroup.innerHTML = '<div class="section-head"><h3>Trending Quick Shorts</h3><span>Fast Practice ➔</span></div><div class="horizontal-reel" id="home-shorts-reel"></div>';
    var reel = sGroup.querySelector('#home-shorts-reel');
    shorts.forEach(function(s) { reel.appendChild(createCard(s.key, s.item, true)); });
    container.appendChild(sGroup);
  }

  Object.keys(classesByCat).forEach(function(catName) {
    var cGroup = document.createElement('div');
    cGroup.className = 'home-section-group';
    cGroup.innerHTML = '<div class="section-head"><h3>' + catName + '</h3><span>Swipe ➔</span></div><div class="horizontal-reel"></div>';
    var reel = cGroup.querySelector('.horizontal-reel');
    classesByCat[catName].forEach(function(c) { reel.appendChild(createCard(c.key, c.item, false)); });
    container.appendChild(cGroup);
  });
}

function renderRoutineView() {
  var routineList = document.getElementById('routineDrillsList');
  if (!routineList) return;
  routineList.innerHTML = '';

  var routineKeys = getRoutineDrills();
  if (routineKeys.length === 0) {
    routineList.innerHTML = '<p style="font-size: 13px; color: var(--muted); padding: 10px 0;">No drills in your routine yet. Click "+ Add Routine" on any drill to build your session!</p>';
    return;
  }

  routineKeys.forEach(function(key) {
    var item = db[key];
    if (!item) return;
    var row = document.createElement('div');
    row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:10px 14px; border-radius:12px; border:1px solid var(--border); margin-bottom:8px;";
    row.innerHTML = '<div><h4 style="font-size:13px; font-weight:800; color:var(--text);">' + item.title + '</h4><p style="font-size:11px; color:var(--accent); font-weight:700;">' + item.cat + '</p></div>' +
      '<button type="button" onclick="toggleRoutineDrill(\'' + key + '\')" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 10px; border-radius:8px; font-weight:900; font-size:11px; cursor:pointer;">Remove</button>';
    routineList.appendChild(row);
  });
}

function initFeeds() {
  var classesFeed = document.getElementById('classes-feed');
  var shortsFeed = document.getElementById('shorts-feed');
  var shootFeed = document.getElementById('shoot-feed');

  if (classesFeed) classesFeed.innerHTML = '';
  if (shortsFeed) shortsFeed.innerHTML = '';
  if (shootFeed) shootFeed.innerHTML = '';

  renderDynamicHomeSections();
  renderRoutineView();

  Object.keys(db).forEach(function(k) {
    var item = db[k];
    var isShort = (item.type || '').toLowerCase().indexOf('short') !== -1;
    var lowerCat = (item.cat || '').toLowerCase();

    if (!isShort) {
      if (classesFeed) classesFeed.appendChild(createCard(k, item, false, true));
      if (shootFeed && lowerCat.indexOf('shoot') !== -1) shootFeed.appendChild(createCard(k, item, false, true));
    } else {
      if (shortsFeed) shortsFeed.appendChild(createCard(k, item, true));
    }
  });

  allShortKeys = Object.keys(db).filter(function(k) { return (db[k].type || '').toLowerCase().indexOf('short') !== -1; });
  updateDynamicFilterChips();
  updateBookmarkIcons();
}

function setupRealtimeFirestore() {
  if (!firestoreDb) {
    if (Object.keys(db).length > 0) initFeeds();
    return;
  }
  firestoreDb.collection('drills').onSnapshot(function(snap) {
    var cloudDb = {};
    snap.forEach(function(doc) {
      var data = doc.data();
      var rawType = (data.type || '').toLowerCase().trim();
      var cleanType = rawType.indexOf('short') !== -1 ? 'short' : 'masterclass';

      cloudDb[doc.id] = {
        title: data.title || "Untitled Drill",
        videoId: data.videoId || "6mFfS1PE3Vo",
        cat: data.cat || "Skills",
        type: cleanType,
        tagPill: data.tagPill || (cleanType === 'short' ? 'SHORT' : 'PRO'),
        tags: data.tags || [(data.cat || 'skills').toLowerCase(), cleanType],
        steps: data.steps || ["Focus on precision & ball control.", "Practice multiple repetitions."]
      };
    });

    db = cloudDb;
    localStorage.setItem('footly_offline_db', JSON.stringify(db));
    initFeeds();

    var keys = Object.keys(db);
    if (keys.length > 0) {
      var latestMasterclass = keys.find(function(k) { return db[k].type === 'masterclass'; }) || keys[0];
      updateHeroDisplay(latestMasterclass);
    }
  }, function(err) {
    console.warn("Firestore sync error:", err);
    if (Object.keys(db).length > 0) initFeeds();
  });
}

function updateHeroDisplay(drillKey) {
  var drill = db[drillKey];
  if (!drill) return;
  var container = document.getElementById('dynamicHeroContainer');
  var cardBtn = document.getElementById('heroCardBtn');
  var img = document.getElementById('heroPosterImg');
  var tag = document.getElementById('heroCategoryTag');
  var title = document.getElementById('heroMainTitle');

  if (container) container.setAttribute('data-cat', drill.cat);
  if (cardBtn) cardBtn.onclick = function() { openDrillModal(drillKey); };
  if (img) img.src = 'https://i.ytimg.com/vi/' + drill.videoId + '/hqdefault.jpg';
  if (tag) tag.innerText = '⚡ RECOMMENDED ' + (drill.cat || '').toUpperCase();
  if (title) title.innerText = drill.title;
}

var lockCount = 0;
var savedScrollY = 0;
function pushScrollLock() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY || window.pageYOffset;
    document.body.style.top = '-' + savedScrollY + 'px';
    document.body.classList.add('lock-scroll');
  }
  lockCount++;
}
function popScrollLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.classList.remove('lock-scroll');
    document.body.style.top = '';
    window.scrollTo(0, savedScrollY);
  }
}

(function initSplashSequence() {
  var splash = document.getElementById('splash-layer');
  var ballStage = document.getElementById('ballStage');
  var brandReveal = document.getElementById('brandReveal');
  var impactFlash = document.getElementById('impactFlash');

  pushScrollLock();
  function onBallEnd(e) {
    if (e.target !== ballStage) return;
    if (splash) splash.classList.add('impact-shake');
    if (impactFlash) impactFlash.classList.add('fire');
    if (navigator.vibrate) navigator.vibrate(30);

    if (ballStage) {
      ballStage.classList.add('split');
      ballStage.removeEventListener('animationend', onBallEnd);
    }
    if (brandReveal) brandReveal.classList.add('popped');
    setTimeout(finishSplash, 400);
  }
  function finishSplash() {
    if (splash) splash.classList.add('zoom-transition');
    setTimeout(function() {
      if (splash) splash.remove();
      popScrollLock();
    }, 350);
  }
  if (ballStage) ballStage.addEventListener('animationend', onBallEnd);
  setTimeout(finishSplash, 2600);
})();

var currentActiveTab = 'home';
function navigateTab(tabName) {
  switchMainTabDirect(tabName);
  history.replaceState({ tab: tabName }, '', '#' + tabName);
}

function switchMainTabDirect(tabName) {
  currentActiveTab = tabName;
  clearGlobalSearch();

  document.querySelectorAll('.app-view').forEach(function(v) { v.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(b) { b.removeAttribute('aria-current'); });

  var targetView = document.getElementById('view-' + tabName);
  if (targetView) targetView.classList.add('active');
  var navBtn = document.getElementById('nav-' + tabName);
  if (navBtn) navBtn.setAttribute('aria-current', 'page');
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', function(e) {
  var modal = document.getElementById('video-modal');
  if (modal && modal.classList.contains('active')) {
    closeModalInternal();
  } else if (e.state && e.state.tab) {
    switchMainTabDirect(e.state.tab);
  }
});

function applyHomeFilter(category) {
  currentFilterCat = category;
  document.querySelectorAll('#dynamicFilterChips .chip').forEach(function(el) {
    el.setAttribute('aria-pressed', el.dataset.category === category ? 'true' : 'false');
  });

  var cards = document.querySelectorAll('#homeDynamicSections .reel-card-lg, #homeDynamicSections .reel-card-sm, #dynamicHeroContainer');
  var saved = getSavedDrills();

  cards.forEach(function(card) {
    var cat = card.getAttribute('data-cat');
    var key = card.getAttribute('data-key') || '';
    if (category === 'All') {
      card.classList.remove('is-hidden');
    } else if (category === 'Saved') {
      if (saved.indexOf(key) !== -1) card.classList.remove('is-hidden');
      else card.classList.add('is-hidden');
    } else {
      if (cat === category) card.classList.remove('is-hidden');
      else card.classList.add('is-hidden');
    }
  });
}

function handleGlobalSearch(query) {
  var q = query.trim().toLowerCase();
  var clearBtn = document.getElementById('searchClearBtn');
  var searchView = document.getElementById('view-search');
  var shortsSec = document.getElementById('search-shorts-section');
  var classesSec = document.getElementById('search-classes-section');
  var shortsRes = document.getElementById('search-shorts-results');
  var classesRes = document.getElementById('search-classes-results');
  var noRes = document.getElementById('search-no-results');

  if (!q) {
    if (clearBtn) clearBtn.style.display = 'none';
    document.querySelectorAll('.app-view').forEach(function(v) { v.classList.remove('active'); });
    var activeV = document.getElementById('view-' + currentActiveTab);
    if (activeV) activeV.classList.add('active');
    return;
  }

  if (clearBtn) clearBtn.style.display = 'block';
  document.querySelectorAll('.app-view').forEach(function(v) { v.classList.remove('active'); });
  if (searchView) searchView.classList.add('active');

  if (shortsRes) shortsRes.innerHTML = '';
  if (classesRes) classesRes.innerHTML = '';

  var matchingShortsCount = 0;
  var matchingClassesCount = 0;

  Object.keys(db).forEach(function(key) {
    var item = db[key];
    var matchTitle = item.title.toLowerCase().indexOf(q) !== -1;
    var matchTags = (item.tags || []).some(function(t) { return t.indexOf(q) !== -1; });
    var isShort = (item.type || '').toLowerCase().indexOf('short') !== -1;

    if (matchTitle || matchTags) {
      if (isShort) {
        matchingShortsCount++;
        if (shortsRes) shortsRes.appendChild(createCard(key, item, true));
      } else {
        matchingClassesCount++;
        if (classesRes) classesRes.appendChild(createCard(key, item, false, true));
      }
    }
  });

  if (shortsSec) shortsSec.style.display = matchingShortsCount > 0 ? 'block' : 'none';
  if (classesSec) classesSec.style.display = matchingClassesCount > 0 ? 'block' : 'none';
  if (noRes) noRes.style.display = (matchingShortsCount === 0 && matchingClassesCount === 0) ? 'block' : 'none';
}

function clearGlobalSearch() {
  var input = document.getElementById('globalSearchInput');
  if (input) { input.value = ''; handleGlobalSearch(''); }
}

function showSwipeToast() {
  var toast = document.getElementById('swipeToast');
  if (!toast) return;
  toast.style.display = 'none';
  void toast.offsetWidth;
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 1800);
}

// RESTORED TURF LOADER & SMOOTH VIDEO PLAYER
function openDrillModal(drillKey, isNavigating) {
  if (isNavigating === undefined) isNavigating = false;
  var data = db[drillKey];
  if (!data) return;

  activeDrillKey = drillKey;
  var rawType = (data.type || '').toLowerCase();
  var isShort = rawType.indexOf('short') !== -1;
  activeDrillType = isShort ? 'short' : 'masterclass';

  lastFocusedElement = document.activeElement;
  var titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.innerText = data.title;
  updateBookmarkIcons();

  if (loaderTimeoutTimer) clearTimeout(loaderTimeoutTimer);

  var videoBox = document.getElementById('video-box');
  if (videoBox) {
    var embedUrl = "https://www.youtube.com/embed/" + data.videoId + "?autoplay=1&playsinline=1&rel=0&modestbranding=1" + (isShort ? ("&loop=1&playlist=" + data.videoId) : "");

    var loaderHtml = '<div class="video-loader" id="video-loader">' +
      '<div class="turf-juggling-arena">' +
      '<div class="turf-pro-ball">' +
      '<svg viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#cbd5e1" stroke-width="2.5"/>' +
      '<polygon points="50,32 64,42 59,58 41,58 36,42" fill="#0f172a"/>' +
      '<polygon points="50,4 34,14 36,32 50,22 64,32 66,14" fill="#047857"/>' +
      '<polygon points="8,38 20,48 16,66 2,66 0,48" fill="#0f172a"/>' +
      '<polygon points="92,38 100,48 98,66 84,66 80,48" fill="#0f172a"/>' +
      '<polygon points="34,86 50,96 66,86 59,68 41,68" fill="#047857"/>' +
      '</svg>' +
      '</div>' +
      '<div class="turf-ground-shadow"></div>' +
      '</div>' +
      '<div class="athletic-loader-title">TRAINING IN PROGRESS<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></div>' +
      '</div>' +
      '<iframe id="active-yt-iframe" src="' + embedUrl + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';

    videoBox.innerHTML = loaderHtml;

    var iframe = videoBox.querySelector('#active-yt-iframe');
    function hideLoaderSmoothly() {
      if (iframe) iframe.classList.add('loaded');
      var loader = document.getElementById('video-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(function() { loader.style.display = 'none'; }, 200);
      }
    }

    if (iframe) {
      iframe.addEventListener('load', function() { setTimeout(hideLoaderSmoothly, 250); });
    }
    loaderTimeoutTimer = setTimeout(hideLoaderSmoothly, 800);
  }

  var list = document.getElementById('modal-steps');
  if (list) {
    list.innerHTML = '';
    (data.steps || ["Focus on precision & ball control.", "Practice multiple repetitions."]).forEach(function(s) {
      var li = document.createElement('li');
      li.innerText = s;
      list.appendChild(li);
    });
  }

  var modal = document.getElementById('video-modal');
  var floatingNav = document.getElementById('shortsFloatingNav');
  var fsBtn = document.getElementById('modal-fs-btn');

  if (modal) {
    modal.classList.remove('is-short-mode', 'is-masterclass-fullscreen');
    if (isShort) {
      modal.classList.add('is-short-mode');
      if (floatingNav) floatingNav.classList.add('visible');
      if (fsBtn) fsBtn.style.display = 'none';
      showSwipeToast();
    } else {
      if (floatingNav) floatingNav.classList.remove('visible');
      if (fsBtn) fsBtn.style.display = 'flex';
    }
    modal.classList.add('active');
  }

  pushScrollLock();
  document.addEventListener('keydown', onModalKeydown);

  if (!isNavigating) {
    history.pushState({ modalOpen: true }, '', '#drill-' + drillKey);
  } else {
    history.replaceState({ modalOpen: true }, '', '#drill-' + drillKey);
  }
}

function navigateNextShort() {
  if (activeDrillType !== 'short' || !activeDrillKey || allShortKeys.length === 0) return;
  var currentIndex = allShortKeys.indexOf(activeDrillKey);
  var nextIndex = (currentIndex + 1) % allShortKeys.length;
  openDrillModal(allShortKeys[nextIndex], true);
}

function navigatePrevShort() {
  if (activeDrillType !== 'short' || !activeDrillKey || allShortKeys.length === 0) return;
  var currentIndex = allShortKeys.indexOf(activeDrillKey);
  var prevIndex = (currentIndex - 1 + allShortKeys.length) % allShortKeys.length;
  openDrillModal(allShortKeys[prevIndex], true);
}

var touchStartX = 0;
var touchStartY = 0;
var modalSheet = document.getElementById('modalSheetEl');
if (modalSheet) {
  modalSheet.addEventListener('click', function(e) { e.stopPropagation(); });
  modalSheet.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  modalSheet.addEventListener('touchend', function(e) {
    if (activeDrillType !== 'short') return;
    var diffX = e.changedTouches[0].clientX - touchStartX;
    var diffY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) navigateNextShort();
      else navigatePrevShort();
    } else if (Math.abs(diffY) > 40) {
      if (diffY < 0) navigateNextShort();
      else navigatePrevShort();
    }
  }, { passive: true });
}

function toggleMasterclassFullscreen() {
  if (activeDrillType === 'short') return;
  var modal = document.getElementById('video-modal');
  if (modal) modal.classList.toggle('is-masterclass-fullscreen');
}

function onModalKeydown(e) {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigateNextShort();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigatePrevShort();
}

function closeModal() {
  if (history.state && history.state.modalOpen) {
    history.back();
  } else {
    closeModalInternal();
  }
}

function closeModalInternal() {
  if (loaderTimeoutTimer) clearTimeout(loaderTimeoutTimer);
  var modal = document.getElementById('video-modal');
  var floatingNav = document.getElementById('shortsFloatingNav');
  if (floatingNav) floatingNav.classList.remove('visible');
  if (modal) modal.classList.remove('is-short-mode', 'is-masterclass-fullscreen', 'active');
  
  var box = document.getElementById('video-box');
  if (box) box.innerHTML = '';
  
  document.removeEventListener('keydown', onModalKeydown);
  popScrollLock();
  if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
}

// Nav Listeners
document.getElementById('nav-home').addEventListener('click', function() { navigateTab('home'); });
document.getElementById('nav-classes').addEventListener('click', function() { navigateTab('classes'); });
navShorts = document.getElementById('nav-shorts');
if (navShorts) navShorts.addEventListener('click', function() { navigateTab('shorts'); });
document.getElementById('nav-shooting').addEventListener('click', function() { navigateTab('shooting'); });
document.getElementById('nav-routine').addEventListener('click', function() { navigateTab('routine'); });

document.getElementById('modal-save-btn').addEventListener('click', function() { toggleSaveCurrentDrill(); });
document.getElementById('modal-fs-btn').addEventListener('click', toggleMasterclassFullscreen);
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('fullscreen-exit-btn').addEventListener('click', closeModal);

document.getElementById('shorts-prev-btn').addEventListener('click', navigatePrevShort);
document.getElementById('shorts-next-btn').addEventListener('click', navigateNextShort);
document.getElementById('shorts-save-btn').addEventListener('click', function() { toggleSaveCurrentDrill(); });

document.getElementById('globalSearchInput').addEventListener('input', function(e) { handleGlobalSearch(e.target.value); });
document.getElementById('searchClearBtn').addEventListener('click', clearGlobalSearch);

initTheme();
switchMainTabDirect('home');
setupRealtimeFirestore();
