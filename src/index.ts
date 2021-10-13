import { connect, Contract, keyStores, Near, WalletConnection } from 'near-api-js'
import { getConfig } from './config'

import { WalletInterface } from './wallet-api/wallet-interface';
import { disconnectedWallet } from './wallet-api/disconnected-wallet';
import { NearWebWallet } from './wallet-api/near-web-wallet/near-web-wallet';
import { narwallets, addNarwalletsListeners } from './wallet-api/narwallets/narwallets';
import { toNumber, ntoy, yton, toStringDec, toStringDecLong, toStringDecMin, ytonFull, addCommas } from './util/conversions';

import { StakingPoolP1 } from './contracts/p1-staking';
import type { ContractParams } from './contracts/contract-structs';

//qs/qsa are shortcut for document.querySelector/All
import { qs, qsa, qsi, showWait, hideWaitKeepOverlay, showErr, showSuccess, showMessage, show, hide, hidePopup, hideOverlay, qsaInnerText, showError, showPopup } from './util/document';
import { checkRedirectSearchParams } from './wallet-api/near-web-wallet/checkRedirectSearchParams';
import { computeCurrentEpoch, EpochInfo } from './util/near-epoch';
import { NEP141Trait } from './contracts/NEP141';
import { InvalidSignature } from 'near-api-js/lib/generated/rpc_error_types';

//get global config
//const nearConfig = getConfig(process.env.NODE_ENV || 'development')
let nearConfig = getConfig('mainnet'); //default testnet, can change according to URL on window.onload

// global variables used throughout
let wallet: WalletInterface = disconnectedWallet;
let contract: StakingPoolP1;
let tokenContract: NEP141Trait;

let accountInfo: string[];
let total_supply: number;
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
    contract.wallet = disconnectedWallet;
    tokenContract.wallet = disconnectedWallet;
    signedOutFlow();
  }


//Stake button. Workaround for Safari emitter issue.
qs('button#stake').onclick =
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

//Harvest button. Workaround for Safari emitter issue.
qs('button#harvest').onclick =
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
  const isStaking = (action == "stake")
  const isHarvest = (action == "harvest")
  const isUnstaking = (action == "harvest")
  showWait(isStaking ? "Staking..." : isHarvest ? "Harvesting..." : "Unstaking...")

  try {
    if (!contractParams.is_open) throw Error("pools are not open yet")
    //get amount
    const min_deposit_amount = 1;
    let amount = toNumber(stakeAmount.value);
    if (isStaking) {
      if (amount < min_deposit_amount) throw Error(`Stake at least ${min_deposit_amount} NEAR`);
      // make a call to the smart contract
      await contract.stake(amount)
    }
    else if (isHarvest) {
      if (cheddar_displayed <= 0) throw Error("no cheddar to harvest :(")
      amount = cheddar_displayed;
      await contract.withdraw_crop()
    }
    else {
      if (amount <= 0) throw Error(`Unstake a positive amount`);
      await contract.unstake(amount)
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
      staked += amount
    }
    else {
      staked -= amount
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
      let maxStake = BigInt(await wallet.getAccountBalance()) - ONE_NEAR / BigInt(100) //subtract one cent .- leave something for fee & storage
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
      var amountAvailable = toStringDec(yton(await wallet.getAccountBalance()))
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
      await contract.unstake(amountToUnstake)

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
  const near = await connect(Object.assign({ deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } }, nearConfig))

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
  contract.disconnect();
  tokenContract.disconnect();
  // reload page
  window.location.replace(window.location.origin + window.location.pathname)
}

