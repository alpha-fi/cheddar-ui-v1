import { connect, Contract, keyStores, Near, WalletConnection } from 'near-api-js'
import { CHEDDAR_CONTRACT_NAME, getConfig } from './config'

import { WalletInterface } from './wallet-api/wallet-interface';
import { disconnectedWallet } from './wallet-api/disconnected-wallet';
import { NearWebWallet } from './wallet-api/near-web-wallet/near-web-wallet';
import { narwallets, addNarwalletsListeners } from './wallet-api/narwallets/narwallets';
import { toNumber, ntoy, yton, toStringDec, toStringDecLong, toStringDecMin, ytonFull, addCommas, convertToDecimals, removeDecZeroes, convertToBase } from './util/conversions';

import { StakingPoolP1 } from './contracts/p2-staking';
import type { ContractParams, TokenParams } from './contracts/contract-structs';

//qs/qsa are shortcut for document.querySelector/All
import { qs, qsa, qsi, showWait, hideWaitKeepOverlay, showErr, showSuccess, showMessage, show, hide, hidePopup, hideOverlay, qsaInnerText, showError, showPopup, qsInnerText } from './util/document';
import { checkRedirectSearchParams } from './wallet-api/near-web-wallet/checkRedirectSearchParams';
import { computeCurrentEpoch, EpochInfo } from './util/near-epoch';
import { NEP141Trait } from './contracts/NEP141';
import { InvalidSignature } from 'near-api-js/lib/generated/rpc_error_types';
import { PoolParams } from './entities/poolParams';
import { getPoolList } from './entities/poolList';
import { stake } from 'near-api-js/lib/transaction';

//get global config
//const nearConfig = getConfig(process.env.NODE_ENV || 'development')
export let nearConfig = getConfig('testnet'); //default testnet, can change according to URL on window.onload

// global variables used throughout
export let wallet: WalletInterface = disconnectedWallet;

let nearWebWalletConnection: WalletConnection;
let accountName;

//time in ms
const SECONDS = 1000
const MINUTES = 60 * SECONDS
const HOURS = 60 * MINUTES

const ONE_NEAR = BigInt(10) ** BigInt(24);
//------------------------------
//--- connect buttons->code ----
//------------------------------

//all popup "cancel" buttons
qsa('.popup button#cancel').forEach(f => (f as HTMLButtonElement).onclick = (event) => { event.preventDefault(); hideOverlay() })

//connect wallet selection boxes
qs('#near-web-wallet-box').onclick = loginNearWebWallet
qs('#narwallets-wallet-box').onclick = loginNarwallets
//connect Sign-out link
//qs('#sign-out-button').onclick = logoutNearWebWallet

//nav my-account "home"
qs('nav #home').onclick =
  async function (event) {
    event.preventDefault()
    if (wallet.isConnected()) {
      showSection("#home-connected")
      selectNav("#home")
    }
    else {
      signedOutFlow();
    }
  }

qs('#logo').onclick =
  async function (event) {
    event.preventDefault()
    if (wallet.isConnected()) {
      signedInFlow(wallet)
    }
    else {
      signedOutFlow();
    }
  }

//generic nav handler
function navClickHandler_ConnectFirst(event: Event) {
  event.preventDefault()
  if (wallet.isConnected()) {
    //show section with same id as the <anchor> link
    showSection("#" + (event.target as HTMLElement).closest("a")?.id)
  }
  else {
    showSection("#home")
    sayChoose()
  }
}

qs('nav #unstake-m').onclick = navClickHandler_ConnectFirst
qs('nav #liquidity').onclick = navClickHandler_ConnectFirst
//qs('nav #delayed-unstake').onclick = navClickHandler_ConnectFirst
qs('nav #my-account').onclick = navClickHandler_ConnectFirst

//qs('#unstake-from-my-account').onclick = () => { showSection("#unstake") }

qs('nav #faq').onclick = () => { showSection("#faq") }

