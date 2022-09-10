// document.querySelector shortcuts
// qs => document.querySelector ->  HTMLElement
export function qs(selector:string){ return document.querySelector(selector) as HTMLElement}
// qsi => document.querySelector ->  HTMLInputElement
export function qsi(selector:string){ return document.querySelector(selector) as HTMLInputElement}
// qsa => document.querySelectorAll ->  NodeListOf<Element>
export function qsa(selector:string){ return document.querySelectorAll(selector)}

///set innerText for all matching HTMLElements
export function qsaInnerText(selector:string, innerText:string){ 
    document.querySelectorAll(selector).forEach(e=> {
        if (e instanceof HTMLElement) e.innerText = innerText;
    });
}

///set innerText for all matching HTMLElements
export function qsaAttribute(selector:string, attributeKey: string, attributeValue:string){ 
    document.querySelectorAll(selector).forEach(e=> {
        if (e instanceof HTMLElement) e.setAttribute(attributeKey, attributeValue)
    });
}

///set innerText for first matching HTMLElement
export function qsInnerText(selector:string, innerText:string){ 
    document.querySelector(selector)!.innerHTML = innerText
}


export function show(el:Element, onOff:boolean=true){
    (el as HTMLElement).style.display= (onOff?"":"none");
}
export function hide(el:Element){
    (el as HTMLElement).style.display="none";
}

export function showPopup(selector:string, msg?:string, title?:string){
    cancelWait=true;
    const el = qs(selector);
    const overlay:HTMLElement = qs("#overlay1");
    //hide all
    overlay.querySelectorAll(".box.popup").forEach( hide )
    //show required
    //get children by id
    const titleElem = el.querySelector("#title") as HTMLElement
    const msgElem= el.querySelector("#msg") as HTMLElement
    if (msgElem && msg) msgElem.innerHTML=msg;
    if (titleElem && title) titleElem.innerText=title;
    show(el);
    //show overlay
    show(overlay);
}
export function hidePopup(selector:string){
    hide(qs(selector));
}
export function hideOverlay(){
    cancelWait=true;
    hide(qs("#overlay1"));
}

let waitStartTimer:any;
let cancelWait:boolean=false;
export function showWait(msg?:string, title?:string){
    cancelWait=false;
    waitStartTimer = setTimeout(() => {
        if (!cancelWait) showPopup("#wait-box",msg,title);
    }, 500);
}
export function hideWaitKeepOverlay(){
    cancelWait=true;
    if (waitStartTimer){
        clearTimeout(waitStartTimer);
        waitStartTimer=undefined;
    }
    hidePopup("#wait-box");
}

export function showMessage(msg:string,title?:string){
    showPopup("#message-box",msg,title);
}
export function showSuccess(msg:string,title?:string){
    console.log(msg + " " + title)
    showPopup("#success-box",msg,title);
}

export function showError(msg:string,title?:string){
    title = (msg == "Error from wallet: userRejected") ? "Transaction Rejected" : title
    showPopup("#error-box",msg,title);
}
export function showErr(ex:Error){
    console.log(ex)
    showError(ex.message);
}

