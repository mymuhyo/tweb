"use strict";(this.webpackChunktweb=this.webpackChunktweb||[]).push([[641,63,709,810,776],{9638:(e,t,n)=>{n.d(t,{Z:()=>g});var a=n(3910),i=n(2738),o=n(4541),r=n(2325),s=n(3512),d=n(4494),c=n(279);let l,u=!1;function g(e){u||(l||(l=s.Z.managers.apiManager.getConfig().then((e=>e.suggested_lang_code!==r.ZP.lastRequestedLangCode?Promise.all([e,r.ZP.getStrings(e.suggested_lang_code,["Login.ContinueOnLanguage"]),r.ZP.getCacheLangPack()]):[])))).then((([t,n])=>{if(!t)return;const l=[];n.forEach((e=>{const t=r.ZP.strings.get(e.key);t&&(l.push(t),r.ZP.strings.set(e.key,e))}));const g="Login.ContinueOnLanguage",p=(0,d.Z)("btn-primary btn-secondary btn-primary-transparent primary",{text:g});p.lastElementChild.classList.remove("i18n"),(0,o.Z)({text:[r.ZP.format(g,!0)]}).then((()=>{window.requestAnimationFrame((()=>{e.append(p)}))})),s.Z.addEventListener("language_change",(()=>{p.remove()}),{once:!0}),l.forEach((e=>{r.ZP.strings.set(e.key,e)})),(0,i.fc)(p,(e=>{(0,a.Z)(e),u=!0,p.disabled=!0,(0,c.y)(p),r.ZP.getLangPack(t.suggested_lang_code)}))}))}},810:(e,t,n)=>{n.r(t),n.d(t,{default:()=>x});var a=n(279),i=n(4874),o=n(9807),r=n(4494),s=n(5432),d=n(4159),c=n(2325),l=n(1447),u=n(1405),g=n(9709),p=n(9638),h=n(3910),m=n(2738),y=n(5565),v=n(1656),f=n(7487),Z=n(2398),_=n(7922),L=n(3512),b=n(709),k=n(3855),w=n(5431);let S,E=null;const P=new i.Z("page-sign",!0,(()=>{const e=document.createElement("div");let t,i;e.classList.add("input-wrapper");const u=new w.Z({onCountryChange:(e,n)=>{t=e,i=n,n&&(x.value=x.lastValue="+"+n.country_code,setTimeout((()=>{C.focus(),(0,Z.Z)(C,!0)}),0))}}),x=new b.Z({onInput:e=>{l.Z.loadLottieWorkers();const{country:n,code:a}=e||{},o=n?n.name||n.default_name:"";o===u.value||t&&n&&a&&(t===n||i.country_code===a.country_code)||u.override(n,a,o),n||x.value.length-1>1?E.style.visibility="":E.style.visibility="hidden"}}),C=x.input;C.addEventListener("keypress",(e=>{if(!E.style.visibility&&"Enter"===e.key)return M()}));const T=new o.Z({text:"Login.KeepSigned",name:"keepSession",withRipple:!0,checked:!0});T.input.addEventListener("change",(()=>{const e=T.checked;L.Z.managers.appStateManager.pushToState("keepSigned",e),k.Z.toggleStorages(e,!0)})),k.Z.getState().then((e=>{_.Z.isAvailable()?T.checked=e.keepSigned:(T.checked=!1,T.label.classList.add("checkbox-disabled"))})),E=(0,r.Z)("btn-primary btn-color-primary",{text:"Login.Next"}),E.style.visibility="hidden";const M=e=>{e&&(0,h.Z)(e);const t=(0,v.Z)([E,S],!0);(0,y.Z)(E,(0,c.ag)("PleaseWait")),(0,a.y)(E);const i=x.value;L.Z.managers.apiManager.invokeApi("auth.sendCode",{phone_number:i,api_id:d.ZP.id,api_hash:d.ZP.hash,settings:{_:"codeSettings",pFlags:{}}}).then((e=>{if("auth.sentCodeSuccess"===e._){const{authorization:t}=e;"auth.authorization"===t._&&(L.Z.managers.apiManager.setUser(t.user),n.e(781).then(n.bind(n,5436)).then((e=>{e.default.mount()})))}n.e(392).then(n.bind(n,6392)).then((t=>t.default.mount(Object.assign(e,{phone_number:i}))))})).catch((e=>{t(),"PHONE_NUMBER_INVALID"===e.type?(x.setError(),(0,y.Z)(x.label,(0,c.ag)("Login.PhoneLabelInvalid")),C.classList.add("error"),(0,y.Z)(E,(0,c.ag)("Login.Next"))):(console.error("auth.sendCode error:",e),E.innerText=e.type)}))};(0,m.fc)(E,M),S=(0,r.Z)("btn-primary btn-secondary btn-primary-transparent primary",{text:"Login.QR.Login"}),S.addEventListener("click",(()=>{g.default.mount()})),e.append(u.container,x.container,T.label,E,S);const A=document.createElement("h4");A.classList.add("text-center"),(0,c.$d)(A,"Login.Title");const R=document.createElement("div");R.classList.add("subtitle","text-center"),(0,c.$d)(R,"Login.StartText"),P.pageEl.querySelector(".container").append(A,R,e),s.Z||setTimeout((()=>{C.focus()}),0),(0,p.Z)(e),L.Z.managers.apiManager.invokeApi("help.getNearestDc").then((e=>{var t;const n=_.Z.getFromCache("langPack");n&&!(null===(t=n.countries)||void 0===t?void 0:t.hash)&&c.ZP.getLangPack(n.lang_code).then((()=>{x.simulateInputEvent()}));const a=new Set([1,2,3,4,5]),i=[e.this_dc];let o;return e.nearest_dc!==e.this_dc&&(o=L.Z.managers.apiManager.getNetworkerVoid(e.nearest_dc).then((()=>{i.push(e.nearest_dc)}))),(o||Promise.resolve()).then((()=>{i.forEach((e=>{a.delete(e)}));const e=[...a],t=()=>{return n=void 0,a=void 0,o=function*(){const n=e.shift();if(!n)return;const a=`dc${n}_auth_key`;if(yield f.Z.get(a))return t();setTimeout((()=>{L.Z.managers.apiManager.getNetworkerVoid(n).finally(t)}),3e3)},new((i=void 0)||(i=Promise))((function(e,t){function r(e){try{d(o.next(e))}catch(e){t(e)}}function s(e){try{d(o.throw(e))}catch(e){t(e)}}function d(t){var n;t.done?e(t.value):(n=t.value,n instanceof i?n:new i((function(e){e(n)}))).then(r,s)}d((o=o.apply(n,a||[])).next())}));var n,a,i,o};t()})),e})).then((e=>{u.value.length||x.value.length||u.selectCountryByIso2(e.country)}))}),(()=>{E&&((0,y.Z)(E,(0,c.ag)("Login.Next")),(0,u.Z)(E,void 0,void 0,!0),E.removeAttribute("disabled")),S&&S.removeAttribute("disabled"),L.Z.managers.appStateManager.pushToState("authState",{_:"authStateSignIn"})})),x=P},9709:(e,t,n)=>{n.r(t),n.d(t,{default:()=>v});var a=n(4874),i=n(4159),o=n(4494),r=n(2325),s=n(3512),d=n(279),c=n(9638),l=n(5418),u=n(9895);function g(e){return e<26?e+65:e<52?e+71:e<62?e-4:62===e?43:63===e?47:65}var p=n(8812),h=function(e,t,n,a){return new(n||(n=Promise))((function(i,o){function r(e){try{d(a.next(e))}catch(e){o(e)}}function s(e){try{d(a.throw(e))}catch(e){o(e)}}function d(e){var t;e.done?i(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(r,s)}d((a=a.apply(e,t||[])).next())}))};let m;const y=new a.Z("page-signQR",!0,(()=>m),(()=>{m||(m=h(void 0,void 0,void 0,(function*(){const e=y.pageEl.querySelector(".auth-image");let t=(0,d.y)(e,!0);const a=document.createElement("div");a.classList.add("input-wrapper");const v=(0,o.Z)("btn-primary btn-secondary btn-primary-transparent primary",{text:"Login.QR.Cancel"});a.append(v),(0,c.Z)(a);const f=e.parentElement,Z=document.createElement("h4");(0,r.$d)(Z,"Login.QR.Title");const _=document.createElement("ol");_.classList.add("qr-description"),["Login.QR.Help1","Login.QR.Help2","Login.QR.Help3"].forEach((e=>{const t=document.createElement("li");t.append((0,r.ag)(e)),_.append(t)})),f.append(Z,_,a),v.addEventListener("click",(()=>{n.e(810).then(n.bind(n,810)).then((e=>e.default.mount())),b=!0}));const L=(yield Promise.all([n.e(630).then(n.t.bind(n,1915,23))]))[0].default;let b=!1;s.Z.addEventListener("user_auth",(()=>{b=!0,m=null}),{once:!0});const k={ignoreErrors:!0};let w;const S=a=>h(void 0,void 0,void 0,(function*(){try{let o=yield s.Z.managers.apiManager.invokeApi("auth.exportLoginToken",{api_id:i.ZP.id,api_hash:i.ZP.hash,except_ids:[]},{ignoreErrors:!0});if("auth.loginTokenMigrateTo"===o._&&(k.dcId||(k.dcId=o.dc_id,s.Z.managers.apiManager.setBaseDcId(o.dc_id)),o=yield s.Z.managers.apiManager.invokeApi("auth.importLoginToken",{token:o.token},k)),"auth.loginTokenSuccess"===o._){const e=o.authorization;return s.Z.managers.apiManager.setUser(e.user),n.e(781).then(n.bind(n,5436)).then((e=>e.default.mount())),!0}if(!w||!(0,u.Z)(w,o.token)){w=o.token;const n="tg://login?token="+function(e){let t,n="";for(let a=e.length,i=0,o=0;o<a;++o)t=o%3,i|=e[o]<<(16>>>t&24),2!==t&&a-o!=1||(n+=String.fromCharCode(g(i>>>18&63),g(i>>>12&63),g(i>>>6&63),g(63&i)),i=0);return n.replace(/A(?=A$|$)/g,"=")}(o.token).replace(/\+/g,"-").replace(/\//g,"_").replace(/\=+$/,""),a=window.getComputedStyle(document.documentElement),i=a.getPropertyValue("--surface-color").trim(),r=a.getPropertyValue("--primary-text-color").trim(),s=a.getPropertyValue("--primary-color").trim(),d=yield fetch("assets/img/logo_padded.svg").then((e=>e.text())).then((e=>(e=e.replace(/(fill:).+?(;)/,`$1${s}$2`),(0,p.Z)(e)))),c=new L({width:240*window.devicePixelRatio,height:240*window.devicePixelRatio,data:n,image:d,dotsOptions:{color:r,type:"rounded"},cornersSquareOptions:{type:"extra-rounded"},imageOptions:{imageSize:1,margin:0},backgroundOptions:{color:i},qrOptions:{errorCorrectionLevel:"L"}});let u;c.append(e),e.lastChild.classList.add("qr-canvas"),u=c._drawingPromise?c._drawingPromise:Promise.race([(0,l.Z)(1e3),new Promise((e=>{c._canvas._image.addEventListener("load",(()=>{window.requestAnimationFrame((()=>e()))}),{once:!0})}))]),yield u.then((()=>{if(t){t.style.animation="hide-icon .4s forwards";const n=e.children[1];n.style.display="none",n.style.animation="grow-icon .4s forwards",setTimeout((()=>{n.style.display=""}),150),setTimeout((()=>{n.style.animation=""}),500),t=void 0}else Array.from(e.children).slice(0,-1).forEach((e=>{e.remove()}))}))}if(a){const e=Date.now()/1e3,t=o.expires-e-(yield s.Z.managers.timeManager.getServerTimeOffset());yield(0,l.Z)(t>3?3e3:1e3*t|0)}}catch(e){return"SESSION_PASSWORD_NEEDED"===e.type?(e.handled=!0,n.e(442).then(n.bind(n,9437)).then((e=>e.default.mount())),b=!0,m=null):(console.error("pageSignQR: default error:",e),b=!0),!0}return!1}));return()=>h(void 0,void 0,void 0,(function*(){for(b=!1;!b&&!(yield S(!0)););}))}))),m.then((e=>{e()})),s.Z.managers.appStateManager.pushToState("authState",{_:"authStateSignQr"})})),v=y}}]);
//# sourceMappingURL=641.c9c38a8719275da5f0e3.chunk.js.map