function sayChoose() {
  showMessage("Please choose a wallet to connect", "Connect first");
}

//button connect
qs('#stake-form-not-connected').onsubmit =
  async function (event) {
    event.preventDefault()
    sayChoose();
  }


//button sign-out
qs('#sign-out').onclick =
  async function (event) {
    event.preventDefault()
    wallet.disconnect();
    wallet = disconnectedWallet;

    signedOutFlow();
  }

function stakeClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function(event: Event) {
    event.preventDefault()

    submitForm("stake", poolParams, pool.getElementsByTagName("form")[0])
  }  
}

function unstakeClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function(event: Event) {
    event.preventDefault()

    submitForm("unstake", poolParams, pool.getElementsByTagName("form")[0])
  }  
}

function harvestClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function(event: Event) {
    event.preventDefault()
    console.log("PoolParmas: ", poolParams)
    submitForm("harvest", poolParams, pool.getElementsByTagName("form")[0])
  }  
}

function depositClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function (event) {
    event.preventDefault()
    let storageDeposit = await poolParams.contract.storageDeposit();
    pool.querySelector("#deposit")!.style.display = "block"
    pool.querySelector("#activated")!.style.display = "none"
  }
}

//Form submission
async function submitForm(action: string, poolParams: PoolParams, form: HTMLFormElement) {
  event?.preventDefault()

  //const form = event.target as HTMLFormElement
  // get elements from the form using their id attribute
  const { fieldset, stakeAmount } = form
  console.log("Stake amount: " , stakeAmount)
  //const fieldset = form.querySelector("#fieldset") as HTMLFormElement

  // disable the form while the call is made
  fieldset.disabled = true
  const isStaking = (action == "stake")
  const isHarvest = (action == "harvest")
  showWait(isStaking ? "Staking..." : isHarvest ? "Harvesting..." : "Unstaking...")

  try {
    const contractParams = poolParams.contractParams
    let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
    const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
    //get amount
    const min_deposit_amount = 1;
    if(isNaN(stakeAmount.value)) {
      throw Error("Please Input a Number.")
    }
    let amount: number = stakeAmount.value;
    
    if (isStaking) {
      if (!isDateInRange) throw Error("Pools is Closed.")
      //if (amount < min_deposit_amount) throw Error(`Stake at least ${min_deposit_amount} ${poolParams.metaData.symbol}`);
      const walletAvailable = await poolParams.getWalletAvailable()
      if(amount > walletAvailable) throw Error(`Only ${walletAvailable} ${poolParams.metaData.symbol} Available to Stake.`);
      await poolParams.tokenContract.ft_transfer_call(poolParams.contract.contractId, convertToBase(stakeAmount.value, poolParams.metaData.decimals.toString()), "to farm")
    }
    else if (isHarvest) {
      
      amount = poolParams.resultParams.getCurrentCheddarRewards()
      if (amount <= 0) throw Error("No Cheddar to Harvest. 😞")
      await poolParams.contract.withdraw_crop()
    }
    else {
      console.log(amount.toString())
      console.log("Decimal: ", poolParams.metaData.decimals)
      if (amount <= 0) throw Error(`Unstake a Positive Amount.`);
      const staked = poolParams.resultParams.staked
      const stakedDisplayable = Number(convertToDecimals(staked.toString(), poolParams.metaData.decimals, 5))
      //if(amount > stakedDisplayable) throw Error(`Stake at most ${stakedDisplayable} ${poolParams.metaData.symbol}`);
      if(amount > stakedDisplayable) throw Error(`No ${poolParams.metaData.symbol} Staked.`);
      // amount = 1000000000000000000000000
      await poolParams.contract.unstake(convertToBase(amount.toString(), poolParams.metaData.decimals.toString()))
    }

    //clear form
    form.reset()

    //refresh acc info
    // const poolList = await getPoolList(wallet);
    await refreshPoolInfo(poolParams)
    console.log("Amount: ", amount)
    showSuccess((isStaking ? "Staked " : isHarvest ? "Harvested " : "Unstaked ") + toStringDecMin(amount) + (isHarvest ? " CHEDDAR" : " " + poolParams.metaData.symbol))
    
    if (isHarvest) {
      poolParams.resultParams.computed = 1n
      poolParams.resultParams.real = 1n
      qsInnerText("#" + poolParams.html.id + " #cheddar-balance", "0")

    }
    else if (isStaking) {
      poolParams.resultParams.addStaked(ntoy(amount));
    }
    else {
      poolParams.resultParams.addStaked(ntoy(-amount));
    }

  }
  catch (ex) {
    showErr(ex)
  }

  // re-enable the form, whether the call succeeded or failed
  fieldset.disabled = false
}

