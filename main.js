/* Archive — BASE デザインテーマの JS。jQuery に依存しない。
   やること: ドロワー / お知らせ帯 / ヒーロー自動送り / スクロール表示 / 追加読み込み（ブラウザバックの復元つき）
   / カテゴリ画像タイル / ブログ RSS / 実寸表 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  root.classList.add('js');
  if (doc.body.classList.contains('is-index') && !location.search.match(/[?&]q=/) && !location.pathname.match(/\/categories\//)) {
    doc.body.classList.add('is-top');
  }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ---------- お知らせ帯: 文言を複製して途切れなく流す ---------- */
  var mq = doc.querySelector('.marquee__in');
  if (mq && mq.firstElementChild) {
    var span = mq.firstElementChild, n = Math.max(2, Math.ceil(window.innerWidth * 2 / Math.max(span.offsetWidth, 1)));
    for (var i = 1; i < n; i++) mq.appendChild(span.cloneNode(true));
    if (!reduce) mq.classList.add('is-anim');
  }

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
})();
