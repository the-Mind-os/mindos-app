/* ===================================================================
   Mind OS — Dev / Test Harness (#68)  ·  REUSABLE COMPONENT (DRY)
   One widget, shared by the member app (index.html) and coach portal
   (coach.html). Renders ONE collapsed "🛠 Dev" pill for test users only,
   consolidating: (A) test actions, (B) Live|Test env toggle + staging link,
   (C) View-as role/plan switcher, plus a persistent override banner.

   Owns the client flags devEnv + viewAs (single source of truth) in
   localStorage; the host page reads them via the getters and routes all
   gating through its own effectivePlan()/effectiveRole()/featureVisible().

   Feature-flagged: this whole surface is inert unless the page calls
   MindOSDevHarness.init(...) for an admin / is_test_user. Rollback = don't
   init (or set every flag off). No effect on normal members.
   =================================================================== */
(function(){
  'use strict';
  if (window.MindOSDevHarness) return; // load once

  var LS_ENV='mos_devEnv', LS_VIEW='mos_viewAs', LS_OPEN='mos_devOpen';
  function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  var state = {
    env:  (lsGet(LS_ENV,'live')==='test')?'test':'live',
    view: lsGet(LS_VIEW,'me') || 'me',
    open: lsGet(LS_OPEN,'0')==='1',
    opts: null,
    mounted:false
  };

  var CSS = ''
    + '#mosDevPill{position:fixed;right:12px;bottom:12px;z-index:2147483000;'
    +   'background:#173622;color:#fff;border:none;border-radius:22px;'
    +   'padding:8px 13px;font:600 12px Poppins,system-ui,sans-serif;cursor:pointer;'
    +   'box-shadow:0 4px 16px rgba(23,54,34,.32);opacity:.92;display:flex;align-items:center;gap:6px}'
    + '#mosDevPill:hover{opacity:1}'
    + '#mosDevPill .dot{width:7px;height:7px;border-radius:50%;background:#4DF28A}'
    + '#mosDevPill.testenv .dot{background:#F2C14D}'
    + '#mosDevPanel{position:fixed;right:12px;bottom:54px;z-index:2147483001;width:270px;max-width:calc(100vw - 24px);'
    +   'background:#fff;color:#0c1a12;border:1px solid #dbe9e0;border-radius:16px;'
    +   'box-shadow:0 12px 40px rgba(12,26,18,.28);padding:14px;'
    +   'font-family:Poppins,system-ui,sans-serif;max-height:78vh;overflow:auto;display:none}'
    + '#mosDevPanel.show{display:block}'
    + '#mosDevPanel h4{font:700 11px Poppins,sans-serif;letter-spacing:.4px;text-transform:uppercase;'
    +   'color:#5d6f64;margin:0 0 7px}'
    + '#mosDevPanel .grp{margin-bottom:14px}'
    + '#mosDevPanel .grp:last-child{margin-bottom:0}'
    + '#mosDevPanel .seg{display:flex;flex-wrap:wrap;gap:6px}'
    + '#mosDevPanel .seg button{flex:1 1 auto;min-width:56px;background:#eef7f1;color:#173622;border:1px solid #dbe9e0;'
    +   'border-radius:9px;padding:7px 8px;font:600 12px Poppins,sans-serif;cursor:pointer}'
    + '#mosDevPanel .seg button.on{background:#173622;color:#fff;border-color:#173622}'
    + '#mosDevPanel .act{display:flex;flex-wrap:wrap;gap:6px}'
    + '#mosDevPanel .act button{flex:1 1 auto;color:#fff;border:none;border-radius:9px;padding:7px 9px;'
    +   'font:600 11.5px Poppins,sans-serif;cursor:pointer;opacity:.94}'
    + '#mosDevPanel .stg{display:block;margin-top:8px;font-size:12px;color:#1e9e54;text-decoration:underline;font-weight:600}'
    + '#mosDevPanel .rst{width:100%;margin-top:8px;background:#fff;border:1px solid #dbe9e0;color:#5d6f64;'
    +   'border-radius:9px;padding:7px;font:600 12px Poppins,sans-serif;cursor:pointer}'
    + '#mosDevPanel .cls{position:absolute;top:10px;right:12px;background:none;border:none;font-size:20px;'
    +   'line-height:1;color:#9fb3a6;cursor:pointer}'
    + '#mosDevPanel .note{font-size:11px;color:#9fb3a6;margin-top:6px;line-height:1.4}'
    + '#mosDevBanner{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:2147482999;'
    +   'background:#F2C14D;color:#3a2c07;border-radius:22px;padding:7px 14px;'
    +   'font:600 12px Poppins,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.18);'
    +   'display:none;align-items:center;gap:10px}'
    + '#mosDevBanner.show{display:flex}'
    + '#mosDevBanner button{background:#3a2c07;color:#fff;border:none;border-radius:14px;'
    +   'padding:4px 10px;font:600 11px Poppins,sans-serif;cursor:pointer}';

  function injectCss(){
    if (document.getElementById('mosDevCss')) return;
    var s=document.createElement('style'); s.id='mosDevCss'; s.textContent=CSS;
    document.head.appendChild(s);
  }

  var PLAN_VIEWS=['free','advanced','community'];
  var ROLE_VIEWS=['coach','leader','admin'];

  function fireEnv(){ try{ state.opts.onEnvChange && state.opts.onEnvChange(state.env); }catch(e){} }
  function fireView(){ try{ state.opts.onViewChange && state.opts.onViewChange(state.view); }catch(e){} }

  function setEnv(v){ state.env=(v==='test')?'test':'live'; lsSet(LS_ENV,state.env); render(); fireEnv(); updateBanner(); }
  function setView(v){ state.view=v||'me'; lsSet(LS_VIEW,state.view); render(); fireView(); updateBanner(); }
  function reset(){ setView('me'); }

  function label(v){
    if(v==='me')return 'My account';
    return v.charAt(0).toUpperCase()+v.slice(1);
  }

  function updateBanner(){
    var b=document.getElementById('mosDevBanner'); if(!b) return;
    var active = state.env==='test' || state.view!=='me';
    if(!active){ b.classList.remove('show'); return; }
    var bits=[];
    if(state.env==='test') bits.push('TEST');
    if(state.view!=='me') bits.push('viewing as '+label(state.view));
    b.querySelector('.txt').textContent = bits.join(' · ');
    b.classList.add('show');
  }

  function render(){
    var pill=document.getElementById('mosDevPill');
    var panel=document.getElementById('mosDevPanel');
    if(!pill||!panel) return;
    pill.classList.toggle('testenv', state.env==='test');
    panel.classList.toggle('show', state.open);

    // env segment
    Array.prototype.forEach.call(panel.querySelectorAll('[data-env]'),function(btn){
      btn.classList.toggle('on', btn.getAttribute('data-env')===state.env);
    });
    // view segment
    Array.prototype.forEach.call(panel.querySelectorAll('[data-view]'),function(btn){
      btn.classList.toggle('on', btn.getAttribute('data-view')===state.view);
    });
  }

  function build(){
    injectCss();
    var o=state.opts;

    var pill=document.createElement('button');
    pill.id='mosDevPill';
    pill.innerHTML='<span class="dot"></span>🛠 Dev';
    pill.title='Test harness (admin/test users only)';
    pill.onclick=function(){ state.open=!state.open; lsSet(LS_OPEN, state.open?'1':'0'); render(); };
    document.body.appendChild(pill);

    var panel=document.createElement('div');
    panel.id='mosDevPanel';

    var html='<button class="cls" title="Close">&times;</button>';

    // A. Test actions
    if(o.testActions && o.testActions.length){
      html+='<div class="grp"><h4>Test actions</h4><div class="act">';
      o.testActions.forEach(function(a,i){
        html+='<button data-act="'+i+'" title="'+(a.title||'').replace(/"/g,'&quot;')+'" style="background:'+(a.bg||'#173622')+'">'+a.label+'</button>';
      });
      html+='</div></div>';
    }

    // B. Environment
    html+='<div class="grp"><h4>Environment</h4><div class="seg">'
        + '<button data-env="live">Live</button>'
        + '<button data-env="test">Test</button>'
        + '</div>';
    if(o.stagingUrl){
      html+='<a class="stg" href="'+o.stagingUrl+'" target="_blank" rel="noopener">Open staging build ↗</a>';
    } else {
      html+='<div class="note">Staging preview URL not set yet (logged for Ari).</div>';
    }
    html+='<div class="note">Live = what real users see. Test reveals in-progress features.</div></div>';

    // C. View as
    if(o.viewAs!==false){
      var roles=o.viewAsRoles||['me'].concat(PLAN_VIEWS).concat(ROLE_VIEWS);
      html+='<div class="grp"><h4>View as</h4><div class="seg">';
      roles.forEach(function(r){
        html+='<button data-view="'+r+'">'+label(r)+'</button>';
      });
      html+='</div><button class="rst" data-view="me">Reset to my account</button>'
          + '<div class="note">Read-only preview. Writes are blocked while impersonating.</div></div>';
    }

    panel.innerHTML=html;
    document.body.appendChild(panel);

    // banner
    var banner=document.createElement('div');
    banner.id='mosDevBanner';
    banner.innerHTML='<span class="txt"></span><button type="button">Reset</button>';
    banner.querySelector('button').onclick=function(){ reset(); };
    document.body.appendChild(banner);

    // wire
    panel.querySelector('.cls').onclick=function(){ state.open=false; lsSet(LS_OPEN,'0'); render(); };
    Array.prototype.forEach.call(panel.querySelectorAll('[data-env]'),function(btn){
      btn.onclick=function(){ setEnv(btn.getAttribute('data-env')); };
    });
    Array.prototype.forEach.call(panel.querySelectorAll('[data-view]'),function(btn){
      btn.onclick=function(){ setView(btn.getAttribute('data-view')); };
    });
    if(o.testActions){
      Array.prototype.forEach.call(panel.querySelectorAll('[data-act]'),function(btn){
        btn.onclick=function(){ try{ o.testActions[+btn.getAttribute('data-act')].onClick(btn); }catch(e){} };
      });
    }

    state.mounted=true;
    render();
    updateBanner();
  }

  window.MindOSDevHarness = {
    // opts: { isTestUser:bool, testActions:[{label,title,bg,onClick}], stagingUrl, viewAs:bool,
    //         viewAsRoles:[...], onEnvChange(env), onViewChange(view) }
    init:function(opts){
      opts=opts||{};
      if(!opts.isTestUser) return false;      // gate: admin / is_test_user only
      state.opts=opts;
      if(document.body){ build(); }
      else { document.addEventListener('DOMContentLoaded', build); }
      // fire once so the page applies current flags on load
      fireEnv(); fireView();
      return true;
    },
    env:  function(){ return state.env; },
    viewAs:function(){ return state.view; },
    impersonating:function(){ return state.view!=='me'; }
  };
})();