function termsOfUseListener() {
  return async function (event: Event) {
    event.preventDefault()
    showPopup("#terms.popup")
  }
}

function showUnstakeResult(unstaked: number) {
  showSuccess(
    `<div class="stat-line"> <dt>Unstaked</dt><dd>${toStringDec(unstaked)}</dd> </div>`
    , "Unstake"
  )
}

function showRemoveLiquidityResult(yoctoCheddar: string) {
  showSuccess(
    `<div class="stat-line"> <dt>cheddar received</dt><dd>${toStringDec(yton(yoctoCheddar))}</dd> </div>`
    , "Withdraw crop"
  )
}

//compute epoch info
let epochCached: EpochInfo;
let endOfEpochCached = new Date();
let epochDurationMs = 12 * HOURS;
async function endOfEpoch(): Promise<Date> {
  if (new Date() >= endOfEpochCached && wallet.isConnected()) {
    try {
      epochCached = await computeCurrentEpoch(wallet);
      endOfEpochCached = new Date(epochCached.ends_dtm);
      epochDurationMs = epochCached.duration_ms;
    }
    catch (ex) {
      showErr(ex);
      return new Date(new Date().getTime() - 12 * HOURS);
    }
  }
  return endOfEpochCached;
}

//--------------------------------------
// AutoRefresh
async function autoRefresh() {
  if (wallet && wallet.isConnected()) {
    try {
      await refreshPoolInfo()
    }
    catch (ex) {
      //console.log("auto-refresh: " + ex.message)
    }
  }
}

//--------------------------------------
function showSection(selector: string) {
  //hide all sections
  qsa("main section").forEach(hide);
  //show section
  const section = qs("main").querySelector(selector)
  if (section) {
    show(section)
    selectNav(selector);
  }
}
function selectNav(selector: string) {
  //nav
  const allNav = qsa("nav a");
  allNav.forEach(e => (e as HTMLElement).classList.remove("selected"))
  qs("nav").querySelector(selector)?.classList.add("selected")
}

//after connecting, preserve the amount the user typed on home screen
function takeUserAmountFromHome(): string {
  let result = "";
  try {
    //move amount typed while not-connected
    const notConnectedStakeInput = qsi("#stake-form-not-connected input.near")
    result = notConnectedStakeInput.value;
    //check also local storage
    if (!result) result = localStorage.getItem("amount") || ""
    if (result) {
      qsi("#stake input.near").value = result
      notConnectedStakeInput.value = "" //clear.- move only once
      localStorage.removeItem("amount")
    }
  }
  catch (ex) {
    //ignore
  }
  return result;
}

// Display the signed-out-flow container
async function signedOutFlow() {
  showSection("#home")
  // await refreshAccountInfo();
}

// Displaying the signed in flow container and fill in account-specific data
async function signedInFlow(wallet: WalletInterface) {
  showSection("#home-connected")
  selectNav("#home")
  takeUserAmountFromHome()
  const poolList = await getPoolList(wallet);
  await refreshAccountInfoGeneric(poolList);
  await addPoolList(poolList)
}



