import { connect, Contract, keyStores, Near, WalletConnection } from 'near-api-js'
import { getConfig } from './config'

import { WalletInterface } from './wallet-api/wallet-interface';
import { disconnectedWallet } from './wallet-api/disconnected-wallet';
import { NearWebWallet } from './wallet-api/near-web-wallet/near-web-wallet';
import { narwallets, addNarwalletsListeners } from './wallet-api/narwallets/narwallets';
import { toNumber, ntoy, yton, toStringDec, toStringDecLong, toStringDecMin, ytonFull, addCommas, convertToDecimals, removeDecZeroes } from './util/conversions';

import { StakingPoolP1 } from './contracts/p2-staking';
import type { ContractParams } from './contracts/contract-structs';

//qs/qsa are shortcut for document.querySelector/All
import { qs, qsa, qsi, showWait, hideWaitKeepOverlay, showErr, showSuccess, showMessage, show, hide, hidePopup, hideOverlay, qsaInnerText, showError, showPopup } from './util/document';
import { checkRedirectSearchParams } from './wallet-api/near-web-wallet/checkRedirectSearchParams';
import { computeCurrentEpoch, EpochInfo } from './util/near-epoch';
import { NEP141Trait } from './contracts/NEP141';
import { InvalidSignature } from 'near-api-js/lib/generated/rpc_error_types';

//get global config
//const nearConfig = getConfig(process.env.NODE_ENV || 'development')
let nearConfig = getConfig('testnet'); //default testnet, can change according to URL on window.onload

// global variables used throughout
let wallet: WalletInterface = disconnectedWallet;
let contract1: StakingPoolP1;
let cheddarContractName1: NEP141Trait;
let tokenContractName1: NEP141Trait;

let contract2: StakingPoolP1;
let cheddarContractName2: NEP141Trait;
let tokenContractName2: NEP141Trait;

let contract3: StakingPoolP1;
let cheddarContractName3: NEP141Trait;
let tokenContractName3: NEP141Trait;

let contract4: StakingPoolP1;
let cheddarContractName4: NEP141Trait;
let tokenContractName4: NEP141Trait;

let accountInfo: string[];
let accountInfo2: string[];
let accountInfo3: string[];
let accountInfo4: string[];

let total_supply: number;
let total_supply2: number;
let total_supply3: number;
let total_supply4: number;

let contractParams: ContractParams = {
  owner_id: "",
  token_contract: "cheddar.token",
  rewards_per_day: ntoy(10),
  is_open: false,
  farming_start: 0,
  farming_end: 0,
  total_rewards: "0",
  total_stake: "0"
}

let contractParams2: ContractParams = {
  owner_id: "",
  token_contract: "cheddar.token",
  rewards_per_day: ntoy(10),
  is_open: false,
  farming_start: 0,
  farming_end: 0,
  total_rewards: "0",
  total_stake: "0"
}

let contractParams3: ContractParams = {
  owner_id: "",
  token_contract: "cheddar.token",
  rewards_per_day: ntoy(10),
  is_open: false,
  farming_start: 0,
  farming_end: 0,
  total_rewards: "0",
  total_stake: "0"
}

let contractParams4: ContractParams = {
  owner_id: "",
  token_contract: "cheddar.token",
  rewards_per_day: ntoy(10),
  is_open: false,
  farming_start: 0,
  farming_end: 0,
  total_rewards: "0",
  total_stake: "0"
}

let nearWebWalletConnection: WalletConnection;

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
      signedInFlow()
    }
    else {
      signedOutFlow();
    }
  }