function loginNearWebWallet() {
  // Allow the current app to make calls to the specified contract on the user's behalf.
  // This works by creating a new access key for the user's account and storing
  // the private key in localStorage.
  //save what the user typed before navigating out
  localStorage.setItem("amount", qsi("#stake-form-not-connected input.near").value)
  nearWebWalletConnection.requestSignIn(nearConfig.contractName)
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

async function refreshRealRewardsLoop() {
  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened = (contractParams.is_open && unixTimestamp >= contractParams.farming_start && unixTimestamp <= contractParams.farming_end);
  try {
    if (isOpened && wallet.isConnected()) {
      accountInfo = await contract.status()
      staked = yton(accountInfo[0]);
      qsaInnerText("#near-balance span.near.balance", toStringDec(staked))
      real = yton(accountInfo[1]);
      unixTimestamp = Number(accountInfo[2]);
      let now = unixTimestamp * 1000 //to milliseconds
      if (staked > 0) {
        qs("#near-balance a .max").style.display = "block";
        if (previous_timestamp && real > previous_real) {
          //recompute speed
          let advanced = real - previous_real
          let elapsed_ms = now - previous_timestamp
          real_rewards_per_day = (advanced * 1000 * 60 * 60 * 24) / elapsed_ms
          console.log(`real:${real} comp:${computed} real-comp:${real - computed}`);
          console.log(`real-adv:${advanced}, elapsed_ms:${elapsed_ms}, real rew x week :${real_rewards_per_day * 7}`);
        }
      }
      previous_real = real;
      previous_timestamp = now
      if (real > computed || (real > 0 && computed - real > real / 4)) { //if real is bigger or differ is >25%
        computed = real
      }
      display_cheddar(computed);
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {
    setTimeout(refreshRealRewardsLoop, 30 * 1000) // every 30 secs
  }
}

async function refreshRewardsDisplayLoop() {
  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened = (contractParams.is_open && unixTimestamp >= contractParams.farming_start && unixTimestamp <= contractParams.farming_end);
  try {
    if (isOpened && wallet.isConnected()) {
      if (previous_timestamp) {
        let elapsed_ms = Date.now() - previous_timestamp
        if (staked != 0) {
          computed = previous_real + real_rewards_per_day * elapsed_ms / (1000 * 60 * 60 * 24);
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

let cheddar_displayed: number = 0;
function display_cheddar(cheddar_amount: number) {
  qsaInnerText("#cheddar-balance", toStringDecLong(cheddar_amount))
  cheddar_displayed = cheddar_amount // so they can harvest
}

async function refreshAccountInfo() {
  try {
    let accName = wallet.getAccountId();
    if (accName.length > 22) accName = accName.slice(0, 10) + ".." + accName.slice(-10);
    qs(".user-info #account-id").innerText = accName;
    //show top-right-balance only if connected wallet
    //show(qs("#top-right-balance"), wallet.isConnected())

    let walletAvailable = toStringDec(yton(await wallet.getAccountBalance()))
    //update shown wallet balance
    qsaInnerText("#wallet-available span.near.balance", walletAvailable.split(".")[0]);
    qsaInnerText("span.bold.large.near#wallet-available", walletAvailable);


    if (Number(walletAvailable.replace(",", "")) > 1) {
      qs("#wallet-available a .max").style.display = "block";
    }

    //update account & contract stats
    if (wallet.isConnected()) {
      accountInfo = await contract.status()
      contractParams = await contract.get_contract_params()
      total_supply = yton(await tokenContract.ft_total_supply())
      staked = yton(accountInfo[0]);
      real = yton(accountInfo[1]);
      qs("#farming_start").innerText = new Date(contractParams.farming_start * 1000).toLocaleString()
      qs("#farming_end").innerText = new Date(contractParams.farming_end * 1000).toLocaleString()
      console.log(contractParams)
      qs("#total-near-staked").innerText = yton(contractParams.total_stake).toString()
      qs("#rewards-per-day").innerText = yton(contractParams.rewards_per_day).toString()
      qs("#total-rewards").innerText = yton(contractParams.total_rewards).toString()
    }
    else {
      contractParams.rewards_per_day = ntoy(10);
      accountInfo = ["0", "0"];
      staked = 0;
      real = 0;
    }
    let cheddarPerWeekThisUser = Math.round(yton(BigInt(contractParams.rewards_per_day).toString()) * 7 * staked * 100) / 100;
    let cheddarPerWeekString = `${cheddarPerWeekThisUser} Cheddar/week`;
    qsaInnerText("#cheddar-rate", cheddarPerWeekString)
    real_rewards_per_day = cheddarPerWeekThisUser / 7;

    qsaInnerText("#near-balance span.near.balance", toStringDec(staked))
    if (staked > 0) {
      qs("#near-balance a .max").style.display = "block";
    }
    display_cheddar(real); // display real rewards so they can harvest
    computed = real;
    previous_timestamp = Date.now();
    previous_real = real;

    qsaInnerText("#total-cheddar-tokens", toStringDec(total_supply))

  }
  catch (ex) {
    showErr(ex)
  }
}

/// when the user chooses "connect to web-page" in the narwallets-chrome-extension
function narwalletConnected(ev: CustomEvent) {
  wallet = narwallets;
  contract.wallet = narwallets; //set the contract to use narwallets
  tokenContract.wallet = narwallets; //set the contract to use narwallets
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
  contract.wallet = disconnectedWallet;
  tokenContract.wallet = disconnectedWallet;
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

    let env = "mainnet" //default
    //change to mainnet if url contains /DApp/mainnet/
    //get from url: DApp/testnet/ or DApp/mainnet/
    const parts = window.location.pathname.split("/")
    const i = parts.indexOf("DApp")
    if (i >= 0) { env = parts[i + 1] }
    if (env != nearConfig.networkId) nearConfig = getConfig(env);


    //init contract proxy
    contract = new StakingPoolP1(nearConfig.contractName);
    tokenContract = new NEP141Trait(nearConfig.tokenContractName);

    //init narwallets listeners
    narwallets.setNetwork(nearConfig.networkId); //tell the wallet which network we want to operate on
    addNarwalletsListeners(narwalletConnected, narwalletDisconnected) //listen to narwallets events

    //set-up auto-refresh loop (10 min)
    autoRefresh()
    //set-up auto-refresh rewards *display* (5 times/sec)
    refreshRewardsDisplayLoop()
    //set-up auto-adjust rewards *display* to real rewards (once a minute)
    refreshRealRewardsLoop()

    //check if signed-in with NEAR Web Wallet
    await initNearWebWalletConnection()

    if (nearWebWalletConnection.isSignedIn()) {
      //already signed-in with NEAR Web Wallet
      //make the contract use NEAR Web Wallet
      wallet = new NearWebWallet(nearWebWalletConnection);
      contract.wallet = wallet;
      tokenContract.wallet = wallet;

      await signedInFlow()

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
      
      console.log(now)
      console.log(contractParams.farming_start*1000)
      // If the count down is finished, write some text
      if(now > (contractParams.farming_start * 1000)) {
        clearInterval(x);
        document.getElementById("timer").innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS CLOSED!</h2>";
        document.getElementById("timer-non").innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS CLOSED!</h2>";
      }
      else if (distance < 0) {
        clearInterval(x);
        document.getElementById("timer").innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS LIVE!</h2>";
        document.getElementById("timer-non").innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS LIVE!</h2>";
      }
    }, 1000);

      //check if we're re-spawning after a wallet-redirect
      //show transaction result depending on method called
      const { err, data, method } = await checkRedirectSearchParams(nearWebWalletConnection, nearConfig.explorerUrl || "explorer");

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