// Initialize contract & set global variables
async function initNearWebWalletConnection() {
  // Initialize connection to the NEAR testnet
  const near = await connect(Object.assign({ deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } }, nearConfig.farms[0]))

  // Initializing Wallet based Account. It can work with NEAR testnet wallet that
  // is hosted at https://wallet.testnet.near.org
  nearWebWalletConnection = new WalletConnection(near, null)
}

function logoutNearWebWallet() {

  nearWebWalletConnection.signOut()
  wallet = disconnectedWallet

  // reload page
  window.location.replace(window.location.origin + window.location.pathname)
}

function loginNearWebWallet() {
  // Allow the current app to make calls to the specified contract on the user's behalf.
  // This works by creating a new access key for the user's account and storing
  // the private key in localStorage.
  //save what the user typed before navigating out
  localStorage.setItem("amount", qsi("#stake-form-not-connected input.near").value)
  nearWebWalletConnection.requestSignIn(nearConfig.farms[0].contractName)
}

function loginNarwallets() {
  //login is initiated from the chrome-extension
  //show step-by-step instructions
  window.open("http://www.narwallets.com/help/connect-to-web-app")
}

/**
 * Gets the actual values from the contract and replaces the computed values on the UI (and on the corresponding 
 * object) if it's greater than 4 times
 * @param poolParams 
 */
async function refreshRealRewardsLoopGeneric(poolParams: PoolParams, decimals: number) {

  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  let contractParams = poolParams.contractParams
  let isOpened = (contractParams.is_active && unixTimestamp >= contractParams.farming_start && unixTimestamp <= contractParams.farming_end);
  let accName = poolParams.resultParams.accName
  
  try {

    if (isOpened && wallet.isConnected()) {

      let accountInfo = await poolParams.contract.status(accName)
      poolParams.setStatus(accountInfo)
      
      let stakedWithDecimals = convertToDecimals(poolParams.resultParams.staked.toString(), poolParams.metaData.decimals, 2)
      const walletAvailable = await poolParams.getWalletAvailable()
      let real = poolParams.resultParams.real
      let computed = poolParams.resultParams.computed
      
      if (convertToDecimals(poolParams.resultParams.staked.toString(), decimals, 2) > 0) {
        qs("#" + poolParams.html.id + " #near-balance a .max").style.display = "block";
        if (poolParams.resultParams.previous_timestamp && real > poolParams.resultParams.previous_real) {
          poolParams.setTotalRewardsPerDay()
          // console.log("New rewards_per_day: ", poolParams.resultParams.real_rewards_per_day)
        }
      }
      
      poolParams.resultParams.previous_real = poolParams.resultParams.real;
      poolParams.resultParams.real = real;
      // poolParams.resultParams.previous_timestamp = now
      if (real > computed || (real > 0 && computed - real > real / 2n)) { //if real is bigger or differ is >25%
        poolParams.resultParams.computed = real
      }
      
      qsInnerText("#" + poolParams.html.id + " #near-balance span.near.balance", stakedWithDecimals)
      qsaInnerText("#" + poolParams.html.id + " #wallet-available span.near.balance", removeDecZeroes(walletAvailable.toString()))
      qsInnerText("#" + poolParams.html.id + " #cheddar-balance", poolParams.resultParams.getDisplayableComputed())
    }
  } catch (ex) {
    console.error(ex);
  }
  
}

async function refreshRewardsDisplayLoopGeneric(poolParams: PoolParams, decimals: number) {

  
  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened = (poolParams.contractParams.is_active && unixTimestamp >= poolParams.contractParams.farming_start && unixTimestamp <= poolParams.contractParams.farming_end);
  try {
    if (isOpened && wallet.isConnected()) {
      let previousTimestamp = poolParams.resultParams.previous_timestamp;
      let elapsed_ms = Date.now() - previousTimestamp

      if (convertToDecimals(poolParams.resultParams.staked.toString(), decimals, 2) > 0) {
        
        var rewards = (poolParams.resultParams.real_rewards_per_day / BigInt(10 ** 5) * BigInt(elapsed_ms) / (BigInt(1000 * 60 * 60 * 24)));
        poolParams.resultParams.computed = poolParams.resultParams.real + rewards

        qsInnerText("#" + poolParams.html.id + " #cheddar-balance", poolParams.resultParams.getDisplayableComputed());
      }
    }
  } catch (ex) {
    console.error(ex);
  }
}