qs('#logo').onclick =
  async function (event) {
    event.preventDefault()
    if (wallet.isConnected()) {
      signedInFlow()
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
    contract1.wallet = disconnectedWallet;
    cheddarContractName1.wallet = disconnectedWallet;
    tokenContractName1.wallet = disconnectedWallet;

    contract2.wallet = disconnectedWallet;
    cheddarContractName2.wallet = disconnectedWallet;
    tokenContractName2.wallet = disconnectedWallet;

    contract3.wallet = disconnectedWallet;
    cheddarContractName3.wallet = disconnectedWallet;
    tokenContractName3.wallet = disconnectedWallet;

    contract4.wallet = disconnectedWallet;
    cheddarContractName4.wallet = disconnectedWallet;
    tokenContractName4.wallet = disconnectedWallet;

    signedOutFlow();
  }


//Stake button. Workaround for Safari emitter issue.
qs('button#stake').onclick =
  async function (event: Event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement

    console.log(button.form)

    submitForm((event.target as HTMLElement).id, button.form)
  }

qs('button#stakeREF').onclick =
  async function (event: Event) {
  event.preventDefault()
  var buttonId = 'button#' + (event.target as HTMLElement).id
  var button = qs(buttonId) as HTMLButtonElement

  submitForm((event.target as HTMLElement).id, button.form)
}

qs('button#stakeSTNEAR').onclick =
  async function (event: Event) {
  event.preventDefault()
  var buttonId = 'button#' + (event.target as HTMLElement).id
  var button = qs(buttonId) as HTMLButtonElement

  submitForm((event.target as HTMLElement).id, button.form)
}

qs('button#stakeBananas').onclick =
  async function (event: Event) {
  event.preventDefault()
  var buttonId = 'button#' + (event.target as HTMLElement).id
  var button = qs(buttonId) as HTMLButtonElement

  submitForm((event.target as HTMLElement).id, button.form)
}

//UnStake button. Workaround for Safari emitter issue.
qs('button#unstake').onclick =
  async function (event: Event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement

    submitForm((event.target as HTMLElement).id, button.form)
  }

qs('button#unstakeREF').onclick =
  async function (event: Event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement

    submitForm((event.target as HTMLElement).id, button.form)
  }

qs('button#unstakeSTNEAR').onclick =
  async function (event: Event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement

    submitForm((event.target as HTMLElement).id, button.form)
  }

qs('button#unstakeBananas').onclick =
  async function (event: Event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement

    submitForm((event.target as HTMLElement).id, button.form)
  }

//Harvest button. Workaround for Safari emitter issue.
qs('button#harvest').onclick =
  async function (event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement
    console.log(button)
    submitForm((event.target as HTMLElement).id, button.form)
  }

qs('button#harvestREF').onclick =
  async function (event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement
    console.log(button)
    submitForm((event.target as HTMLElement).id, button.form)
  }

qs('button#harvestSTNEAR').onclick =
  async function (event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement
    console.log(button)
    submitForm((event.target as HTMLElement).id, button.form)
  }

qs('button#harvestBananas').onclick =
  async function (event) {
    event.preventDefault()
    var buttonId = 'button#' + (event.target as HTMLElement).id
    var button = qs(buttonId) as HTMLButtonElement
    console.log(button)
    submitForm((event.target as HTMLElement).id, button.form)
  }

//Form submission
//qs('form#stake').onsubmit =
async function submitForm(action: string, form: any) {
  event?.preventDefault()

  //const form = event.target as HTMLFormElement
  // get elements from the form using their id attribute
  const { fieldset, stakeAmount } = form

  // disable the form while the call is made
  fieldset.disabled = true
  const isStaking = (action == "stake" || action == "stakeREF" || action == "stakeSTNEAR" || action == "stakeBananas")
  const isHarvest = (action == "harvest" || action == "harvestREF" || action == "harvestSTNEAR" || action == "harvestBananas")
  //const isUnstaking = (action == "harvest" || action == "harvestREF" || action == "harvestSTNEAR" || action == "harvestBananas")
  showWait(isStaking ? "Staking..." : isHarvest ? "Harvesting..." : "Unstaking...")

  try {

    if (!contractParams.is_active) throw Error("pools are not open yet")

    //get amount
    const min_deposit_amount = 1;
    let amount = ntoy(stakeAmount.value);
    console.log(stakeAmount.value)
    console.log((convertToDecimals(amount,18)))

    if (isStaking) {
      if (amount < min_deposit_amount) throw Error(`Stake at least ${min_deposit_amount} NEAR`);
      
      // make a call to the smart contract
      await tokenContractName2.ft_transfer_call("p2-ref.cheddar.testnet", ntoy(convertToDecimals(amount, 18)), "to farm")
    }
    else if (isHarvest) {
      if (cheddar_displayed <= 0) throw Error("no cheddar to harvest :(")
      amount = cheddar_displayed;

      await contract2.withdraw_crop()

    }
    else {
      if (amount <= 0) throw Error(`Unstake a positive amount`);

      await contract2.unstake(amount)

    }

    //clear form
    form.reset()

    //refresh acc info
    await refreshAccountInfo()

    showSuccess((isStaking ? "Staked " : isHarvest ? "Harvested " : "Unstaked ") + toStringDecMin(amount) + (isHarvest ? " CHEDDAR" : " NEAR"))
    if (isHarvest) {
      computed = 1;
      real = 1;
      display_cheddar(0);
    }
    else if (isStaking) {
      staked2 += amount
    }
    else {
      staked2 -= amount
    }

  }
  catch (ex) {
    showErr(ex)
  }

  // re-enable the form, whether the call succeeded or failed
  fieldset.disabled = false
}

//button stake max 
qs('section#home-connected #max').onclick = stakeMaxClick;
async function stakeMaxClick(event: MouseEvent) {
  try {
    event.preventDefault()
    let input: HTMLInputElement | null | undefined = (event.target as HTMLElement).closest(".input-group")?.querySelector("input")
    if (input) {
      let maxStake = BigInt(await tokenContractName1.ft_balance_of(accName)) - ONE_NEAR / BigInt(100) //subtract one cent .- leave something for fee & storage
      //let maxStakeNear = Math.trunc(yton(maxStake.toString()))
      if (maxStake < 0) maxStake = BigInt(0);
      input.value = toStringDecMin(yton(maxStake.toString()))
    }
  }
  catch (ex) {
    showErr(ex)
  }
}

qs('a#terms-of-use').onclick =
  async function (event) {
    event.preventDefault()
    showPopup("#terms.popup")
  }

qs('#wallet-available a .max').onclick =
  async function (event) {
    try {
      event.preventDefault()
      var amountAvailable = toStringDec(yton(await tokenContractName1.ft_balance_of(accName)))
      console.log()
      qsi("#stakeAmount").value = parseInt(amountAvailable.replace(",", "")).toString()
    }
    catch (ex) {
      showErr(ex)
    }
  }

qs('#near-balance a .max').onclick =
  async function (event) {
    try {
      event.preventDefault()
      qsi("#stakeAmount").value = (yton(accountInfo[0])).toString()
    }
    catch (ex) {
      showErr(ex)
    }
  }

//button unstake max
qs('form#unstakeForm #max').onclick =
  async function (event) {
    try {
      event.preventDefault()
      qsi("#unstakeAmount").value = toStringDecMin(yton(accountInfo[1]))
    }
    catch (ex) {
      showErr(ex)
    }
  }

//unstake form
qs('form#unstakeForm').onsubmit =
  async function (event) {
    event.preventDefault()

    // get elements from the form using their id attribute
    const form = event.target as HTMLFormElement
    const { fieldset, unstakeAmount } = form

    // disable the form while the call is made
    fieldset.disabled = true
    showWait("unstaking...")

    try {
      //get amount
      const amountToUnstake = toNumber(unstakeAmount.value);

      checkMinUnstake(amountToUnstake)

      // const liquidity = BigInt(contractState.nslp_liquidity)
      // const sellAmount = BigInt(ntoy(amountToUnstake))
      // if (sellAmount>liquidity) throw Error(`There's not enough liquidity. Max is ${toStringDecMin(yton(contractState.nslp_liquidity))} NEAR. You can use delayed-unstake for large amounts`);
      // const fee_bp = get_discount_basis_points( liquidity , sellAmount);

      // const expectedMin = amountToUnstake * (10000-fee_bp)/10000 * 99/100 //auto slippage 1%

      // make a call to the smart contract
      await contract1.unstake(amountToUnstake)
      await contract2.unstake(amountToUnstake)
      await contract3.unstake(amountToUnstake)
      await contract4.unstake(amountToUnstake)

      //clear form
      form.reset()

      //refresh acc info
      await refreshAccountInfo()

      showUnstakeResult(amountToUnstake)

    }
    catch (ex) {
      showErr(ex)
    }
    // re-enable the form, whether the call succeeded or failed
    fieldset.disabled = false
  }

function showUnstakeResult(unstaked: number) {
  showSuccess(
    // `<div class="stat-line"> <dt>NEAR received</dt><dd>${toStringDec(yton(result.near))}</dd> </div>`+
    // `<div class="stat-line"> <dt>$META received</dt><dd>${toStringDec(yton(result.meta))}</dd> </div>`+
    `<div class="stat-line"> <dt>Unstaked</dt><dd>${toStringDec(unstaked)}</dd> </div>`
    , "Unstake"
  )
}

function showRemoveLiquidityResult(yoctoCheddar: string) {
  showSuccess(
    //`<div class="stat-line"> <dt>NEAR received</dt><dd>${toStringDec(yton(result.near))}</dd> </div>`+
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

function checkMinUnstake(amountToUnstake: number) {
  const MIN_UNSTAKE_NEAR = 1
  let accountCheddar = yton(accountInfo[1])
  if (accountCheddar <= MIN_UNSTAKE_NEAR) {
    //the user owns a ver low amount => unstake all
    if (amountToUnstake + 0.0000001 < accountCheddar) throw Error(`unstake at least ${accountCheddar} NEAR`);
  }
  else {
    if (amountToUnstake < MIN_UNSTAKE_NEAR) throw Error(`unstake at least ${MIN_UNSTAKE_NEAR} NEAR`);
  }
}

//--------------------------------------
// AutoRefresh
async function autoRefresh() {
  if (wallet && wallet.isConnected()) {
    try {
      await refreshAccountInfo()
    }
    catch (ex) {
      console.log("auto-refresh: " + ex.message)
    }
  }
  setTimeout(autoRefresh, 10 * MINUTES)
  console.log("auto-refresh")
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
  await refreshAccountInfo();
  // await refreshAccountInfo2();
  // await refreshAccountInfo3();
  // await refreshAccountInfo4();
}

// Displaying the signed in flow container and fill in account-specific data
async function signedInFlow() {
  showSection("#home-connected")
  selectNav("#home")
  takeUserAmountFromHome()
  await refreshAccountInfo()

}

// Initialize contract & set global variables
async function initNearWebWalletConnection() {
  // Initialize connection to the NEAR testnet
  const near = await connect(Object.assign({ deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } }, nearConfig.farms[0]))

  // Initializing Wallet based Account. It can work with NEAR testnet wallet that
  // is hosted at https://wallet.testnet.near.org
  nearWebWalletConnection = new WalletConnection(near, null)

  // // Initializing our contract APIs by contract name and configuration
  // contract = (await new Contract(walletConnection.account(), nearConfig.contractName, {
  //   // View methods are read only. They don't modify the state, but usually return some value.
  //   viewMethods: ['getGreeting'],
  //   // Change methods can modify the state. But you don't receive the returned value when called.
  //   changeMethods: ['setGreeting'],
  // })
  // ) as unknown as GreetingContract;
}

function logoutNearWebWallet() {
  nearWebWalletConnection.signOut()
  wallet = disconnectedWallet

  contract1.disconnect();
  contract2.disconnect();
  contract3.disconnect();
  contract4.disconnect();

  cheddarContractName1.disconnect();
  cheddarContractName2.disconnect();
  cheddarContractName3.disconnect();
  cheddarContractName4.disconnect();

  tokenContractName1.disconnect();
  tokenContractName2.disconnect();
  tokenContractName3.disconnect();
  tokenContractName4.disconnect();

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

let real_rewards_per_day = 0;
let skip = 0;
let staked = 0;
let real = 0;
let computed = 0;
let previous_real = 0;
let previous_timestamp = 0;
let tokenDecimals = 0;
let accName = '';
let total_staked = 0;

let real_rewards_per_day2 = 0;
let skip2 = 0;
let staked2 = 0;
let real2 = 0;
let computed2 = 0;
let previous_real2 = 0;
let previous_timestamp2 = 0;
let tokenDecimals2 = 0;
let accName2 = '';
let total_staked2= 0;

let real_rewards_per_day3 = 0;
let skip3 = 0;
let staked3 = 0;
let real3 = 0;
let computed3 = 0;
let previous_real3 = 0;
let previous_timestamp3 = 0;
let tokenDecimals3 = 0;
let accName3 = '';
let total_staked3 = 0;

let real_rewards_per_day4 = 0;
let skip4 = 0;
let staked4 = 0;
let real4 = 0;
let computed4 = 0;
let previous_real4 = 0;
let previous_timestamp4 = 0;
let tokenDecimals4 = 0;
let accName4 = '';
let total_staked4 = 0;

async function refreshRealRewardsLoop() {

  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened = (contractParams.is_active && unixTimestamp >= contractParams.farming_start && unixTimestamp <= contractParams.farming_end);
  
  try {

    if (isOpened && wallet.isConnected()) {

      accountInfo = await contract1.status()
      staked = accountInfo[0];
      qsaInnerText("#afiPool #near-balance span.near.balance", toStringDecLong(yton(staked)))
      real = accountInfo[1];
      unixTimestamp = Number(accountInfo[2]);
      let now = unixTimestamp * 1000 //to milliseconds
      var lastBlockTime = unixTimestamp * 1000;

      if( (unixTimestamp * 1000) > Date.now() ) {
        now = Date.now()
      }

      if (staked > 0) {
        qs("#afiPool #near-balance a .max").style.display = "block";
        if (previous_timestamp && real > previous_real) {
          //recompute speed
          let advanced = yton(real) - yton(previous_real)
          let elapsed_ms = now - previous_timestamp
          real_rewards_per_day = (advanced * 60 * 24)
          console.log(`advanced:${advanced} real:${real} prev-real:${previous_real} rewards-per-day:${real_rewards_per_day}  comp:${computed} real-comp:${real - computed} eslapsed-ms:${elapsed_ms}`);
          console.log(`real-adv:${advanced}, elapsed_ms:${elapsed_ms}, real rew x week :${real_rewards_per_day * 7}`);
        }
      }
      previous_real = real;
      previous_timestamp = now
      if (real > computed || (real > 0 && computed - real > real / 4)) { //if real is bigger or differ is >25%
        computed = real
      }
      display_cheddar((computed);
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {

    let timeRemaining = 60;

    if (isOpened && wallet.isConnected()) {

      let timePassed = (Date.now()-(unixTimestamp*1000))/1000
      timeRemaining = 61.3 - timePassed;
      timeRemaining = (timeRemaining > 0) ? timeRemaining : timeRemaining + 2
      console.log(timeRemaining)
    }

    setTimeout(refreshRealRewardsLoop, timeRemaining * 1000) // every 60 secs
  }
}

async function refreshRealRewardsLoop2() {

  let unixTimestamp2 = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened2 = (contractParams2.is_active && unixTimestamp2 >= contractParams2.farming_start && unixTimestamp2 <= contractParams2.farming_end);

 
  try {

    if (isOpened2 && wallet.isConnected()) {

      accountInfo2 = await contract2.status()
      staked2 = accountInfo2[0];
      qsaInnerText("#afiPool #near-balance span.near.balance", toStringDecLong(yton(staked2)))
      real2 = accountInfo2[1];
      unixTimestamp2 = Number(accountInfo2[2]);
      let now2 = unixTimestamp2 * 1000 //to milliseconds
      var lastBlockTime2 = unixTimestamp2 * 1000;

      if( (unixTimestamp2 * 1000) > Date.now() ) {
        now2 = Date.now()
      }

      if (staked2 > 0) {
        qs("#afiPool #near-balance a .max").style.display = "block";
        if (previous_timestamp2 && real2 > previous_real2) {
          //recompute speed
          let advanced2 = yton(real2) - yton(previous_real2)
          let elapsed_ms2 = now2 - previous_timestamp2
          real_rewards_per_day2 = (advanced2 * 60 * 24)
          console.log(`advanced:${advanced2} real:${real2} prev-real:${previous_real2} rewards-per-day:${real_rewards_per_day2}  comp:${computed2} real-comp:${real2 - computed2} eslapsed-ms:${elapsed_ms2}`);
          console.log(`real-adv:${advanced2}, elapsed_ms:${elapsed_ms2}, real rew x week :${real_rewards_per_day2 * 7}`);
        }
      }
      previous_real2 = real2;
      previous_timestamp2 = now2
      if (real2 > computed2 || (real2 > 0 && computed2 - real2 > real2 / 4)) { //if real is bigger or differ is >25%
        computed2 = real2
      }
      display_cheddar((computed2);
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {

    let timeRemaining2 = 60;

    if (isOpened2 && wallet.isConnected()) {

      let timePassed2 = (Date.now()-(unixTimestamp2*1000))/1000
      timeRemaining2 = 61.3 - timePassed2;
      timeRemaining2 = (timeRemaining2 > 0) ? timeRemaining2 : timeRemaining2 + 2
      console.log(timeRemaining2)
    }

    setTimeout(refreshRealRewardsLoop2, timeRemaining2 * 1000) // every 60 secs
  }
}

async function refreshRealRewardsLoop3() {

  let unixTimestamp3 = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened3 = (contractParams3.is_active && unixTimestamp3 >= contractParams3.farming_start && unixTimestamp3 <= contractParams3.farming_end);

  try {

    if (isOpened3 && wallet.isConnected()) {

      accountInfo3 = await contract3.status()
      staked3 = accountInfo3[0];
      qsaInnerText("#afiPool #near-balance span.near.balance", toStringDecLong(yton(staked3)))
      real3 = accountInfo3[1];
      unixTimestamp3 = Number(accountInfo3[2]);
      let now3 = unixTimestamp3 * 1000 //to milliseconds
      var lastBlockTime3 = unixTimestamp3 * 1000;

      if( (unixTimestamp3 * 1000) > Date.now() ) {
        now3 = Date.now()
      }

      if (staked3 > 0) {
        qs("#afiPool #near-balance a .max").style.display = "block";
        if (previous_timestamp3 && real3 > previous_real3) {
          //recompute speed
          let advanced3 = yton(real3) - yton(previous_real3)
          let elapsed_ms3 = now3 - previous_timestamp3
          real_rewards_per_day3 = (advanced3 * 60 * 24)
          console.log(`advanced:${advanced3} real:${real3} prev-real:${previous_real3} rewards-per-day:${real_rewards_per_day3}  comp:${computed3} real-comp:${real3 - computed3} eslapsed-ms:${elapsed_ms3}`);
          console.log(`real-adv:${advanced3}, elapsed_ms:${elapsed_ms3}, real rew x week :${real_rewards_per_day3 * 7}`);
        }
      }
      previous_real3 = real3;
      previous_timestamp2 = now3
      if (real3 > computed3 || (real3 > 0 && computed3 - real3 > real3 / 4)) { //if real is bigger or differ is >25%
        computed3 = real3
      }
      display_cheddar((computed3);
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {

    let timeRemaining3 = 60;

    if (isOpened3 && wallet.isConnected()) {

      let timePassed3 = (Date.now()-(unixTimestamp3*1000))/1000
      timeRemaining3 = 61.3 - timePassed3;
      timeRemaining3 = (timeRemaining3 > 0) ? timeRemaining3 : timeRemaining3 + 2
      console.log(timeRemaining3)
    }

    setTimeout(refreshRealRewardsLoop3, timeRemaining3 * 1000) // every 60 secs
  }
}

async function refreshRealRewardsLoop4() {

  let unixTimestamp4 = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened4 = (contractParams4.is_active && unixTimestamp4 >= contractParams4.farming_start && unixTimestamp4 <= contractParams4.farming_end);

  try {

    if (isOpened4 && wallet.isConnected()) {

      accountInfo4 = await contract4.status()
      staked4 = accountInfo4[0];
      qsaInnerText("#afiPool #near-balance span.near.balance", toStringDecLong(yton(staked4)))
      real4 = accountInfo4[1];
      unixTimestamp4 = Number(accountInfo4[2]);
      let now4 = unixTimestamp4 * 1000 //to milliseconds
      var lastBlockTime4 = unixTimestamp4 * 1000;

      if( (unixTimestamp4 * 1000) > Date.now() ) {
        now4 = Date.now()
      }

      if (staked4 > 0) {
        qs("#afiPool #near-balance a .max").style.display = "block";
        if (previous_timestamp4 && real4 > previous_real4) {
          //recompute speed
          let advanced4 = yton(real4) - yton(previous_real4)
          let elapsed_ms4 = now4 - previous_timestamp4
          real_rewards_per_day4 = (advanced4 * 60 * 24)
          console.log(`advanced:${advanced4} real:${real4} prev-real:${previous_real4} rewards-per-day:${real_rewards_per_day4}  comp:${computed4} real-comp:${real4 - computed4} eslapsed-ms:${elapsed_ms4}`);
          console.log(`real-adv:${advanced4}, elapsed_ms:${elapsed_ms4}, real rew x week :${real_rewards_per_day4 * 7}`);
        }
      }
      previous_real4 = real4;
      previous_timestamp4 = now4
      if (real3 > computed4 || (real4 > 0 && computed4 - real4 > real4 / 4)) { //if real is bigger or differ is >25%
        computed4 = real4
      }
      display_cheddar((computed4);
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {

    let timeRemaining4 = 60;

    if (isOpened4 && wallet.isConnected()) {

      let timePassed4 = (Date.now()-(unixTimestamp4*1000))/1000
      timeRemaining4 = 61.3 - timePassed4;
      timeRemaining4 = (timeRemaining4 > 0) ? timeRemaining4 : timeRemaining4 + 2
      console.log(timeRemaining4)
    }

    setTimeout(refreshRealRewardsLoop4, timeRemaining4 * 1000) // every 60 secs
  }
}

async function refreshRewardsDisplayLoop() {
  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened = (contractParams.is_active && unixTimestamp >= contractParams.farming_start && unixTimestamp <= contractParams.farming_end);
  try {
    if (isOpened && wallet.isConnected()) {
      if (previous_timestamp) {
        let elapsed_ms = Date.now() - previous_timestamp
        if (staked != 0) {
          var rewards = (real_rewards_per_day * elapsed_ms / (1000 * 60 * 60 * 24));
          computed = (yton(previous_real) + rewards)
          console.log(`date_now:${Date.now()}, round_timestamp:${previous_timestamp}, rewards:${rewards}, computed:${computed}, previous_real:${yton(previous_real)}, real_rewards_per_day :${real_rewards_per_day}, elapsed_ms:${elapsed_ms}`);
          display_cheddar(computed);
        }
      }
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {
    setTimeout(refreshRewardsDisplayLoop, 200) // 5 times a second
  }
}

async function refreshRewardsDisplayLoop2() {
  let unixTimestamp2 = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened2 = (contractParams2.is_active && unixTimestamp2 >= contractParams2.farming_start && unixTimestamp2 <= contractParams2.farming_end);
  try {
    if (isOpened2 && wallet.isConnected()) {
      if (previous_timestamp2) {
        let elapsed_ms2 = Date.now() - previous_timestamp2
        if (staked2 != 0) {
          var rewards2 = (real_rewards_per_day2 * elapsed_ms2 / (1000 * 60 * 60 * 24));
          computed2 = (yton(previous_real2) + rewards2)
          console.log(`date_now:${Date.now()}, round_timestamp:${previous_timestamp2}, rewards:${rewards2}, computed:${computed2}, previous_real:${yton(previous_real2)}, real_rewards_per_day2 :${real_rewards_per_day2}, elapsed_ms:${elapsed_ms2}`);
          display_cheddar(computed2);
        }
      }
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {
    setTimeout(refreshRewardsDisplayLoop2, 200) // 5 times a second
  }
}

async function refreshRewardsDisplayLoop3() {
  let unixTimestamp3 = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened3 = (contractParams3.is_active && unixTimestamp3 >= contractParams3.farming_start && unixTimestamp3 <= contractParams3.farming_end);
  try {
    if (isOpened3 && wallet.isConnected()) {
      if (previous_timestamp3) {
        let elapsed_ms3 = Date.now() - previous_timestamp3
        if (staked3 != 0) {
          var rewards3 = (real_rewards_per_day3 * elapsed_ms3 / (1000 * 60 * 60 * 24));
          computed3 = (yton(previous_real3) + rewards3)
          console.log(`date_now:${Date.now()}, round_timestamp:${previous_timestamp3}, rewards:${rewards3}, computed:${computed3}, previous_real:${yton(previous_real3)}, real_rewards_per_day2 :${real_rewards_per_day3}, elapsed_ms:${elapsed_ms3}`);
          display_cheddar(computed3);
        }
      }
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {
    setTimeout(refreshRewardsDisplayLoop3, 200) // 5 times a second
  }
}

async function refreshRewardsDisplayLoop4() {
  let unixTimestamp4 = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened4 = (contractParams4.is_active && unixTimestamp4 >= contractParams4.farming_start && unixTimestamp4 <= contractParams4.farming_end);
  try {
    if (isOpened4 && wallet.isConnected()) {
      if (previous_timestamp4) {
        let elapsed_ms4 = Date.now() - previous_timestamp4
        if (staked4 != 0) {
          var rewards4 = (real_rewards_per_day4 * elapsed_ms4 / (1000 * 60 * 60 * 24));
          computed4 = (yton(previous_real4) + rewards4)
          console.log(`date_now:${Date.now()}, round_timestamp:${previous_timestamp4}, rewards:${rewards4}, computed:${computed4}, previous_real:${yton(previous_real4)}, real_rewards_per_day :${real_rewards_per_day4}, elapsed_ms:${elapsed_ms4}`);
          display_cheddar(computed4);
        }
      }
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {
    setTimeout(refreshRewardsDisplayLoop4, 200) // 5 times a second
  }
}

let cheddar_displayed: number = 0;
let cheddar_displayed2: number = 0;
let cheddar_displayed3: number = 0;
let cheddar_displayed4: number = 0;

function display_cheddar(cheddar_amount: number) {
  qsaInnerText("#afiPool #cheddar-balance", toStringDec(cheddar_amount)
  cheddar_displayed = cheddar_amount // so they can harvest
}

async function refreshAccountInfo() {
  try {

    accName = wallet.getAccountId();

    if (accName.length > 22) accName = accName.slice(0, 10) + ".." + accName.slice(-10);

    //console.log(await tokenContractName1.ft_balance_of(accName))


    qs(".user-info #account-id").innerText = accName;
    //show top-right-balance only if connected wallet
    //show(qs("#top-right-balance"), wallet.isConnected())

    let walletAvailable = toStringDec(yton(await tokenContractName1.ft_balance_of(accName)))
    //update shown wallet balance
    qsaInnerText("#afiPool #wallet-available span.near.balance", removeDecZeroes((walletAvailable));
    qsaInnerText("span.bold.large.near#wallet-available", walletAvailable);


    if (Number(walletAvailable.replace(",", "")) > 1) {
      qs("#wallet-available a .max").style.display = "block";
    }


    let tokenBal2 = await tokenContractName2.ft_balance_of(accName);
    let metaData2 = await tokenContractName2.ft_metadata();

    let walletAvailable2 = toStringDec(convertToDecimals(tokenBal2,metaData2.decimals))
    //update shown wallet balance
    qsaInnerText("#refPool #wallet-available span.near.balance", removeDecZeroes((walletAvailable2));

    if (Number(walletAvailable2.replace(",", "")) > 1) {
      qs("#wallet-available a .max").style.display = "block";
    }


    let tokenBal3 = await tokenContractName3.ft_balance_of(accName);
    let metaData3 = await tokenContractName3.ft_metadata();
    let walletAvailable3 = toStringDec(convertToDecimals(tokenBal3,metaData3.decimals))
    //update shown wallet balance
    qsaInnerText("#stNEARPool #wallet-available span.near.balance", removeDecZeroes((walletAvailable3));


    if (Number(walletAvailable3.replace(",", "")) > 1) {
      qs("#wallet-available a .max").style.display = "block";
    }

    let tokenBal4 = await tokenContractName4.ft_balance_of(accName);
    let metaData4 = await tokenContractName4.ft_metadata();
    let walletAvailable4 = toStringDec(convertToDecimals(tokenBal4,metaData4.decimals))
    //update shown wallet balance
    qsaInnerText("#bananaPool #wallet-available span.near.balance", removeDecZeroes((walletAvailable4));


    if (Number(walletAvailable4.replace(",", "")) > 1) {
      qs("#wallet-available a .max").style.display = "block";
    }


    //update account & contract stats
    if (wallet.isConnected()) {

      let accountRegistred = await contract1.storageBalance()

      if(accountRegistred == null) {

        let storageDepost = await contract1.storageDeposit()
      }

      let metaData = await tokenContractName1.ft_metadata();
      tokenDecimals = metaData.decimals;

      var tokenNames = qsa("#afiPool .token-name");

      [].forEach.call(tokenNames, function(tokenName) {
        // do whatever
         tokenName.innerText = metaData.symbol.toUpperCase();
      });

      accountInfo = await contract1.status(accName)
      console.log(accountInfo)

      contractParams = await contract1.get_contract_params()
      total_supply = yton(await cheddarContractName1.ft_total_supply())
      staked = accountInfo[0];
      real = accountInfo[1];

      var iconObj = qs("#afiPool #token-header img");
      var iconVal = metaData.icon;

      if(iconObj != null) {

        if(iconVal != null && iconVal.includes("data:image/svg+xml")) {

          iconObj.src = metaData.icon;

        } else {

          var iconImage = document.createElement('span');
          iconImage.classList.add('icon');
          iconImage.innerHTML = metaData.icon;

          iconObj.parentNode.replaceChild(iconImage, iconObj);

        }

      }

      qs("#afiPool #token-header span.name").innerText = metaData.name;

      qs("#afiPool #farming_start").innerText = new Date(contractParams.farming_start * 1000).toLocaleString()
      qs("#afiPool #farming_end").innerText = new Date(contractParams.farming_end * 1000).toLocaleString()
      console.log(contractParams)

      total_staked = BigInt(yton(contractParams.total_staked));

      qs("#afi-pool-stats #total-staked").innerText = total_staked + " " + metaData.symbol.toUpperCase()
      qs("#afi-pool-stats #rewards-per-day").innerText = yton((contractParams.farming_rate * 60 * 24))
      qs("#afi-pool-stats #total-rewards").innerText = (ytonFull(contractParams.total_farmed))

     
      //REF


      let accountRegistred2 = await contract2.storageBalance()

      if(accountRegistred2 == null) {

        let storageDepost2 = await contract2.storageDeposit()
      }

      var tokenNames2 = qsa("#refPool .token-name");
      //console.log(tokenNames2);

      [].forEach.call(tokenNames2, function(tokenNames2) {
        // do whatever
         tokenNames2.innerText = metaData2.symbol.toUpperCase();
      });

      accountInfo2 = await contract2.status(accName)
      console.log(accountInfo2)

      contractParams2 = await contract2.get_contract_params()
      total_supply2 = yton(await cheddarContractName2.ft_total_supply())
      staked2 = accountInfo2[0];
      real2 = accountInfo2[1];

      var iconObj2 = qs("#afiPool #token-header img");
      var iconVal2 = metaData2.icon;

      if(iconObj2 != null) {

        if(iconVal2 != null && iconVal2.includes("data:image/svg+xml")) {

          iconObj2.src = metaData2.icon;

        } else {

          var iconImage2 = document.createElement('span');
          iconImage2.classList.add('icon');
          iconImage2.innerHTML = metaData2.icon;

          iconObj2.parentNode.replaceChild(iconImage2, iconObj2);

        }

      }

      qs("#refPool #token-header span.name").innerText = metaData2.name;

      qs("#refPool #farming_start").innerText = new Date(contractParams2.farming_start * 1000).toLocaleString()
      qs("#refPool #farming_end").innerText = new Date(contractParams2.farming_end * 1000).toLocaleString()
      console.log(contractParams2)

      total_staked2 = BigInt(yton(contractParams2.total_staked));

      qs("#ref-pool-stats #total-staked").innerText = total_staked2 + " " + metaData2.symbol.toUpperCase()
      qs("#ref-pool-stats #rewards-per-day").innerText = yton((contractParams2.farming_rate * 60 * 24))
      qs("#ref-pool-stats #total-rewards").innerText = (ytonFull(contractParams2.total_farmed))


      //stNEAR
      var tokenNames3 = qsa("#stNEARPool .token-name");

      [].forEach.call(tokenNames3, function(tokenNames3) {
        // do whatever
         tokenNames3.innerText = metaData3.symbol.toUpperCase();
      });

      accountInfo3 = await contract3.status(accName)
      console.log(accountInfo3)

      contractParams3 = await contract3.get_contract_params()
      total_supply3 = yton(await cheddarContractName3.ft_total_supply())
      staked3 = accountInfo3[0];
      real3 = accountInfo3[1];

      var iconObj3= qs("#afiPool #token-header img");
      var iconVal3 = metaData3.icon;

      if(iconObj3 != null) {

        if(iconVal3 != null && iconVal3.includes("data:image/svg+xml")) {

          iconObj3.src = metaData3.icon;

        } else {

          var iconImage3 = document.createElement('span');
          iconImage3.classList.add('icon');
          iconImage3.innerHTML = metaData3.icon;

          iconObj3.parentNode.replaceChild(iconImage3, iconObj3);

        }

      }

      qs("#stNEARPool #token-header span.name").innerText = metaData3.name;

      qs("#stNEARPool #farming_start").innerText = new Date(contractParams3.farming_start * 1000).toLocaleString()
      qs("#stNEARPool #farming_end").innerText = new Date(contractParams3.farming_end * 1000).toLocaleString()
      console.log(contractParams3)

      total_staked3 = BigInt(yton(contractParams3.total_staked));

      qs("#stnear-pool-stats #total-staked").innerText = total_staked3 + " " + metaData3.symbol.toUpperCase()
      qs("#stnear-pool-stats #rewards-per-day").innerText = yton((contractParams3.farming_rate * 60 * 24))
      qs("#stnear-pool-stats #total-rewards").innerText = (ytonFull(contractParams3.total_farmed))


      //Bananas

      var tokenNames4 = qsa("#afiPool .token-name");

      [].forEach.call(tokenNames4, function(tokenNames4) {
        // do whatever
         tokenNames4.innerText = metaData4.symbol.toUpperCase();
      });

      accountInfo4 = await contract4.status(accName)
      console.log(accountInfo4)

      contractParams4 = await contract4.get_contract_params()
      total_supply4 = yton(await cheddarContractName4.ft_total_supply())
      staked4 = accountInfo4[0];
      real4 = accountInfo4[1];

      var iconObj4 = qs("#afiPool #token-header img");
      var iconVal4 = metaData4.icon;

      if(iconObj4 != null) {

        if(iconVal4 != null && iconVal.includes("data:image/svg+xml")) {

          iconObj4.src = metaData4.icon;

        } else {

          var iconImage4 = document.createElement('span');
          iconImage4.classList.add('icon');
          iconImage4.innerHTML = metaData4.icon;

          iconObj4.parentNode.replaceChild(iconImage4, iconObj4);

        }

      }

      qs("#bananaPool #token-header span.name").innerText = metaData4.name;

      qs("#bananaPool #farming_start").innerText = new Date(contractParams4.farming_start * 1000).toLocaleString()
      qs("#bananaPool #farming_end").innerText = new Date(contractParams4.farming_end * 1000).toLocaleString()
      console.log(contractParams4)

      total_staked4 = BigInt(yton(contractParams4.total_staked));

      qs("#banana-pool-stats #total-staked").innerText = total_staked4 + " " + metaData4.symbol.toUpperCase()
      qs("#banana-pool-stats #rewards-per-day").innerText = yton((contractParams4.farming_rate * 60 * 24))
      qs("#banana-pool-stats #total-rewards").innerText = (ytonFull(contractParams4.total_farmed))


    }
    else {
      contractParams.rewards_per_day = ntoy(10);
      accountInfo = ["0", "0"];
      staked = 0;
      real = 0;

      contractParams2.rewards_per_day = ntoy(10);
      accountInfo2 = ["0", "0"];
      staked2 = 0;
      real2 = 0;

      contractParams3.rewards_per_day = ntoy(10);
      accountInfo3 = ["0", "0"];
      staked3 = 0;
      real3 = 0;

      contractParams4.rewards_per_day = ntoy(10);
      accountInfo4 = ["0", "0"];
      staked4 = 0;
      real4 = 0;
    }

    let bigNStaked = BigInt(yton(staked));
    let farmingRate = BigInt(contractParams.farming_rate)
    console.log(bigNStaked)
    console.log(farmingRate)
    console.log(total_staked)
    real_rewards_per_day = yton( (farmingRate * 60n * 24n) / total_staked * bigNStaked).toString()
    //console.log(real_rewards_per_day);

    qsaInnerText("#afiPool #near-balance span.near.balance", (convertToDecimals(staked,tokenDecimals)))

    if (staked > 0) {
      qs("#afiPool #near-balance a .max").style.display = "block";
    }

    display_cheddar(real); // display real rewards so they can harvest
    computed = real;
    previous_timestamp = Date.now();
    previous_real = real;

    qsaInnerText("#afiPool #total-cheddar-tokens", toStringDec(total_supply))


    // //REF

    let bigNStaked2 = BigInt(yton(staked2));
    let farmingRate2 = BigInt(contractParams2.farming_rate)
    console.log(bigNStaked2)
    console.log(farmingRate2)
    console.log(total_staked2)

    if(bigNStaked2 > 0 && total_staked2 > 0 ) {
      real_rewards_per_day2 = yton( (farmingRate2 * 60n * 24n) / total_staked2 * bigNStaked2).toString()
    }
    else {
      real_rewards_per_day2 = yton( (farmingRate2 * 60n * 24n)).toString()
    }
    //console.log(real_rewards_per_day);

    qsaInnerText("#refPool #near-balance span.near.balance", (convertToDecimals(staked2,tokenDecimals2)))

    if (staked2 > 0) {
      qs("#refPool #near-balance a .max").style.display = "block";
    }

    display_cheddar(real2); // display real rewards so they can harvest
    computed2 = real2;
    previous_timestamp2 = Date.now();
    previous_real2 = real2;

    qsaInnerText("#refPool #total-cheddar-tokens", toStringDec(total_supply2))


    //STNEAR
    let bigNStaked3 = BigInt(yton(staked3));
    let farmingRate3 = BigInt(contractParams3.farming_rate)
    console.log(bigNStaked3)
    console.log(farmingRate3)
    console.log(total_staked3)
    if(bigNStaked3 > 0 && total_staked3 > 0 ) {
      real_rewards_per_day3 = yton( (farmingRate3 * 60n * 24n) / total_staked3 * bigNStaked3).toString()
    }
    else {
      real_rewards_per_day3 = yton( (farmingRate3 * 60n * 24n)).toString()
    }
    //console.log(real_rewards_per_day);

    qsaInnerText("#stNEARPool #near-balance span.near.balance", (convertToDecimals(staked3,tokenDecimals3)))

    if (staked3 > 0) {
      qs("#stNEARPool #near-balance a .max").style.display = "block";
    }

    display_cheddar(real3); // display real rewards so they can harvest
    computed3 = real3;
    previous_timestamp3 = Date.now();
    previous_real3 = real3;

    qsaInnerText("#stNEARPool #total-cheddar-tokens", toStringDec(total_supply3))

  
    //Bananas
    let bigNStaked4 = BigInt(yton(staked));
    let farmingRate4 = BigInt(contractParams4.farming_rate)
    console.log(bigNStaked4)
    console.log(farmingRate4)
    console.log(total_staked4)
    if(bigNStaked4 > 0 && total_staked4 > 0 ) {
      real_rewards_per_day4 = yton( (farmingRate4 * 60n * 24n) / total_staked4 * bigNStaked4).toString()
    }
    else {
      real_rewards_per_day4 = yton( (farmingRate4 * 60n * 24n)).toString()
    }
    //console.log(real_rewards_per_day);

    qsaInnerText("#bananasPool #near-balance span.near.balance", (convertToDecimals(staked4,tokenDecimals)))

    if (staked4 > 0) {
      qs("#bananasPool #near-balance a .max").style.display = "block";
    }

    display_cheddar(real4); // display real rewards so they can harvest
    computed4 = real4;
    previous_timestamp4 = Date.now();
    previous_real4 = real4;

    qsaInnerText("#bananasPool #total-cheddar-tokens", toStringDec(total_supply))

  }
  catch (ex) {
    showErr(ex)
  }
}

/// when the user chooses "connect to web-page" in the narwallets-chrome-extension
function narwalletConnected(ev: CustomEvent) {
  wallet = narwallets;
  contract1.wallet = narwallets; //set the contract to use narwallets
  cheddarContractName1.wallet = narwallets; //set the contract to use narwallets
  tokenContractName1.wallet = narwallets;

  contract2.wallet = narwallets; //set the contract to use narwallets
  cheddarContractName2.wallet = narwallets; //set the contract to use narwallets
  tokenContractName2.wallet = narwallets;


  contract3.wallet = narwallets; //set the contract to use narwallets
  cheddarContractName3.wallet = narwallets; //set the contract to use narwallets
  tokenContractName3.wallet = narwallets;

  contract4.wallet = narwallets; //set the contract to use narwallets
  cheddarContractName4.wallet = narwallets; //set the contract to use narwallets
  tokenContractName4.wallet = narwallets;

  signedInFlow()
}

/// when the user chooses "disconnect from web-page" in the narwallets-chrome-extension
function narwalletDisconnected(ev: CustomEvent) {
  // const div = d.byId("connection-info")
  // div.innerText = "Not connected";
  // div.classList.remove("connected")
  // d.showSuccess("wallet disconnected")
  // InitialPage.show()
  wallet = disconnectedWallet;
  contract1.wallet = disconnectedWallet;
  cheddarContractName1.wallet = disconnectedWallet;
  tokenContractName1.wallet = disconnectedWallet;

  contract2.wallet = disconnectedWallet;
  cheddarContractName2.wallet = disconnectedWallet;
  tokenContractName2.wallet = disconnectedWallet;

  contract3.wallet = disconnectedWallet;
  cheddarContractName3.wallet = disconnectedWallet;
  tokenContractName3.wallet = disconnectedWallet;

  contract4.wallet = disconnectedWallet;
  cheddarContractName4.wallet = disconnectedWallet;
  tokenContractName4.wallet = disconnectedWallet;

  signedOutFlow()
}

//`nearInitPromise` gets called on page load
// window.nearInitPromise = initContract()
// .then(() => {
// if (walletConnection.isSignedIn()) signedInFlow()
// else signedOutFlow()
// })
// .catch(console.error)

window.onload = async function () {
  try {

    let env = "testnet" //default
    //change to mainnet if url contains /DApp/mainnet/
    //get from url: DApp/testnet/ or DApp/mainnet/
    const parts = window.location.pathname.split("/")
    const i = parts.indexOf("DApp")
    if (i >= 0) { env = parts[i + 1] }
    if (env != nearConfig.farms[0].networkId) nearConfig = getConfig(env);

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
      document.getElementById("timer").innerHTML = "<h2><span style='color:#222'>Starts In: </span><span style='color:rgba(80,41,254,0.88)'>" + hours + "h : "
      + minutes + "m : " + seconds + "s" + "</span></h2>";

      document.getElementById("timer-non").innerHTML = "<h2><span style='color:#222'>Starts In: </span><span style='color:rgba(80,41,254,0.88)'>" + hours + "h : "
      + minutes + "m : " + seconds + "s" + "</span></h2>";
      
      // If the count down is finished, write some text
      if (distance < 0) {
        clearInterval(x);
        document.getElementById("timer").innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS LIVE!</h2>";
        document.getElementById("timer-non").innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS LIVE!</h2>";
      }
    }, 1000);

    //init contract proxy
    contract1 = new StakingPoolP1(nearConfig.farms[0].contractName);
    cheddarContractName1 = new NEP141Trait(nearConfig.farms[0].cheddarContractName);
    tokenContractName1 = new NEP141Trait(nearConfig.farms[0].tokenContractName);

    contract2 = new StakingPoolP1(nearConfig.farms[1].contractName);
    cheddarContractName2 = new NEP141Trait(nearConfig.farms[1].cheddarContractName);
    tokenContractName2 = new NEP141Trait(nearConfig.farms[1].tokenContractName);

    contract3 = new StakingPoolP1(nearConfig.farms[2].contractName);
    cheddarContractName3 = new NEP141Trait(nearConfig.farms[2].cheddarContractName);
    tokenContractName3 = new NEP141Trait(nearConfig.farms[2].tokenContractName);

    contract4 = new StakingPoolP1(nearConfig.farms[3].contractName);
    cheddarContractName4 = new NEP141Trait(nearConfig.farms[3].cheddarContractName);
    tokenContractName4 = new NEP141Trait(nearConfig.farms[3].tokenContractName);

    //console.log(nearConfig.farms[0].networkId)

    //init narwallets listeners
    narwallets.setNetwork(nearConfig.farms[0].networkId); //tell the wallet which network we want to operate on
    addNarwalletsListeners(narwalletConnected, narwalletDisconnected) //listen to narwallets events

    //set-up auto-refresh loop (10 min)
    autoRefresh()
    //set-up auto-refresh rewards *display* (5 times/sec)
    refreshRewardsDisplayLoop()
    refreshRewardsDisplayLoop2()
    // refreshRewardsDisplayLoop3()
    // refreshRewardsDisplayLoop4()
    //set-up auto-adjust rewards *display* to real rewards (once a minute)
    refreshRealRewardsLoop()
    refreshRealRewardsLoop2()
    // refreshRealRewardsLoop3()
    // refreshRealRewardsLoop4()

    //check if signed-in with NEAR Web Wallet
    await initNearWebWalletConnection()

    if (nearWebWalletConnection.isSignedIn()) {
      //already signed-in with NEAR Web Wallet
      //make the contract use NEAR Web Wallet
      wallet = new NearWebWallet(nearWebWalletConnection);

      contract1.wallet = wallet;
      cheddarContractName1.wallet = wallet;
      tokenContractName1.wallet = wallet;

      contract2.wallet = wallet;
      cheddarContractName2.wallet = wallet;
      tokenContractName2.wallet = wallet;

      contract3.wallet = wallet;
      cheddarContractName3.wallet = wallet;
      tokenContractName3.wallet = wallet;

      contract4.wallet = wallet;
      cheddarContractName4.wallet = wallet;
      tokenContractName4.wallet = wallet;

      await signedInFlow()

      //check if we're re-spawning after a wallet-redirect
      //show transaction result depending on method called
      const { err, data, method } = await checkRedirectSearchParams(nearWebWalletConnection, nearConfig.farms[0].explorerUrl || "explorer");

      if (err) {
        showError(err, "Transaction - " + method || "");
      }
      else if (method == "deposit_and_stake") {
        showSuccess("Deposit Successful")
      }
      if (method == "unstake" && data == null) {
        showSuccess("Unstaked All and Harvested Cheddar")
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
            showSuccess(`Harvested ${yton(data)} Cheddar`)
            break;
          }
          case "unstake": {
            showSuccess(`Unstaked ${yton(data)} NEAR`)
            break;
          }
          case "stake": {
            showSuccess(`Total Staked ${yton(data)} NEAR`)
            break;
          }
          default:
            showSuccess(data.toString(), "Transaction Result")
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

