var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{};function t(e,t,r,o){Object.defineProperty(e,t,{get:r,set:o,enumerable:!0,configurable:!0})}var r=e.parcelRequired7b7;r.register("iMHOE",(function(e,t){var o=e.exports&&e.exports.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e.exports,"__esModule",{value:!0});const n=o(r("kuFsJ")),s=o(r("9LxR1")),a=o(r("bupd9")),i=new s.default.Agent({keepAlive:!0}),h=new a.default.Agent({keepAlive:!0});e.exports.default=function(e,t){return(0,n.default)(e,Object.assign({agent:(r=new URL(e.toString()),"http:"===r.protocol?i:h)},t));var r}})),r.register("kuFsJ",(function(e,t){var r=function(){if("undefined"!=typeof self)return self;if("undefined"!=typeof window)return window;if(void 0!==r)return r;throw new Error("unable to locate global object")}();e.exports=t=r.fetch,r.fetch&&(t.default=r.fetch.bind(r)),t.Headers=r.Headers,t.Request=r.Request,t.Response=r.Response})),r.register("9LxR1",(function(t,o){var n=r("1DJns"),s=r("7lfQd"),a=r("8k6Kq"),i=r("bL9Wv"),h=r("47FnH"),u=t.exports;u.request=function(t,r){t="string"==typeof t?h.parse(t):a(t);var o=-1===e.location.protocol.search(/^https?:$/)?"http:":"",s=t.protocol||o,i=t.hostname||t.host,u=t.port,c=t.path||"/";i&&-1!==i.indexOf(":")&&(i="["+i+"]"),t.url=(i?s+"//"+i:"")+(u?":"+u:"")+c,t.method=(t.method||"GET").toUpperCase(),t.headers=t.headers||{};var f=new n(t);return r&&f.on("response",r),f},u.get=function(e,t){var r=u.request(e,t);return r.end(),r},u.ClientRequest=n,u.IncomingMessage=s.IncomingMessage,u.Agent=function(){},u.Agent.defaultMaxSockets=4,u.globalAgent=new u.Agent,u.STATUS_CODES=i,u.METHODS=["CHECKOUT","CONNECT","COPY","DELETE","GET","HEAD","LOCK","M-SEARCH","MERGE","MKACTIVITY","MKCOL","MOVE","NOTIFY","OPTIONS","PATCH","POST","PROPFIND","PROPPATCH","PURGE","PUT","REPORT","SEARCH","SUBSCRIBE","TRACE","UNLOCK","UNSUBSCRIBE"]})),r.register("1DJns",(function(t,o){var n=r("a5Ykp"),s=r("fpMrF").Buffer,a=r("81Phs"),i=r("9tbCW"),h=r("7lfQd"),u=r("f3YQa"),c=h.IncomingMessage,f=h.readyStates;var l=t.exports=function(e){var t,r=this;u.Writable.call(r),r._opts=e,r._body=[],r._headers={},e.auth&&r.setHeader("Authorization","Basic "+s.from(e.auth).toString("base64")),Object.keys(e.headers).forEach((function(t){r.setHeader(t,e.headers[t])}));var o=!0;if("disable-fetch"===e.mode||"requestTimeout"in e&&!a.abortController)o=!1,t=!0;else if("prefer-streaming"===e.mode)t=!1;else if("allow-wrong-content-type"===e.mode)t=!a.overrideMimeType;else{if(e.mode&&"default"!==e.mode&&"prefer-fast"!==e.mode)throw new Error("Invalid value for opts.mode");t=!0}r._mode=function(e,t){return a.fetch&&t?"fetch":a.mozchunkedarraybuffer?"moz-chunked-arraybuffer":a.msstream?"ms-stream":a.arraybuffer&&e?"arraybuffer":"text"}(t,o),r._fetchTimer=null,r._socketTimeout=null,r._socketTimer=null,r.on("finish",(function(){r._onFinish()}))};i(l,u.Writable),l.prototype.setHeader=function(e,t){var r=e.toLowerCase();-1===p.indexOf(r)&&(this._headers[r]={name:e,value:t})},l.prototype.getHeader=function(e){var t=this._headers[e.toLowerCase()];return t?t.value:null},l.prototype.removeHeader=function(e){delete this._headers[e.toLowerCase()]},l.prototype._onFinish=function(){var t=this;if(!t._destroyed){var r=t._opts;"timeout"in r&&0!==r.timeout&&t.setTimeout(r.timeout);var o=t._headers,s=null;"GET"!==r.method&&"HEAD"!==r.method&&(s=new Blob(t._body,{type:(o["content-type"]||{}).value||""}));var i=[];if(Object.keys(o).forEach((function(e){var t=o[e].name,r=o[e].value;Array.isArray(r)?r.forEach((function(e){i.push([t,e])})):i.push([t,r])})),"fetch"===t._mode){var h=null;if(a.abortController){var u=new AbortController;h=u.signal,t._fetchAbortController=u,"requestTimeout"in r&&0!==r.requestTimeout&&(t._fetchTimer=e.setTimeout((function(){t.emit("requestTimeout"),t._fetchAbortController&&t._fetchAbortController.abort()}),r.requestTimeout))}e.fetch(t._opts.url,{method:t._opts.method,headers:i,body:s||void 0,mode:"cors",credentials:r.withCredentials?"include":"same-origin",signal:h}).then((function(e){t._fetchResponse=e,t._resetTimers(!1),t._connect()}),(function(e){t._resetTimers(!0),t._destroyed||t.emit("error",e)}))}else{var c=t._xhr=new e.XMLHttpRequest;try{c.open(t._opts.method,t._opts.url,!0)}catch(e){return void n.nextTick((function(){t.emit("error",e)}))}"responseType"in c&&(c.responseType=t._mode),"withCredentials"in c&&(c.withCredentials=!!r.withCredentials),"text"===t._mode&&"overrideMimeType"in c&&c.overrideMimeType("text/plain; charset=x-user-defined"),"requestTimeout"in r&&(c.timeout=r.requestTimeout,c.ontimeout=function(){t.emit("requestTimeout")}),i.forEach((function(e){c.setRequestHeader(e[0],e[1])})),t._response=null,c.onreadystatechange=function(){switch(c.readyState){case f.LOADING:case f.DONE:t._onXHRProgress()}},"moz-chunked-arraybuffer"===t._mode&&(c.onprogress=function(){t._onXHRProgress()}),c.onerror=function(){t._destroyed||(t._resetTimers(!0),t.emit("error",new Error("XHR error")))};try{c.send(s)}catch(e){return void n.nextTick((function(){t.emit("error",e)}))}}}},l.prototype._onXHRProgress=function(){var e=this;e._resetTimers(!1),function(e){try{var t=e.status;return null!==t&&0!==t}catch(e){return!1}}(e._xhr)&&!e._destroyed&&(e._response||e._connect(),e._response._onXHRProgress(e._resetTimers.bind(e)))},l.prototype._connect=function(){var e=this;e._destroyed||(e._response=new c(e._xhr,e._fetchResponse,e._mode,e._resetTimers.bind(e)),e._response.on("error",(function(t){e.emit("error",t)})),e.emit("response",e._response))},l.prototype._write=function(e,t,r){this._body.push(e),r()},l.prototype._resetTimers=function(t){var r=this;e.clearTimeout(r._socketTimer),r._socketTimer=null,t?(e.clearTimeout(r._fetchTimer),r._fetchTimer=null):r._socketTimeout&&(r._socketTimer=e.setTimeout((function(){r.emit("timeout")}),r._socketTimeout))},l.prototype.abort=l.prototype.destroy=function(e){var t=this;t._destroyed=!0,t._resetTimers(!0),t._response&&(t._response._destroyed=!0),t._xhr?t._xhr.abort():t._fetchAbortController&&t._fetchAbortController.abort(),e&&t.emit("error",e)},l.prototype.end=function(e,t,r){"function"==typeof e&&(r=e,e=void 0),u.Writable.prototype.end.call(this,e,t,r)},l.prototype.setTimeout=function(e,t){var r=this;t&&r.once("timeout",t),r._socketTimeout=e,r._resetTimers(!1)},l.prototype.flushHeaders=function(){},l.prototype.setNoDelay=function(){},l.prototype.setSocketKeepAlive=function(){};var p=["accept-charset","accept-encoding","access-control-request-headers","access-control-request-method","connection","content-length","cookie","cookie2","date","dnt","expect","host","keep-alive","origin","referer","te","trailer","transfer-encoding","upgrade","via"]})),r.register("81Phs",(function(r,o){var n,s,a,i,h,u,c,f;function l(){if(void 0!==f)return f;if(e.XMLHttpRequest){f=new e.XMLHttpRequest;try{f.open("GET",e.XDomainRequest?"/":"https://example.com")}catch(e){f=null}}else f=null;return f}function p(e){var t=l();if(!t)return!1;try{return t.responseType=e,t.responseType===e}catch(e){}return!1}function d(e){return"function"==typeof e}t(r.exports,"fetch",(function(){return n}),(function(e){return n=e})),t(r.exports,"writableStream",(function(){return s}),(function(e){return s=e})),t(r.exports,"abortController",(function(){return a}),(function(e){return a=e})),t(r.exports,"arraybuffer",(function(){return i}),(function(e){return i=e})),t(r.exports,"msstream",(function(){return h}),(function(e){return h=e})),t(r.exports,"mozchunkedarraybuffer",(function(){return u}),(function(e){return u=e})),t(r.exports,"overrideMimeType",(function(){return c}),(function(e){return c=e})),n=d(e.fetch)&&d(e.ReadableStream),s=d(e.WritableStream),a=d(e.AbortController),i=n||p("arraybuffer"),h=!n&&p("ms-stream"),u=!n&&p("moz-chunked-arraybuffer"),c=n||!!l()&&d(l().overrideMimeType),f=null})),r.register("7lfQd",(function(o,n){var s,a;t(o.exports,"readyStates",(function(){return s}),(function(e){return s=e})),t(o.exports,"IncomingMessage",(function(){return a}),(function(e){return a=e}));var i=r("a5Ykp"),h=r("fpMrF").Buffer,u=r("81Phs"),c=r("9tbCW"),f=r("f3YQa"),l=s={UNSENT:0,OPENED:1,HEADERS_RECEIVED:2,LOADING:3,DONE:4},p=a=function(e,t,r,o){var n=this;if(f.Readable.call(n),n._mode=r,n.headers={},n.rawHeaders=[],n.trailers={},n.rawTrailers=[],n.on("end",(function(){i.nextTick((function(){n.emit("close")}))})),"fetch"===r){if(n._fetchResponse=t,n.url=t.url,n.statusCode=t.status,n.statusMessage=t.statusText,t.headers.forEach((function(e,t){n.headers[t.toLowerCase()]=e,n.rawHeaders.push(t,e)})),u.writableStream){var s=new WritableStream({write:function(e){return o(!1),new Promise((function(t,r){n._destroyed?r():n.push(h.from(e))?t():n._resumeFetch=t}))},close:function(){o(!0),n._destroyed||n.push(null)},abort:function(e){o(!0),n._destroyed||n.emit("error",e)}});try{return void t.body.pipeTo(s).catch((function(e){o(!0),n._destroyed||n.emit("error",e)}))}catch(e){}}var a=t.body.getReader();!function e(){a.read().then((function(t){n._destroyed||(o(t.done),t.done?n.push(null):(n.push(h.from(t.value)),e()))})).catch((function(e){o(!0),n._destroyed||n.emit("error",e)}))}()}else{if(n._xhr=e,n._pos=0,n.url=e.responseURL,n.statusCode=e.status,n.statusMessage=e.statusText,e.getAllResponseHeaders().split(/\r?\n/).forEach((function(e){var t=e.match(/^([^:]+):\s*(.*)/);if(t){var r=t[1].toLowerCase();"set-cookie"===r?(void 0===n.headers[r]&&(n.headers[r]=[]),n.headers[r].push(t[2])):void 0!==n.headers[r]?n.headers[r]+=", "+t[2]:n.headers[r]=t[2],n.rawHeaders.push(t[1],t[2])}})),n._charset="x-user-defined",!u.overrideMimeType){var c=n.rawHeaders["mime-type"];if(c){var l=c.match(/;\s*charset=([^;])(;|$)/);l&&(n._charset=l[1].toLowerCase())}n._charset||(n._charset="utf-8")}}};c(p,f.Readable),p.prototype._read=function(){var e=this._resumeFetch;e&&(this._resumeFetch=null,e())},p.prototype._onXHRProgress=function(t){var r=this,o=r._xhr,n=null;switch(r._mode){case"text":if((n=o.responseText).length>r._pos){var s=n.substr(r._pos);if("x-user-defined"===r._charset){for(var a=h.alloc(s.length),i=0;i<s.length;i++)a[i]=255&s.charCodeAt(i);r.push(a)}else r.push(s,r._charset);r._pos=n.length}break;case"arraybuffer":if(o.readyState!==l.DONE||!o.response)break;n=o.response,r.push(h.from(new Uint8Array(n)));break;case"moz-chunked-arraybuffer":if(n=o.response,o.readyState!==l.LOADING||!n)break;r.push(h.from(new Uint8Array(n)));break;case"ms-stream":if(n=o.response,o.readyState!==l.LOADING)break;var u=new e.MSStreamReader;u.onprogress=function(){u.result.byteLength>r._pos&&(r.push(h.from(new Uint8Array(u.result.slice(r._pos)))),r._pos=u.result.byteLength)},u.onload=function(){t(!0),r.push(null)},u.readAsArrayBuffer(n)}r._xhr.readyState===l.DONE&&"ms-stream"!==r._mode&&(t(!0),r.push(null))}})),r.register("8k6Kq",(function(e,t){e.exports=function(){for(var e={},t=0;t<arguments.length;t++){var o=arguments[t];for(var n in o)r.call(o,n)&&(e[n]=o[n])}return e};var r=Object.prototype.hasOwnProperty})),r.register("bL9Wv",(function(e,t){e.exports={100:"Continue",101:"Switching Protocols",102:"Processing",200:"OK",201:"Created",202:"Accepted",203:"Non-Authoritative Information",204:"No Content",205:"Reset Content",206:"Partial Content",207:"Multi-Status",208:"Already Reported",226:"IM Used",300:"Multiple Choices",301:"Moved Permanently",302:"Found",303:"See Other",304:"Not Modified",305:"Use Proxy",307:"Temporary Redirect",308:"Permanent Redirect",400:"Bad Request",401:"Unauthorized",402:"Payment Required",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",406:"Not Acceptable",407:"Proxy Authentication Required",408:"Request Timeout",409:"Conflict",410:"Gone",411:"Length Required",412:"Precondition Failed",413:"Payload Too Large",414:"URI Too Long",415:"Unsupported Media Type",416:"Range Not Satisfiable",417:"Expectation Failed",418:"I'm a teapot",421:"Misdirected Request",422:"Unprocessable Entity",423:"Locked",424:"Failed Dependency",425:"Unordered Collection",426:"Upgrade Required",428:"Precondition Required",429:"Too Many Requests",431:"Request Header Fields Too Large",451:"Unavailable For Legal Reasons",500:"Internal Server Error",501:"Not Implemented",502:"Bad Gateway",503:"Service Unavailable",504:"Gateway Timeout",505:"HTTP Version Not Supported",506:"Variant Also Negotiates",507:"Insufficient Storage",508:"Loop Detected",509:"Bandwidth Limit Exceeded",510:"Not Extended",511:"Network Authentication Required"}})),r.register("47FnH",(function(e,o){var n;t(e.exports,"parse",(function(){return n}),(function(e){return n=e}));var s=r("567pR"),a=r("h69nw");function i(){this.protocol=null,this.slashes=null,this.auth=null,this.host=null,this.port=null,this.hostname=null,this.hash=null,this.search=null,this.query=null,this.pathname=null,this.path=null,this.href=null}n=w;var h=/^([a-z0-9.+-]+:)/i,u=/:[0-9]*$/,c=/^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,f=["{","}","|","\\","^","`"].concat(["<",">",'"',"`"," ","\r","\n","\t"]),l=["'"].concat(f),p=["%","/","?",";","#"].concat(l),d=["/","?","#"],m=/^[+a-z0-9A-Z_-]{0,63}$/,y=/^([+a-z0-9A-Z_-]{0,63})(.*)$/,v={javascript:!0,"javascript:":!0},g={javascript:!0,"javascript:":!0},b={http:!0,https:!0,ftp:!0,gopher:!0,file:!0,"http:":!0,"https:":!0,"ftp:":!0,"gopher:":!0,"file:":!0},_=r("1Xhaw");function w(e,t,r){if(e&&a.isObject(e)&&e instanceof i)return e;var o=new i;return o.parse(e,t,r),o}i.prototype.parse=function(e,t,r){if(!a.isString(e))throw new TypeError("Parameter 'url' must be a string, not "+typeof e);var o=e.indexOf("?"),n=-1!==o&&o<e.indexOf("#")?"?":"#",i=e.split(n);i[0]=i[0].replace(/\\/g,"/");var u=e=i.join(n);if(u=u.trim(),!r&&1===e.split("#").length){var f=c.exec(u);if(f)return this.path=u,this.href=u,this.pathname=f[1],f[2]?(this.search=f[2],this.query=t?_.parse(this.search.substr(1)):this.search.substr(1)):t&&(this.search="",this.query={}),this}var w=h.exec(u);if(w){var T=(w=w[0]).toLowerCase();this.protocol=T,u=u.substr(w.length)}if(r||w||u.match(/^\/\/[^@\/]+@[^@\/]+/)){var x="//"===u.substr(0,2);!x||w&&g[w]||(u=u.substr(2),this.slashes=!0)}if(!g[w]&&(x||w&&!b[w])){for(var C,R,A=-1,O=0;O<d.length;O++){-1!==(E=u.indexOf(d[O]))&&(-1===A||E<A)&&(A=E)}-1!==(R=-1===A?u.lastIndexOf("@"):u.lastIndexOf("@",A))&&(C=u.slice(0,R),u=u.slice(R+1),this.auth=decodeURIComponent(C)),A=-1;for(O=0;O<p.length;O++){var E;-1!==(E=u.indexOf(p[O]))&&(-1===A||E<A)&&(A=E)}-1===A&&(A=u.length),this.host=u.slice(0,A),u=u.slice(A),this.parseHost(),this.hostname=this.hostname||"";var q="["===this.hostname[0]&&"]"===this.hostname[this.hostname.length-1];if(!q)for(var k=this.hostname.split(/\./),S=(O=0,k.length);O<S;O++){var I=k[O];if(I&&!I.match(m)){for(var j="",P=0,H=I.length;P<H;P++)I.charCodeAt(P)>127?j+="x":j+=I[P];if(!j.match(m)){var M=k.slice(0,O),U=k.slice(O+1),N=I.match(y);N&&(M.push(N[1]),U.unshift(N[2])),U.length&&(u="/"+U.join(".")+u),this.hostname=M.join(".");break}}}this.hostname.length>255?this.hostname="":this.hostname=this.hostname.toLowerCase(),q||(this.hostname=s.toASCII(this.hostname));var L=this.port?":"+this.port:"",F=this.hostname||"";this.host=F+L,this.href+=this.host,q&&(this.hostname=this.hostname.substr(1,this.hostname.length-2),"/"!==u[0]&&(u="/"+u))}if(!v[T])for(O=0,S=l.length;O<S;O++){var D=l[O];if(-1!==u.indexOf(D)){var B=encodeURIComponent(D);B===D&&(B=escape(D)),u=u.split(D).join(B)}}var G=u.indexOf("#");-1!==G&&(this.hash=u.substr(G),u=u.slice(0,G));var X=u.indexOf("?");if(-1!==X?(this.search=u.substr(X),this.query=u.substr(X+1),t&&(this.query=_.parse(this.query)),u=u.slice(0,X)):t&&(this.search="",this.query={}),u&&(this.pathname=u),b[T]&&this.hostname&&!this.pathname&&(this.pathname="/"),this.pathname||this.search){L=this.pathname||"";var z=this.search||"";this.path=L+z}return this.href=this.format(),this},i.prototype.format=function(){var e=this.auth||"";e&&(e=(e=encodeURIComponent(e)).replace(/%3A/i,":"),e+="@");var t=this.protocol||"",r=this.pathname||"",o=this.hash||"",n=!1,s="";this.host?n=e+this.host:this.hostname&&(n=e+(-1===this.hostname.indexOf(":")?this.hostname:"["+this.hostname+"]"),this.port&&(n+=":"+this.port)),this.query&&a.isObject(this.query)&&Object.keys(this.query).length&&(s=_.stringify(this.query));var i=this.search||s&&"?"+s||"";return t&&":"!==t.substr(-1)&&(t+=":"),this.slashes||(!t||b[t])&&!1!==n?(n="//"+(n||""),r&&"/"!==r.charAt(0)&&(r="/"+r)):n||(n=""),o&&"#"!==o.charAt(0)&&(o="#"+o),i&&"?"!==i.charAt(0)&&(i="?"+i),t+n+(r=r.replace(/[?#]/g,(function(e){return encodeURIComponent(e)})))+(i=i.replace("#","%23"))+o},i.prototype.resolve=function(e){return this.resolveObject(w(e,!1,!0)).format()},i.prototype.resolveObject=function(e){if(a.isString(e)){var t=new i;t.parse(e,!1,!0),e=t}for(var r=new i,o=Object.keys(this),n=0;n<o.length;n++){var s=o[n];r[s]=this[s]}if(r.hash=e.hash,""===e.href)return r.href=r.format(),r;if(e.slashes&&!e.protocol){for(var h=Object.keys(e),u=0;u<h.length;u++){var c=h[u];"protocol"!==c&&(r[c]=e[c])}return b[r.protocol]&&r.hostname&&!r.pathname&&(r.path=r.pathname="/"),r.href=r.format(),r}if(e.protocol&&e.protocol!==r.protocol){if(!b[e.protocol]){for(var f=Object.keys(e),l=0;l<f.length;l++){var p=f[l];r[p]=e[p]}return r.href=r.format(),r}if(r.protocol=e.protocol,e.host||g[e.protocol])r.pathname=e.pathname;else{for(var d=(e.pathname||"").split("/");d.length&&!(e.host=d.shift()););e.host||(e.host=""),e.hostname||(e.hostname=""),""!==d[0]&&d.unshift(""),d.length<2&&d.unshift(""),r.pathname=d.join("/")}if(r.search=e.search,r.query=e.query,r.host=e.host||"",r.auth=e.auth,r.hostname=e.hostname||e.host,r.port=e.port,r.pathname||r.search){var m=r.pathname||"",y=r.search||"";r.path=m+y}return r.slashes=r.slashes||e.slashes,r.href=r.format(),r}var v=r.pathname&&"/"===r.pathname.charAt(0),_=e.host||e.pathname&&"/"===e.pathname.charAt(0),w=_||v||r.host&&e.pathname,T=w,x=r.pathname&&r.pathname.split("/")||[],C=(d=e.pathname&&e.pathname.split("/")||[],r.protocol&&!b[r.protocol]);if(C&&(r.hostname="",r.port=null,r.host&&(""===x[0]?x[0]=r.host:x.unshift(r.host)),r.host="",e.protocol&&(e.hostname=null,e.port=null,e.host&&(""===d[0]?d[0]=e.host:d.unshift(e.host)),e.host=null),w=w&&(""===d[0]||""===x[0])),_)r.host=e.host||""===e.host?e.host:r.host,r.hostname=e.hostname||""===e.hostname?e.hostname:r.hostname,r.search=e.search,r.query=e.query,x=d;else if(d.length)x||(x=[]),x.pop(),x=x.concat(d),r.search=e.search,r.query=e.query;else if(!a.isNullOrUndefined(e.search)){if(C)r.hostname=r.host=x.shift(),(q=!!(r.host&&r.host.indexOf("@")>0)&&r.host.split("@"))&&(r.auth=q.shift(),r.host=r.hostname=q.shift());return r.search=e.search,r.query=e.query,a.isNull(r.pathname)&&a.isNull(r.search)||(r.path=(r.pathname?r.pathname:"")+(r.search?r.search:"")),r.href=r.format(),r}if(!x.length)return r.pathname=null,r.search?r.path="/"+r.search:r.path=null,r.href=r.format(),r;for(var R=x.slice(-1)[0],A=(r.host||e.host||x.length>1)&&("."===R||".."===R)||""===R,O=0,E=x.length;E>=0;E--)"."===(R=x[E])?x.splice(E,1):".."===R?(x.splice(E,1),O++):O&&(x.splice(E,1),O--);if(!w&&!T)for(;O--;O)x.unshift("..");!w||""===x[0]||x[0]&&"/"===x[0].charAt(0)||x.unshift(""),A&&"/"!==x.join("/").substr(-1)&&x.push("");var q,k=""===x[0]||x[0]&&"/"===x[0].charAt(0);C&&(r.hostname=r.host=k?"":x.length?x.shift():"",(q=!!(r.host&&r.host.indexOf("@")>0)&&r.host.split("@"))&&(r.auth=q.shift(),r.host=r.hostname=q.shift()));return(w=w||r.host&&x.length)&&!k&&x.unshift(""),x.length?r.pathname=x.join("/"):(r.pathname=null,r.path=null),a.isNull(r.pathname)&&a.isNull(r.search)||(r.path=(r.pathname?r.pathname:"")+(r.search?r.search:"")),r.auth=e.auth||r.auth,r.slashes=r.slashes||e.slashes,r.href=r.format(),r},i.prototype.parseHost=function(){var e=this.host,t=u.exec(e);t&&(":"!==(t=t[0])&&(this.port=t.substr(1)),e=e.substr(0,e.length-t.length)),e&&(this.hostname=e)}})),r.register("567pR",(function(t,r){!function(o){var n=r&&!r.nodeType&&r,s=t&&!t.nodeType&&t,a="object"==typeof e&&e;a.global!==a&&a.window!==a&&a.self!==a||(o=a);var i,h,u=2147483647,c=36,f=/^xn--/,l=/[^\x20-\x7E]/,p=/[\x2E\u3002\uFF0E\uFF61]/g,d={overflow:"Overflow: input needs wider integers to process","not-basic":"Illegal input >= 0x80 (not a basic code point)","invalid-input":"Invalid input"},m=Math.floor,y=String.fromCharCode;function v(e){throw RangeError(d[e])}function g(e,t){for(var r=e.length,o=[];r--;)o[r]=t(e[r]);return o}function b(e,t){var r=e.split("@"),o="";return r.length>1&&(o=r[0]+"@",e=r[1]),o+g((e=e.replace(p,".")).split("."),t).join(".")}function _(e){for(var t,r,o=[],n=0,s=e.length;n<s;)(t=e.charCodeAt(n++))>=55296&&t<=56319&&n<s?56320==(64512&(r=e.charCodeAt(n++)))?o.push(((1023&t)<<10)+(1023&r)+65536):(o.push(t),n--):o.push(t);return o}function w(e){return g(e,(function(e){var t="";return e>65535&&(t+=y((e-=65536)>>>10&1023|55296),e=56320|1023&e),t+=y(e)})).join("")}function T(e,t){return e+22+75*(e<26)-((0!=t)<<5)}function x(e,t,r){var o=0;for(e=r?m(e/700):e>>1,e+=m(e/t);e>455;o+=c)e=m(e/35);return m(o+36*e/(e+38))}function C(e){var t,r,o,n,s,a,i,h,f,l,p,d=[],y=e.length,g=0,b=128,_=72;for((r=e.lastIndexOf("-"))<0&&(r=0),o=0;o<r;++o)e.charCodeAt(o)>=128&&v("not-basic"),d.push(e.charCodeAt(o));for(n=r>0?r+1:0;n<y;){for(s=g,a=1,i=c;n>=y&&v("invalid-input"),((h=(p=e.charCodeAt(n++))-48<10?p-22:p-65<26?p-65:p-97<26?p-97:c)>=c||h>m((u-g)/a))&&v("overflow"),g+=h*a,!(h<(f=i<=_?1:i>=_+26?26:i-_));i+=c)a>m(u/(l=c-f))&&v("overflow"),a*=l;_=x(g-s,t=d.length+1,0==s),m(g/t)>u-b&&v("overflow"),b+=m(g/t),g%=t,d.splice(g++,0,b)}return w(d)}function R(e){var t,r,o,n,s,a,i,h,f,l,p,d,g,b,w,C=[];for(d=(e=_(e)).length,t=128,r=0,s=72,a=0;a<d;++a)(p=e[a])<128&&C.push(y(p));for(o=n=C.length,n&&C.push("-");o<d;){for(i=u,a=0;a<d;++a)(p=e[a])>=t&&p<i&&(i=p);for(i-t>m((u-r)/(g=o+1))&&v("overflow"),r+=(i-t)*g,t=i,a=0;a<d;++a)if((p=e[a])<t&&++r>u&&v("overflow"),p==t){for(h=r,f=c;!(h<(l=f<=s?1:f>=s+26?26:f-s));f+=c)w=h-l,b=c-l,C.push(y(T(l+w%b,0))),h=m(w/b);C.push(y(T(h,0))),s=x(r,g,o==n),r=0,++o}++r,++t}return C.join("")}if(i={version:"1.3.2",ucs2:{decode:_,encode:w},decode:C,encode:R,toASCII:function(e){return b(e,(function(e){return l.test(e)?"xn--"+R(e):e}))},toUnicode:function(e){return b(e,(function(e){return f.test(e)?C(e.slice(4).toLowerCase()):e}))}},"function"==typeof define&&"object"==typeof define.amd&&define.amd)define("punycode",(function(){return i}));else if(n&&s)if(t.exports==n)s.exports=i;else for(h in i)i.hasOwnProperty(h)&&(n[h]=i[h]);else o.punycode=i}(this)})),r.register("h69nw",(function(e,t){e.exports={isString:function(e){return"string"==typeof e},isObject:function(e){return"object"==typeof e&&null!==e},isNull:function(e){return null===e},isNullOrUndefined:function(e){return null==e}}})),r.register("1Xhaw",(function(e,o){var n,s;t(e.exports,"parse",(function(){return n}),(function(e){return n=e})),t(e.exports,"stringify",(function(){return s}),(function(e){return s=e})),n=r("H6lrw"),s=r("kBeMc")})),r.register("H6lrw",(function(e,t){function r(e,t){return Object.prototype.hasOwnProperty.call(e,t)}e.exports=function(e,t,n,s){t=t||"&",n=n||"=";var a={};if("string"!=typeof e||0===e.length)return a;var i=/\+/g;e=e.split(t);var h=1e3;s&&"number"==typeof s.maxKeys&&(h=s.maxKeys);var u=e.length;h>0&&u>h&&(u=h);for(var c=0;c<u;++c){var f,l,p,d,m=e[c].replace(i,"%20"),y=m.indexOf(n);y>=0?(f=m.substr(0,y),l=m.substr(y+1)):(f=m,l=""),p=decodeURIComponent(f),d=decodeURIComponent(l),r(a,p)?o(a[p])?a[p].push(d):a[p]=[a[p],d]:a[p]=d}return a};var o=Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)}})),r.register("kBeMc",(function(e,t){var r=function(e){switch(typeof e){case"string":return e;case"boolean":return e?"true":"false";case"number":return isFinite(e)?e:"";default:return""}};e.exports=function(e,t,a,i){return t=t||"&",a=a||"=",null===e&&(e=void 0),"object"==typeof e?n(s(e),(function(s){var i=encodeURIComponent(r(s))+a;return o(e[s])?n(e[s],(function(e){return i+encodeURIComponent(r(e))})).join(t):i+encodeURIComponent(r(e[s]))})).join(t):i?encodeURIComponent(r(i))+a+encodeURIComponent(r(e)):""};var o=Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)};function n(e,t){if(e.map)return e.map(t);for(var r=[],o=0;o<e.length;o++)r.push(t(e[o],o));return r}var s=Object.keys||function(e){var t=[];for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.push(r);return t}})),r.register("bupd9",(function(e,t){var o=r("9LxR1"),n=r("47FnH"),s=e.exports;for(var a in o)o.hasOwnProperty(a)&&(s[a]=o[a]);function i(e){if("string"==typeof e&&(e=n.parse(e)),e.protocol||(e.protocol="https:"),"https:"!==e.protocol)throw new Error('Protocol "'+e.protocol+'" not supported. Expected "https:"');return e}s.request=function(e,t){return e=i(e),o.request.call(this,e,t)},s.get=function(e,t){return e=i(e),o.get.call(this,e,t)}}));
//# sourceMappingURL=fetch.e236ee7d.js.map