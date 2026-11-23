/* In-app browsers (KakaoTalk, Instagram, Facebook, LINE, Naver …) often suspend pages and block
   peer-to-peer connections. Show a small banner offering to reopen the page in the real browser. */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var kakao = /KAKAOTALK/i.test(ua);
  var inApp = kakao || /Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|everytimeApp|DaumApps|wv\)/i.test(ua);
  if (!inApp) return;
  try { if (sessionStorage.getItem('noli:inapp-dismissed')) return; } catch (e) { }
  var android = /Android/i.test(ua);
  function openOutside() {
    var url = location.href;
    if (kakao) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); return; }
    if (android) { location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end'; return; }
    alert('오른쪽 위(또는 아래) 메뉴에서 "Safari로 열기"를 눌러 주세요.');
  }
  function show() {
    var bar = document.createElement('div');
    bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', '브라우저 안내');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:60;background:#1A1A22;color:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 12px 30px rgba(0,0,0,.35);font:14px/1.45 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;display:flex;gap:10px;align-items:center;max-width:540px;margin:0 auto;word-break:keep-all';
    var msg = document.createElement('div'); msg.style.cssText = 'flex:1 1 auto;min-width:0';
    msg.textContent = (kakao ? '카카오톡' : '앱') + ' 안의 브라우저에서는 친구와 연결이 자주 끊겨요. 크롬이나 사파리로 열어 주세요.';
    var go = document.createElement('button'); go.type = 'button'; go.textContent = '바로 열기';
    go.style.cssText = 'flex:none;border:0;border-radius:10px;background:#FFC53D;color:#1A1A22;font:inherit;font-weight:800;padding:10px 12px;cursor:pointer';
    go.onclick = openOutside;
    var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.textContent = '✕';
    x.style.cssText = 'flex:none;border:0;background:none;color:#fff;font:inherit;font-size:18px;padding:4px 6px;opacity:.7;cursor:pointer';
    x.onclick = function () { bar.remove(); document.body.style.paddingBottom = ''; try { sessionStorage.setItem('noli:inapp-dismissed', '1'); } catch (e) { } };
    bar.appendChild(msg); bar.appendChild(go); bar.appendChild(x);
    document.body.appendChild(bar); document.body.style.paddingBottom = '110px';
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
