import { connect, ConnectedWalletAccount, keyStores, WalletConnection } from "near-api-js";
import { ENV, getConfig } from "./config";
import { getPoolList } from "./entities/poolList";
import { PoolParams } from "./entities/poolParams";
import { qs } from "./util/document";
import { disconnectedWallet } from "./wallet-api/disconnected-wallet";
import { NearWebWallet } from "./wallet-api/near-web-wallet/near-web-wallet";
import { WalletInterface } from "./wallet-api/wallet-interface";

export let nearConfig = getConfig(ENV);

export let wallet: WalletInterface = disconnectedWallet;


let nearWebWalletConnection: WalletConnection;
let nearConnectedWalletAccount: ConnectedWalletAccount;

let poolContainer = qs("#generic-pool-container")! as HTMLElement;
let showAndHideVisibilityTool = qs("#generic-pool-container .visual-tool-expanding-indication-hidden")! as HTMLElement;
let infoIcon = qs("#new-token-header .information-icon-container")! as HTMLElement;
let poolStats = qs("#token-pool-stats")! as HTMLElement;
let expandPoolButton = qs("#generic-pool-container .expand-button")! as HTMLElement;
let hidePoolButton = qs("#generic-pool-container .hide-button")! as HTMLElement;
let stakingUnstakingContainer = qs("#generic-pool-container #staking-unstaking-container")! as HTMLElement;
let stakingButton = qs("#generic-pool-container .staking")! as HTMLElement;
let unstakingButton = qs("#generic-pool-container .unstaking")! as HTMLElement;
let staking = qs("#generic-pool-container .main-staking")! as HTMLElement;
let unstaking = qs("#generic-pool-container .main-unstaking")! as HTMLElement;

poolContainer.addEventListener("mouseover", showOrHideElement(showAndHideVisibilityTool));
poolContainer.addEventListener("mouseout", showOrHideElement(showAndHideVisibilityTool));

infoIcon.addEventListener("mouseover", showOrHideElement(poolStats));
infoIcon.addEventListener("mouseout", showOrHideElement(poolStats));

expandPoolButton.addEventListener("click", showOrHideElement(expandPoolButton));
expandPoolButton.addEventListener("click", showOrHideElement(hidePoolButton));
expandPoolButton.addEventListener("click", showOrHideElement(stakingUnstakingContainer));

hidePoolButton.addEventListener("click", showOrHideElement(expandPoolButton));
hidePoolButton.addEventListener("click", showOrHideElement(hidePoolButton));
hidePoolButton.addEventListener("click", showOrHideElement(stakingUnstakingContainer));

stakingButton.addEventListener("click", showElementHideAnother(staking, unstaking));
stakingButton.addEventListener("click", setActiveColor);
stakingButton.addEventListener("click", cancelActiveColor(unstakingButton));

unstakingButton.addEventListener("click", showElementHideAnother(unstaking, staking));
unstakingButton.addEventListener("click", setActiveColor);
unstakingButton.addEventListener("click", cancelActiveColor(stakingButton));

function showOrHideElement(elementToShow: HTMLElement){
    return function (event: Event){
        event.preventDefault();
        elementToShow.classList.toggle("hidden");
    }
}

function showElementHideAnother(elementToShow: HTMLElement, elementToHide: HTMLElement){
    return function (event : Event){
        event.preventDefault();
        elementToShow.classList.remove("hidden");
        elementToHide.classList.add("hidden");
    }
}

function setActiveColor(event : Event){
    let element = event.target as HTMLElement
    element.classList.add("active");
}

function cancelActiveColor(elementToDisplayAsNotActive: HTMLElement){
    return function(event : Event){
        event.preventDefault();
        elementToDisplayAsNotActive.classList.remove("active");
    }
}

async function initNearWebWalletConnection() {
    // Initialize connection to the NEAR network
    const near = await connect(Object.assign({ deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } }, nearConfig.farms[0]))
    // Initializing Wallet based Account.
    nearWebWalletConnection = new WalletConnection(near, null)
    nearConnectedWalletAccount = new ConnectedWalletAccount(nearWebWalletConnection, near.connection, nearWebWalletConnection.getAccountId())
    //console.log(nearConnectedWalletAccount)
}

async function refreshPoolInfo(poolParams: PoolParams) {
    qs(".user-info #account-id").innerText = poolParams.resultParams.getDisplayableAccountName();
}

async function refreshAccountInfoGeneric(poolList: Array<PoolParams>) {
  poolList.forEach(poolParams => {
    refreshPoolInfo(poolParams)
  });
}

// Displaying the signed in flow container and fill in account-specific data
async function signedInFlow(wallet: WalletInterface) {
//   showSection("#home-connected")
//   selectNav("#home")
//   takeUserAmountFromHome()
  const poolList = await getPoolList(wallet)
  await refreshAccountInfoGeneric(poolList)
//   await addPoolList(poolList)
}

window.onload = async function () {
    await initNearWebWalletConnection()
    if (nearWebWalletConnection.isSignedIn()) {
        wallet = new NearWebWallet(nearWebWalletConnection);
      
        await signedInFlow(wallet)
        accountName = wallet.getAccountId()
    }
}