async function refreshPoolInfo(poolParams: PoolParams) {
  poolParams.resultParams.accName = poolParams.contract.wallet.getAccountId();
  var metaData = poolParams.metaData;
  let accName = poolParams.resultParams.accName
  // Modify this so it's done only once
  qs(".user-info #account-id").innerText = poolParams.resultParams.getDisplayableAccountName();
  //show top-right-balance only if connected wallet
  //show(qs("#top-right-balance"), wallet.isConnected())

  let accountInfo = await poolParams.contract.status(accName)
  let staked = BigInt(accountInfo[0]);
  let displayableStaked = convertToDecimals(staked.toString(), metaData.decimals, 2)
  qsaInnerText("#" + poolParams.html.id + " #near-balance span.near.balance", displayableStaked)

  const walletAvailable = await poolParams.getWalletAvailable()
  qsaInnerText("#" + poolParams.html.id + " #wallet-available span.near.balance", removeDecZeroes(walletAvailable.toString()))
  
  //update account & contract stats
  if (wallet.isConnected()) {
    let metaData = await poolParams.metaData;
    
    let contractParams = await poolParams.contract.get_contract_params()

    const rewardsPerDay = BigInt(contractParams.farming_rate) * BigInt(60 * 24)
    if(qs("#" + poolParams.html.id + " #pool-stats #total-staked")) {
      qs("#" + poolParams.html.id + " #pool-stats #total-staked").innerText = convertToDecimals(contractParams.total_staked, metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
      qs("#" + poolParams.html.id + " #pool-stats #rewards-per-day").innerText = yton(rewardsPerDay.toString()).toString()
      qs("#" + poolParams.html.id + " #pool-stats #total-rewards").innerText = convertToDecimals(contractParams.total_farmed, metaData.decimals, 5);
    }

  }
  else {
    poolParams.contractParams.rewards_per_day = 10n;
  }
}

async function refreshAccountInfoGeneric(poolList: Array<PoolParams>) {
  poolList.forEach(poolParams => {
    refreshPoolInfo(poolParams)
  });
}

/// when the user chooses "connect to web-page" in the narwallets-chrome-extension
function narwalletConnected(ev: CustomEvent) {
  wallet = narwallets;

  signedInFlow(wallet)
}

/// when the user chooses "disconnect from web-page" in the narwallets-chrome-extension
function narwalletDisconnected(ev: CustomEvent) {

  wallet = disconnectedWallet;

  signedOutFlow()
}

async function addPool(poolParams: PoolParams): Promise<void> {
  var genericPoolElement = qs("#genericPool") as HTMLElement;
  let accName = poolParams.resultParams.accName
  var metaData = poolParams.metaData;
  var contractParams = poolParams.contractParams;
  var accountInfo = await poolParams.contract.status(accName);
  poolParams.resultParams.staked = BigInt(accountInfo[0])
  poolParams.resultParams.real = BigInt(accountInfo[1])
  poolParams.resultParams.previous_real = BigInt(accountInfo[1])
  poolParams.resultParams.computed = BigInt(accountInfo[1])
  poolParams.resultParams.previous_timestamp = Number(accountInfo[2])

  var newPool = genericPoolElement.cloneNode(true) as HTMLElement; 
  newPool.setAttribute("id", poolParams.html.id);
  newPool.setAttribute("style", "");
  newPool.querySelector("form")?.setAttribute("id", poolParams.html.formId);
  newPool.querySelector("#token-header span.name")!.innerHTML = metaData.name;
  newPool.querySelector(".pool-meta #percetage")!.innerHTML = contractParams.fee_rate/100 + "%"

  let iconElem = newPool.querySelector("#token-header img")
  if(metaData.icon != null) {
    iconElem!.setAttribute("src", metaData.icon || "");
  } else {
    var iconImage = document.createElement('span');
    iconImage.classList.add('icon');

    iconElem?.parentNode?.replaceChild(iconImage, iconElem);
  }

  newPool.querySelectorAll(".token-name").forEach(element => {
    element.innerHTML = metaData.symbol
  })

  // newPool.querySelectorAll("#" + poolParams.html.formId +  " .token-name")!.innerHTML = metaData.symbol;
  newPool.querySelector("#farming_start")!.innerHTML = new Date(contractParams.farming_start * 1000).toLocaleString()
  newPool.querySelector("#farming_end")!.innerHTML = new Date(contractParams.farming_end * 1000).toLocaleString()

  const stakedDisplayable = convertToDecimals(poolParams.resultParams.staked.toString(), metaData.decimals, 2)
  newPool.querySelector("#near-balance span.near.balance")!.innerHTML = stakedDisplayable

  if(Number(stakedDisplayable) > 0) {
    let elem = newPool.querySelector("#near-balance a .max") as HTMLElement
    elem.style.display = "block";

    elem.addEventListener("click", maxUnstakeClicked(newPool))
  }

  let humanReadableRealRewards = yton(poolParams.resultParams.real.toString()).toString()
  newPool.querySelector("#cheddar-balance")!.innerHTML = convertToDecimals(humanReadableRealRewards, metaData.decimals, 7);

  const walletAvailable = await poolParams.getWalletAvailable()
  //update shown wallet balance
  
  newPool.querySelector("#wallet-available span.near.balance")!.innerHTML = removeDecZeroes(walletAvailable.toString());
  // newPool.querySelector("span.bold.large.near#wallet-available")!.innerHTML = walletAvailable;

  if (Number(walletAvailable.toString().replace(".", "")) > 1) {
    let elem = newPool.querySelector("#wallet-available a .max") as HTMLElement
    elem.style.display = "block";

    elem.addEventListener("click", maxStakeClicked(newPool))
  }

  newPool.querySelector("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_staked, metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
  const rewardsPerDay = BigInt(contractParams.farming_rate) * BigInt(60 * 24)
  newPool.querySelector("#pool-stats #rewards-per-day")!.innerHTML = yton(rewardsPerDay.toString()).toString();
  // newPool.querySelector("#pool-stats #total-rewards")!.innerHTML = yton(contractParams.total_farmed).toString();
  newPool.querySelector("#pool-stats #total-rewards")!.innerHTML = convertToDecimals(contractParams.total_farmed, metaData.decimals, 5)
  

  let accountRegistered = await poolParams.contract.storageBalance();

  if(accountRegistered == null) {
    newPool.querySelector("#deposit")!.style.display = "block"
    newPool.querySelector("#activated")!.style.display = "none"
    newPool.querySelector(".activate")?.addEventListener("click", depositClicked(poolParams, newPool));
  }
  else{
    newPool.querySelector("#deposit")!.style.display = "none"
    newPool.querySelector("#activated")!.style.display = "block"
    newPool.querySelector("#harvest")?.addEventListener("click", harvestClicked(poolParams, newPool));
    newPool.querySelector("#stake")?.addEventListener("click", stakeClicked(poolParams, newPool));
    newPool.querySelector("#unstake")?.addEventListener("click", unstakeClicked(poolParams, newPool));
  }


  newPool.querySelector("#terms-of-use")?.addEventListener("click", termsOfUseListener())

  qs("#pool_list").append(newPool);

  poolParams.setTotalRewardsPerDay()
  setInterval(refreshRewardsDisplayLoopGeneric.bind(null, poolParams, metaData.decimals), 200);
  setInterval(refreshRealRewardsLoopGeneric.bind(null, poolParams, metaData.decimals), 60 * 1000);
}

function maxStakeClicked(pool: HTMLElement) {
  return function(event: Event) {
    event.preventDefault()
    const amonutContainer = pool.querySelector("#wallet-available .near.balance")
    if(amonutContainer) {
      const amount = amonutContainer.innerHTML
      let input = pool.querySelector("#stakeAmount") as HTMLInputElement
      input.value = amount.toString()
    }
  }
}

function maxUnstakeClicked(pool: HTMLElement) {
  return function(event: Event) {
    event.preventDefault()
    const amountContainer = pool.querySelector("#near-balance .near.balance")
    if(amountContainer) {
      const amount = amountContainer.innerHTML
      let input = pool.querySelector("#stakeAmount") as HTMLInputElement
      input.value = amount.toString()
    }
  }
}

async function addPoolList(poolList: Array<PoolParams>) {
  qs("#pool_list").innerHTML = ""
  for(let i = 0; i < poolList.length; i++) {
    await addPool(poolList[i]);
  }
  qs("#pool_list").style.display = "grid"
  qs(".loader").style.display = "none"
}

window.onload = async function () {
  try {

    let env = "testnet" //default
    //change to mainnet if url contains /DApp/mainnet/
    //get from url: DApp/testnet/ or DApp/mainnet/
    const parts = window.location.pathname.split("/")
    const i = parts.indexOf("DApp")
    if (i >= 0) { env = parts[i + 1] }
    if (env != nearConfig.farms[0].networkId)
      nearConfig = getConfig(env);

    var countDownDate = new Date("Sept 23, 2021 00:00:00 UTC");
    var countDownDate = new Date(countDownDate.getTime() - countDownDate.getTimezoneOffset() * 60000)
  

    var x = setInterval(function() {

      // Get today's date and time
      var now = new Date().getTime();
      var d = new Date();
      var d = new Date(d.getTime() - d.getTimezoneOffset() * 60000)

      // Find the distance between now and the count down date
      var distance = countDownDate.getTime() - d.getTime();

      // Time calculations for days, hours, minutes and seconds
      var days = Math.floor(distance / (1000 * 60 * 60 * 24));
      var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      var seconds = Math.floor((distance % (1000 * 60)) / 1000);

      // Display the result in the element with id="demo"
      document.getElementById("timer")!.innerHTML = "<h2><span style='color:#222'>Starts In: </span><span style='color:rgba(80,41,254,0.88)'>" + hours + "h : "
      + minutes + "m : " + seconds + "s" + "</span></h2>";

      document.getElementById("timer-non")!.innerHTML = "<h2><span style='color:#222'>Starts In: </span><span style='color:rgba(80,41,254,0.88)'>" + hours + "h : "
      + minutes + "m : " + seconds + "s" + "</span></h2>";
      
      // If the count down is finished, write some text
      if (distance < 0) {
        clearInterval(x);
        document.getElementById("timer")!.innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS LIVE!</h2>";
        document.getElementById("timer-non")!.innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS LIVE!</h2>";
      }
    }, 1000);

    //init narwallets listeners
    narwallets.setNetwork(nearConfig.farms[0].networkId); //tell the wallet which network we want to operate on
    addNarwalletsListeners(narwalletConnected, narwalletDisconnected) //listen to narwallets events

    //set-up auto-refresh loop (10 min)
    setInterval(autoRefresh, 10 * MINUTES)

    //check if signed-in with NEAR Web Wallet
    await initNearWebWalletConnection()

    if (nearWebWalletConnection.isSignedIn()) {
      //already signed-in with NEAR Web Wallet
      //make the contract use NEAR Web Wallet
      wallet = new NearWebWallet(nearWebWalletConnection);
      
      await signedInFlow(wallet)
      accountName = wallet.getAccountId()
      const cheddarContract = new NEP141Trait(CHEDDAR_CONTRACT_NAME);
      cheddarContract.wallet = wallet;
      const cheddarBalance = await cheddarContract.ft_balance_of(accountName)
      const amountAvailable = toStringDec(yton(await wallet.getAccountBalance()))
      // console.log("Cheddar balance: " , cheddarBalance)
      qsInnerText("#my-account #wallet-available", amountAvailable)
      qsInnerText("#my-account #cheddar-balance", convertToDecimals(cheddarBalance, 24, 5))

      //check if we're re-spawning after a wallet-redirect
      //show transaction result depending on method called
      const poolList = await getPoolList(wallet)
      const { err, data, method, finalExecutionOutcome } = await checkRedirectSearchParams(nearWebWalletConnection, nearConfig.farms[0].explorerUrl || "explorer");
      
      if(finalExecutionOutcome) {
        var args = JSON.parse(atob(finalExecutionOutcome.transaction.actions[0].FunctionCall.args)) 
      }

      if (err) {
        showError(err, "Transaction - " + method || "");
      }
      else if (method == "deposit_and_stake") {
        showSuccess("Deposit Successful")
      }
      if (method == "unstake" && data == null) {
        showSuccess("Unstaked All and Harvested Cheddar")
      } else if (method == "unstake" && args.amount != null) {
        var receiver = finalExecutionOutcome?.transaction.receiver_id;
        for(let i = 0; i < poolList.length; i++) {
          console.log("poolList[i].contract.contractId: ", poolList[i].contract.contractId)
          if(poolList[i].contract.contractId == receiver) {
            const metaData = poolList[i].metaData
            showSuccess(`Unstaked ${convertToDecimals(args.amount, metaData.decimals, 2)} ${metaData.symbol}`)
            // showSuccess(`Unstaked ${convertToDecimals(data, metaData.decimals, 2)} ${metaData.symbol}`)
            break;
          }
        }
      } else if(method == "withdraw_crop") {

        if(finalExecutionOutcome) {
          var log = (finalExecutionOutcome.receipts_outcome[3].outcome.logs[0]).split(' ');
          message = yton(message[3]) + ' Cheddar Harvested!'
          showSuccess(message)
        }
        
      } else if(method == "storage_deposit") {
          showSuccess(`Storage Deposit Successful`)
      }
      else if (data) {
        
        switch (method) {
          case "liquid_unstake": {
            showSection("#unstake")
            showUnstakeResult(data)
            break;
          }
          case "nslp_add_liquidity": {
            showSection("#liquidity")
            //showLiquidityOwned();
            break;
          }
          case "withdraw_crop": {
            showSuccess(`${yton(data)} Cheddar Harvested!`)
            break;
          }
          case "unstake": {
            var receiver = finalExecutionOutcome?.transaction.receiver_id;
            console.log("Receiver: ", receiver)
            console.log("Length: ", poolList.length)
            // if(receiver) {
            for(let i = 0; i < poolList.length; i++) {
              console.log("poolList[i].tokenContract.contractId: ", poolList[i].tokenContract.contractId)
              if(poolList[i].tokenContract.contractId == receiver) {
                const metaData = poolList[i].metaData
                showSuccess(`Unstaked ${convertToDecimals(data, metaData.decimals, 2)} ${metaData.symbol}`)
                break;
              }
            }
            // }
            break;
          }
          case "ft_transfer_call": {
            var receiver = finalExecutionOutcome?.transaction.receiver_id;
            for(let i = 0; i < poolList.length; i++) {
              if(poolList[i].tokenContract.contractId == receiver) {
                const metaData = poolList[i].metaData
                showSuccess(`Staked ${convertToDecimals(data, metaData.decimals, 2)} ${metaData.symbol}`)
                break;
              }
            }
            break;
          }
          default:
            showSuccess(data[0], "Transaction Result")
        }
      }

    }
    else {
      //not signed-in 
      await signedOutFlow() //show home-not-connected -> select wallet page
    }
  }
  catch (ex) {
    showErr(ex)
  }
}