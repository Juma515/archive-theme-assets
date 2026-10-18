/* Archive — BASE デザインテーマの JS。jQuery に依存しない。
   やること: ドロワー / お知らせ帯 / ヒーロー自動送り / スクロール表示 / 追加読み込み（ブラウザバックの復元つき）
   / カテゴリ画像タイル / ブログ RSS / 実寸表 / 写真のサムネイル帯 / 最近チェックした商品 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  root.classList.add('js');
  if (doc.body.classList.contains('is-index') && !location.search.match(/[?&]q=/) && !location.pathname.match(/\/categories\//)) {
    doc.body.classList.add('is-top');
  }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* BASE の基本設定の背景色（{BackgroundTag} が body に出す）をヘッダー・ドロワーにも使う */
  try { var bg = getComputedStyle(doc.body).backgroundColor; if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') root.style.setProperty('--c-bg', bg); } catch (e) {}
  try {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(doc.body).color);
    if (m) {
      var light = (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) > 160;
      root.style.setProperty('--c-on-text', light ? '#111111' : '#ffffff');
      // 背景が画像のときは下地の色が分からないので、ヘッダーやメニューの地は文字色と反対の色にする
      if (!root.style.getPropertyValue('--c-bg')) root.style.setProperty('--c-bg', light ? '#111111' : '#ffffff');
    }
  } catch (e) {}

  /* ---------- ドロワー ---------- */
  var drawer = doc.getElementById('drawer'), menuBtn = doc.querySelector('.hd__menuBtn');
  function setDrawer(open) {
    if (!drawer) return;
    drawer.hidden = !open;
    doc.body.classList.toggle('is-drawerOpen', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setDrawer(true); });
  if (drawer) {
    drawer.addEventListener('click', function (e) { if (e.target === drawer || e.target.closest('.drawer__close')) setDrawer(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });
  }
  /* カテゴリのアコーディオン（ヘッダー・ドロワー共通） */
  doc.querySelectorAll('.nav__catBtn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var li = btn.closest('.nav__cat'), open = !li.classList.contains('is-open');
      li.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });


  /* ---------- ヒーロー: scroll-snap の自動送り（指でも送れる） ---------- */
  var track = doc.querySelector('.hero__track'), dots = doc.querySelectorAll('.hero__dots span');
  if (track && track.children.length > 1) {
    var cur = 0, count = track.children.length, timer;
    function paint() { dots.forEach(function (d, j) { d.classList.toggle('is-on', j === cur); }); }
    function go(k) { cur = (k + count) % count; track.scrollTo({ left: track.clientWidth * cur, behavior: reduce ? 'auto' : 'smooth' }); paint(); }
    function arm() { clearInterval(timer); if (doc.querySelector('.hero--auto') && !reduce) timer = setInterval(function () { go(cur + 1); }, 5000); }
    track.addEventListener('scroll', function () {
      var k = Math.round(track.scrollLeft / track.clientWidth);
      if (k !== cur) { cur = k; paint(); arm(); }
    }, { passive: true });
    arm();
  }

  /* ---------- スクロールで現れる ---------- */
  function watchReveal(scope) {
    var els = (scope || doc).querySelectorAll('.rv:not(.is-in)');
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }
  watchReveal();

  /* ---------- 追加読み込み（{LoadItemsPageURL} + ページ番号 + {LoadItemsPageURLParams}） ----------
     ブラウザバックで戻ったときに、読み込んだページ数と位置を復元する（審査チェックリストの項目） */
  var list = doc.getElementById('itemList'), moreBtn = doc.getElementById('loadMore'), loading = doc.getElementById('loading');
  if (list && moreBtn) {
    var max = parseInt(list.dataset.max, 10) || 1, next = parseInt(list.dataset.next, 10) || 2, busy = false;
    var key = 'archive.loadmore:' + location.pathname + location.search;
    function updateBtn() { moreBtn.hidden = !(next <= max); }
    function load(cb) {
      if (busy || next > max) return;
      busy = true; loading.hidden = false; moreBtn.disabled = true;
      fetch(list.dataset.url + next + list.dataset.params, { credentials: 'same-origin' })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var tmp = doc.createElement('ul'); tmp.innerHTML = html;
          while (tmp.firstChild) list.appendChild(tmp.firstChild);
          next += 1; updateBtn(); watchReveal(list);
          try { sessionStorage.setItem(key, JSON.stringify({ next: next, y: window.scrollY })); } catch (e) {}
          if (cb) cb();
        })
        .catch(function () { moreBtn.hidden = false; })
        .then(function () { busy = false; loading.hidden = true; moreBtn.disabled = false; });
    }
    moreBtn.addEventListener('click', function () { load(); });
    updateBtn();
    /* 復元: 前回読み込んだページまで取り直してから、スクロール位置を戻す */
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) {}
    if (saved && saved.next > next) {
      var target = saved.next;
      (function step() { if (next < target && next <= max) load(step); else window.scrollTo(0, saved.y || 0); })();
    }
    window.addEventListener('pagehide', function () {
      try { if (next > (parseInt(list.dataset.next, 10) || 2)) sessionStorage.setItem(key, JSON.stringify({ next: next, y: window.scrollY })); } catch (e) {}
    });
  }

  /* ---------- カテゴリ画像タイル: デザインオプションの「カテゴリ ID + 画像」と、カテゴリ App の一覧を URL で突き合わせる ---------- */
  var cats = doc.getElementById('cats'), catSrc = doc.getElementById('catSource'), catSec = doc.getElementById('catSection');
  if (cats && catSrc && catSec) {
    var items = Array.prototype.map.call(catSrc.children, function (li) { return { url: li.dataset.url, name: li.textContent.trim() }; });
    var html = '';
    for (var c = 1; c <= 6; c++) {
      var id = (cats.dataset['id' + c] || '').trim(), img = cats.dataset['img' + c] || '';
      if (!id || !img) continue;
      var hit = items.filter(function (it) { return it.url && it.url.replace(/\/$/, '').split('/').pop() === id; })[0];
      if (!hit) continue;
      html += '<a class="cat rv" href="' + hit.url + '"><div class="cat__img"><img src="' + img + '" alt="" loading="lazy"></div><div class="cat__name">' + hit.name.replace(/[<>&"]/g, function (ch) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch]; }) + '</div></a>';
    }
    if (html) { cats.innerHTML = html; catSec.hidden = false; watchReveal(catSec); }
  }

  /* ---------- ブログ新着 3 件: {BlogFeedPageURL} の RSS（独自拡張の image が画像 URL）を読む。トップページだけ ---------- */
  var journal = doc.getElementById('journal'), journalList = doc.getElementById('journalList');
  if (journal && journalList && journal.dataset.feed && doc.body.classList.contains('is-top')) {
    fetch(journal.dataset.feed, { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (xml) {
        var d = new DOMParser().parseFromString(xml, 'text/xml'), out = '';
        Array.prototype.slice.call(d.querySelectorAll('item'), 0, 3).forEach(function (it) {
          var g = function (t) { var n = it.getElementsByTagName(t)[0]; return n ? n.textContent.trim() : ''; };
          var link = g('link'), title = g('title'), image = g('image'), date = g('pubDate');
          var dt = date ? new Date(date) : null, ds = dt && !isNaN(dt) ? dt.getFullYear() + '.' + ('0' + (dt.getMonth() + 1)).slice(-2) + '.' + ('0' + dt.getDate()).slice(-2) : '';
          var esc = function (s) { return s.replace(/[<>&"]/g, function (ch) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch]; }); };
          out += '<a class="post rv" href="' + esc(link) + '">' + (image ? '<div class="post__img"><img src="' + esc(image) + '" alt="" loading="lazy"></div>' : '') + '<p class="post__meta">' + esc(ds) + '</p><h3>' + esc(title) + '</h3></a>';
        });
        if (out) { journalList.innerHTML = out; journal.hidden = false; watchReveal(journal); }
      })
      .catch(function () {});
  }

  /* ---------- 実寸表: 商品説明の「肩幅 46」のような行を拾って表にする。元の説明文はそのまま残す ---------- */
  var spec = doc.getElementById('spec'), specList = doc.getElementById('specList'), detail = doc.getElementById('itemDetail');
  if (spec && specList && detail) {
    var text = detail.innerText || detail.textContent || '';
    var re = /(肩幅|身幅|着丈|袖丈|裄丈|ウエスト|股上|股下|わたり|裾幅|総丈|ヒップ|バスト|全長|幅|高さ|奥行)\s*[:：]?\s*(約)?\s*(\d+(?:\.\d+)?)\s*(cm|㎝)?/g, m, rows = [], seen = {};
    while ((m = re.exec(text)) && rows.length < 8) {
      if (seen[m[1]]) continue; seen[m[1]] = 1;
      rows.push('<li><span>' + m[1] + '</span><b>' + m[3] + '</b></li>');
    }
    if (rows.length >= 2) { specList.innerHTML = rows.join(''); spec.hidden = false; }
  }

  /* ---------- 写真のサムネイル帯: スマホ・タブレットで「3 / 12」と小さい写真を出し、めくりと連動させる ---------- */
  var gallery = doc.getElementById('gallery'), galnav = doc.getElementById('galnav');
  if (gallery && galnav && 'IntersectionObserver' in window) {
    var gItems = gallery.querySelectorAll('.gallery__item'), thumbs = galnav.querySelectorAll('.galnav__thumb');
    if (gItems.length >= 2 && thumbs.length === gItems.length) {
      var galNow = doc.getElementById('galnavNow'), strip = doc.getElementById('galnavThumbs');
      var selectThumb = function (i) {
        galNow.textContent = i + 1;
        Array.prototype.forEach.call(thumbs, function (t, j) { t.setAttribute('aria-current', String(i === j)); });
        var t = thumbs[i];
        strip.scrollTo({ left: t.offsetLeft - strip.clientWidth / 2 + t.clientWidth / 2, behavior: 'smooth' });
      };
      galnav.hidden = false;
      selectThumb(0);
      // 写真が 6 割見えたら「今の写真」とみなす
      var gio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) selectThumb(Array.prototype.indexOf.call(gItems, e.target)); });
      }, { root: gallery, threshold: 0.6 });
      Array.prototype.forEach.call(gItems, function (it) { gio.observe(it); });
      Array.prototype.forEach.call(thumbs, function (t, i) {
        t.addEventListener('click', function () {
          var pad = parseFloat(getComputedStyle(gallery).scrollPaddingLeft) || 0;
          gallery.scrollTo({ left: gItems[i].offsetLeft - gallery.offsetLeft - pad, behavior: 'smooth' });
        });
      });
    }
  }

  /* ---------- シェア: 端末の共有画面（Instagram・LINE などのアプリに渡せる）が使えるときだけボタンを出す ---------- */
  var shareBox = doc.getElementById('itemShare'), shareNative = doc.getElementById('shareNative');
  if (shareBox && shareNative && navigator.share) {
    shareNative.hidden = false;
    shareNative.addEventListener('click', function () {
      navigator.share({ title: shareBox.getAttribute('data-title') || doc.title, url: shareBox.getAttribute('data-url') || location.href }).catch(function () {});
    });
  }

  /* ---------- 最近チェックした商品: 見た商品をこのブラウザに 12 件まで覚え、いま見ている商品以外を 8 件まで出す ---------- */
  var recent = doc.getElementById('recent'), recentList = doc.getElementById('recentList');
  if (recent && recentList) {
    var RKEY = 'archive-recent', rlist = [];
    try { rlist = JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch (e) { rlist = []; }
    if (!Array.isArray(rlist)) rlist = [];
    var rcur = recent.getAttribute('data-id');
    if (rcur) {
      rlist = rlist.filter(function (x) { return x && x.id !== rcur; });
      rlist.unshift({ id: rcur, t: recent.getAttribute('data-title'), p: recent.getAttribute('data-price'), i: recent.getAttribute('data-img'), u: location.href.split(/[?#]/)[0] });
      rlist = rlist.slice(0, 12);
      try { localStorage.setItem(RKEY, JSON.stringify(rlist)); } catch (e) {}
    }
    // 保存領域が書き換えられていても、リンク先は http(s) の URL だけに限る
    var okUrl = /^https?:\/\//;
    var show = rlist.filter(function (x) { return x && x.id !== rcur && okUrl.test(x.u || '') && (!x.i || okUrl.test(x.i)); }).slice(0, 8);
    if (show.length) {
      show.forEach(function (x) {
        var li = doc.createElement('li'), a = doc.createElement('a'), fig = doc.createElement('div'), row = doc.createElement('div');
        li.className = 'card'; a.className = 'card__link'; a.href = x.u; fig.className = 'card__img'; row.className = 'card__row';
        if (x.i) { var img = doc.createElement('img'); img.src = x.i; img.alt = x.t || ''; img.loading = 'lazy'; fig.appendChild(img); }
        var title = doc.createElement('p'), price = doc.createElement('p'), span = doc.createElement('span');
        title.className = 'card__title'; title.textContent = x.t || ''; price.className = 'card__price'; span.textContent = x.p || '';
        price.appendChild(span); row.appendChild(title); row.appendChild(price); a.appendChild(fig); a.appendChild(row); li.appendChild(a); recentList.appendChild(li);
      });
      recent.hidden = false;
    }
  }
})();
