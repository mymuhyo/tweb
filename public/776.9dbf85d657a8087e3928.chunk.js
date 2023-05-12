"use strict";(this.webpackChunktweb=this.webpackChunktweb||[]).push([[776,709],{9638:(e,t,n)=>{n.d(t,{Z:()=>u});var a=n(3910),i=n(2738),r=n(4541),o=n(2325),s=n(3512),d=n(4494),c=n(279);let l,g=!1;function u(e){g||(l||(l=s.Z.managers.apiManager.getConfig().then((e=>e.suggested_lang_code!==o.ZP.lastRequestedLangCode?Promise.all([e,o.ZP.getStrings(e.suggested_lang_code,["Login.ContinueOnLanguage"]),o.ZP.getCacheLangPack()]):[])))).then((([t,n])=>{if(!t)return;const l=[];n.forEach((e=>{const t=o.ZP.strings.get(e.key);t&&(l.push(t),o.ZP.strings.set(e.key,e))}));const u="Login.ContinueOnLanguage",p=(0,d.Z)("btn-primary btn-secondary btn-primary-transparent primary",{text:u});p.lastElementChild.classList.remove("i18n"),(0,r.Z)({text:[o.ZP.format(u,!0)]}).then((()=>{window.requestAnimationFrame((()=>{e.append(p)}))})),s.Z.addEventListener("language_change",(()=>{p.remove()}),{once:!0}),l.forEach((e=>{o.ZP.strings.set(e.key,e)})),(0,i.fc)(p,(e=>{(0,a.Z)(e),g=!0,p.disabled=!0,(0,c.y)(p),o.ZP.getLangPack(t.suggested_lang_code)}))}))}},9709:(e,t,n)=>{n.r(t),n.d(t,{default:()=>f});var a=n(4874),i=n(4159),r=n(4494),o=n(2325),s=n(3512),d=n(279),c=n(9638),l=n(5418),g=n(9895);function u(e){return e<26?e+65:e<52?e+71:e<62?e-4:62===e?43:63===e?47:65}var p=n(8812),m=function(e,t,n,a){return new(n||(n=Promise))((function(i,r){function o(e){try{d(a.next(e))}catch(e){r(e)}}function s(e){try{d(a.throw(e))}catch(e){r(e)}}function d(e){var t;e.done?i(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(o,s)}d((a=a.apply(e,t||[])).next())}))};let h;const y=new a.Z("page-signQR",!0,(()=>h),(()=>{h||(h=m(void 0,void 0,void 0,(function*(){const e=y.pageEl.querySelector(".auth-image");let t=(0,d.y)(e,!0);const a=document.createElement("div");a.classList.add("input-wrapper");const f=(0,r.Z)("btn-primary btn-secondary btn-primary-transparent primary",{text:"Login.QR.Cancel"});a.append(f),(0,c.Z)(a);const v=e.parentElement,Z=document.createElement("h4");(0,o.$d)(Z,"Login.QR.Title");const w=document.createElement("ol");w.classList.add("qr-description"),["Login.QR.Help1","Login.QR.Help2","Login.QR.Help3"].forEach((e=>{const t=document.createElement("li");t.append((0,o.ag)(e)),w.append(t)})),v.append(Z,w,a),f.addEventListener("click",(()=>{n.e(810).then(n.bind(n,810)).then((e=>e.default.mount())),L=!0}));const P=(yield Promise.all([n.e(630).then(n.t.bind(n,1915,23))]))[0].default;let L=!1;s.Z.addEventListener("user_auth",(()=>{L=!0,h=null}),{once:!0});const _={ignoreErrors:!0};let k;const E=a=>m(void 0,void 0,void 0,(function*(){try{let r=yield s.Z.managers.apiManager.invokeApi("auth.exportLoginToken",{api_id:i.ZP.id,api_hash:i.ZP.hash,except_ids:[]},{ignoreErrors:!0});if("auth.loginTokenMigrateTo"===r._&&(_.dcId||(_.dcId=r.dc_id,s.Z.managers.apiManager.setBaseDcId(r.dc_id)),r=yield s.Z.managers.apiManager.invokeApi("auth.importLoginToken",{token:r.token},_)),"auth.loginTokenSuccess"===r._){const e=r.authorization;return s.Z.managers.apiManager.setUser(e.user),n.e(781).then(n.bind(n,5436)).then((e=>e.default.mount())),!0}if(!k||!(0,g.Z)(k,r.token)){k=r.token;const n="tg://login?token="+function(e){let t,n="";for(let a=e.length,i=0,r=0;r<a;++r)t=r%3,i|=e[r]<<(16>>>t&24),2!==t&&a-r!=1||(n+=String.fromCharCode(u(i>>>18&63),u(i>>>12&63),u(i>>>6&63),u(63&i)),i=0);return n.replace(/A(?=A$|$)/g,"=")}(r.token).replace(/\+/g,"-").replace(/\//g,"_").replace(/\=+$/,""),a=window.getComputedStyle(document.documentElement),i=a.getPropertyValue("--surface-color").trim(),o=a.getPropertyValue("--primary-text-color").trim(),s=a.getPropertyValue("--primary-color").trim(),d=yield fetch("assets/img/logo_padded.svg").then((e=>e.text())).then((e=>(e=e.replace(/(fill:).+?(;)/,`$1${s}$2`),(0,p.Z)(e)))),c=new P({width:240*window.devicePixelRatio,height:240*window.devicePixelRatio,data:n,image:d,dotsOptions:{color:o,type:"rounded"},cornersSquareOptions:{type:"extra-rounded"},imageOptions:{imageSize:1,margin:0},backgroundOptions:{color:i},qrOptions:{errorCorrectionLevel:"L"}});let g;c.append(e),e.lastChild.classList.add("qr-canvas"),g=c._drawingPromise?c._drawingPromise:Promise.race([(0,l.Z)(1e3),new Promise((e=>{c._canvas._image.addEventListener("load",(()=>{window.requestAnimationFrame((()=>e()))}),{once:!0})}))]),yield g.then((()=>{if(t){t.style.animation="hide-icon .4s forwards";const n=e.children[1];n.style.display="none",n.style.animation="grow-icon .4s forwards",setTimeout((()=>{n.style.display=""}),150),setTimeout((()=>{n.style.animation=""}),500),t=void 0}else Array.from(e.children).slice(0,-1).forEach((e=>{e.remove()}))}))}if(a){const e=Date.now()/1e3,t=r.expires-e-(yield s.Z.managers.timeManager.getServerTimeOffset());yield(0,l.Z)(t>3?3e3:1e3*t|0)}}catch(e){return"SESSION_PASSWORD_NEEDED"===e.type?(e.handled=!0,n.e(442).then(n.bind(n,9437)).then((e=>e.default.mount())),L=!0,h=null):(console.error("pageSignQR: default error:",e),L=!0),!0}return!1}));return()=>m(void 0,void 0,void 0,(function*(){for(L=!1;!L&&!(yield E(!0)););}))}))),h.then((e=>{e()})),s.Z.managers.appStateManager.pushToState("authState",{_:"authStateSignQr"})})),f=y}}]);
//# sourceMappingURL=776.9dbf85d657a8087e3928.chunk.js.map