import { connect, Contract, keyStores, Near, WalletConnection } from 'near-api-js'
import { getConfig } from './config'

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
import { HtmlPoolParams, PoolParams } from './entities/poolParams';
import { getPoolList } from './objects/poolList';
// import { PoolHtmlParams } from './entities/htmlPoolParams';

//get global config
//const nearConfig = getConfig(process.env.NODE_ENV || 'development')
export let nearConfig = getConfig('testnet'); //default testnet, can change according to URL on window.onload

// global variables used throughout
export let wallet: WalletInterface = disconnectedWallet;

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
  farming_rate: ntoy(10),
  is_active: false,
  farming_start: 0,
  farming_end: 0,
  total_farmed: "0",
  total_staked: "0"
}

let contractParams2: ContractParams = {
  owner_id: "",
  token_contract: "cheddar.token",
  farming_rate: ntoy(10),
  is_active: false,
  farming_start: 0,
  farming_end: 0,
  total_farmed: "0",
  total_staked: "0"
}

let contractParams3: ContractParams = {
  owner_id: "",
  token_contract: "cheddar.token",
  farming_rate: ntoy(10),
  is_active: false,
  farming_start: 0,
  farming_end: 0,
  total_farmed: "0",
  total_staked: "0"
}

let contractParams4: ContractParams = {
  owner_id: "",
  token_contract: "cheddar.token",
  farming_rate: ntoy(10),
  is_active: false,
  farming_start: 0,
  farming_end: 0,
  total_farmed: "0",
  total_staked: "0"
}

let metaData: TokenParams = {
  decimals: "24",
  icon: "",
  name: "",
  reference: "",
  reference_hash: "",
  spec: "",
  symbol: "",
}

let metaData2: TokenParams = {
  decimals: "24",
  icon: "",
  name: "",
  reference: "",
  reference_hash: "",
  spec: "",
  symbol: "",
}


let metaData3: TokenParams = {
  decimals: "24",
  icon: "",
  name: "",
  reference: "",
  reference_hash: "",
  spec: "",
  symbol: "",
}


let metaData4: TokenParams = {
  decimals: "24",
  icon: "",
  name: "",
  reference: "",
  reference_hash: "",
  spec: "",
  symbol: "",
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
// qs('button#stake').onclick =
//   async function (event: Event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement

//     submitForm((event.target as HTMLElement).id, button.form)
//   }
function stakeClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function(event: Event) {
    event.preventDefault()
    // var buttonId = 'button#' + (event.target as HTMLElement).id
    // var button = qs(buttonId) as HTMLButtonElement

    submitForm("stake", poolParams, pool.getElementsByTagName("form")[0])
  }  
}

// qs('button#stakeREF').onclick =
//   async function (event: Event) {
//   event.preventDefault()
//   var buttonId = 'button#' + (event.target as HTMLElement).id
//   var button = qs(buttonId) as HTMLButtonElement

//   submitForm((event.target as HTMLElement).id, button.form)
// }

// qs('button#stakeSTNEAR').onclick =
//   async function (event: Event) {
//   event.preventDefault()
//   var buttonId = 'button#' + (event.target as HTMLElement).id
//   var button = qs(buttonId) as HTMLButtonElement

//   submitForm((event.target as HTMLElement).id, button.form)
// }

// qs('button.submitForm').onclick =
//   async function (event: Event) {
//   event.preventDefault()
//   var buttonId = 'button#' + (event.target as HTMLElement).id
//   var button = qs(buttonId) as HTMLButtonElement

//   submitForm((event.target as HTMLElement).id, button.form)
// }


// qs('button#stakeBanana').onclick =
//   async function (event: Event) {
//   event.preventDefault()
//   var buttonId = 'button#' + (event.target as HTMLElement).id
//   var button = qs(buttonId) as HTMLButtonElement

//   submitForm((event.target as HTMLElement).id, button.form)
// }

// async function unstakeClicked(event: Event) {
//   event.preventDefault()
//   var buttonId = 'button#' + (event.target as HTMLElement).id
//   var button = qs(buttonId) as HTMLButtonElement

//   submitForm((event.target as HTMLElement).id, button.form)
// }

function unstakeClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function(event: Event) {
    event.preventDefault()
    // var buttonId = 'button#' + (event.target as HTMLElement).id
    // var button = qs(buttonId) as HTMLButtonElement

    submitForm("unstake", poolParams, pool.getElementsByTagName("form")[0])
  }  
}


// LISTENERS
//UnStake button. Workaround for Safari emitter issue.
// qs('button#unstake').onclick =
//   async function (event: Event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement

//     submitForm((event.target as HTMLElement).id, button.form)
//   }

// qs('button#unstakeREF').onclick =
//   async function (event: Event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement

//     submitForm((event.target as HTMLElement).id, button.form)
//   }

// qs('button#unstakeSTNEAR').onclick =
//   async function (event: Event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement

//     submitForm((event.target as HTMLElement).id, button.form)
//   }

// qs('button#unstakeBanana').onclick =
//   async function (event: Event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement

//     submitForm((event.target as HTMLElement).id, button.form)
//   }


//Harvest button. Workaround for Safari emitter issue.
// qs('button#harvest').onclick =
//   async function (event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement
//     //console.log(button)
//     submitForm((event.target as HTMLElement).id, button.form)
//   }

async function harvestClicked(event: Event) {
  event.preventDefault()
  var buttonId = 'button#' + (event.target as HTMLElement).id
  var button = qs(buttonId) as HTMLButtonElement
  //console.log(button)
  submitForm((event.target as HTMLElement).id, button.form)
}

// qs('button#harvestREF').onclick =
//   async function (event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement
//     //console.log(button)
//     submitForm((event.target as HTMLElement).id, button.form)
//   }

// qs('button#harvestSTNEAR').onclick =
//   async function (event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement
//     //console.log(button)
//     submitForm((event.target as HTMLElement).id, button.form)
//   }

// qs('button#harvestBanana').onclick =
//   async function (event) {
//     event.preventDefault()
//     var buttonId = 'button#' + (event.target as HTMLElement).id
//     var button = qs(buttonId) as HTMLButtonElement
//     //console.log(button)
//     submitForm((event.target as HTMLElement).id, button.form)
//   }

//Form submission
//qs('form#stake').onsubmit =
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
  //const isUnstaking = (action == "harvest" || action == "harvestREF" || action == "harvestSTNEAR" || action == "harvestBanana")
  showWait(isStaking ? "Staking..." : isHarvest ? "Harvesting..." : "Unstaking...")

  try {
    let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
    

    //get amount
    const min_deposit_amount = 1;
    let amount: number = stakeAmount.value;

    if (isStaking) {
      if (!contractParams.is_active) throw Error("Pool is closed to staking.")
      if (amount < min_deposit_amount) throw Error(`Stake at least ${min_deposit_amount} NEAR`);
      await poolParams.tokenContract.ft_transfer_call(poolParams.tokenContract.contractId, convertToBase(stakeAmount.value, poolParams.metaData.decimals.toString()), "to farm")
      // make a call to the smart contract
      // switch (form.id) {
      //     case "ref": {
      //       await tokenContractName2.ft_transfer_call("p2-ref.cheddar.testnet", convertToBase(stakeAmount.value, metaData2.decimals), "to farm")
      //       break;
      //     }
      //     case "stNEAR": {
      //       await tokenContractName3.ft_transfer_call("p2-meta.cheddar.testnet", convertToBase(stakeAmount.value, metaData3.decimals), "to farm")
      //       break;
      //     }
      //     case "banana": {
      //       await tokenContractName4.ft_transfer_call("p2-bananas.cheddar.testnet", convertToBase(stakeAmount.value, metaData4.decimals), "to farm")
      //       break;
      //     }
      //     case "afi": {
      //       await tokenContractName1.ft_transfer_call("p2-v1-tt.cheddar.testnet", convertToBase(stakeAmount.value, metaData.decimals), "to farm")
      //       break;
      //     }
      // }

    }
    else if (isHarvest) {
      
      amount = poolParams.resultParams.getCurrentCheddarRewards()
      if (amount <= 0) throw Error("no cheddar to harvest :(")
      await poolParams.contract.withdraw_crop()
      // switch (form.id) {
        
      //   case "ref": {
      //     if (cheddar_displayed2 <= 0) throw Error("no cheddar to harvest :(")
      //     amount = cheddar_displayed2;
      //     await contract2.withdraw_crop()
      //     break;
      //   }
      //   case "stNEAR": {
      //     if (cheddar_displayed3 <= 0) throw Error("no cheddar to harvest :(")
      //     amount = cheddar_displayed3;
      //     await contract3.withdraw_crop()
      //     break;
      //   }
      //   case "banana": {
      //     if (cheddar_displayed4 <= 0) throw Error("no cheddar to harvest :(")
      //     amount = cheddar_displayed4;
      //     await contract4.withdraw_crop()
      //     break;
      //   }
      //   case "afi": {
      //     if (cheddar_displayed <= 0) throw Error("no cheddar to harvest :(")
      //     amount = cheddar_displayed;
      //     await contract1.withdraw_crop()
      //     break;
      //   }
      // }

    }
    else {
      console.log(amount.toString())
      console.log("Decimal: ", poolParams.metaData.decimals)
      if (amount <= 0) throw Error(`Unstake a positive amount`);
      // amount = 1000000000000000000000000
      await poolParams.contract.unstake(convertToBase(amount.toString(), poolParams.metaData.decimals.toString()))
      // await poolParams.contract.unstake(amount)
      // switch (form.id) {
      //   case "ref": {
      //     await contract2.unstake(toNumber(convertToBase(amount, metaData2.decimals)))
      //     break;
      //   }
      //   case "stNEAR": {
      //     await contract3.unstake(toNumber(convertToBase(amount, metaData3.decimals)))
      //     break;
      //   }
      //   case "banana": {
      //     console.log(amount)
      //     console.log(convertToBase(amount, metaData4.decimals))
      //     await contract4.unstake(toNumber(convertToBase(amount, metaData4.decimals)))
      //     break;
      //   }
      //   case "afi": {
      //     await contract1.unstake(toNumber(convertToBase(amount, metaData.decimals)))
      //     break;
      //   }
      // }
    }

    //clear form
    form.reset()

    //refresh acc info
    const poolList = await getPoolList(wallet);
    await refreshAccountInfoGeneric(poolList)

    showSuccess((isStaking ? "Staked " : isHarvest ? "Harvested " : "Unstaked ") + toStringDecMin(amount) + (isHarvest ? " CHEDDAR" : " NEAR"))
    
    if (isHarvest) {
      poolParams.resultParams.computed = "1"
      poolParams.resultParams.real = "1"
      // display_cheddar("0", "refPool");
      // switch (form.id) {
      //   case "refPool": {
      //     computed2 = 1;
      //     real2 = 1;
      //     // display_cheddar("0", "refPool");
      //     break;
      //   }
      //   case "stNEARPool": {
      //     computed3 = 1;
      //     real3 = 1;
      //     // display_cheddar("0", "stNEARPool");
      //     break;
      //   }
      //   case "bananaPool": {
      //     computed4 = 1;
      //     real4 = 1;
      //     // display_cheddar("0", "bananaPool");
      //     break;
      //   }
      //   case "afiPool": {
      //     computed = 1;
      //     real = 1;
      //     // display_cheddar("0", 'afiPool');
      //     break;
      //   }
      // }

    }
    else if (isStaking) {
      poolParams.resultParams.addStaked(amount);
      // switch (form.id) {
      //   case "refPool": {
      //     staked2 += amount
      //     break;
      //   }
      //   case "stNEARPool": {
      //     staked3 += amount
      //     break;
      //   }
      //   case "bananaPool": {
      //     staked4 += amount
      //     break;
      //   }
      //   case "afiPool": {
      //     staked += amount
      //     break;
      //   }
      // }
    }
    else {
      poolParams.resultParams.addStaked(-amount);
      // switch (form.id) {
      //   case "refPool": {
      //     staked2 -= amount
      //     break;
      //   }
      //   case "stNEARPool": {
      //     staked3 -= amount
      //     break;
      //   }
      //   case "bananaPool": {
      //     staked4 -= amount
      //     break;
      //   }
      //   case "afiPool": {
      //     staked -= amount
      //     break;
      //   }
      // }
    }

  }
  catch (ex) {
    showErr(ex)
  }

  // re-enable the form, whether the call succeeded or failed
  fieldset.disabled = false
}

//button stake max 
// qs('section#home-connected #max').onclick = stakeMaxClick;
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

// qs('a#terms-of-use').onclick =
//   async function (event) {
//     event.preventDefault()
//     showPopup("#terms.popup")
//   }

// qs('#wallet-available a .max').onclick =
//   async function (event) {
//     try {
//       event.preventDefault()
//       var amountAvailable = toStringDec(yton(await tokenContractName1.ft_balance_of(accName)))
//       //console.log()
//       qsi("#stakeAmount").value = parseInt(amountAvailable.replace(",", "")).toString()
//     }
//     catch (ex) {
//       showErr(ex)
//     }
//   }

// qs('#near-balance a .max').onclick =
//   async function (event) {
//     try {
//       event.preventDefault()
//       qsi("#stakeAmount").value = (yton(accountInfo[0])).toString()
//     }
//     catch (ex) {
//       showErr(ex)
//     }
//   }

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

      // make a call to the smart contract
      await contract1.unstake(amountToUnstake)
      await contract2.unstake(amountToUnstake)
      await contract3.unstake(amountToUnstake)
      await contract4.unstake(amountToUnstake)

      //clear form
      form.reset()

      //refresh acc info
      const poolList = await getPoolList(wallet);
      await refreshAccountInfoGeneric(poolList)

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
      await refreshPoolInfo()
    }
    catch (ex) {
      //console.log("auto-refresh: " + ex.message)
    }
  }
  // setTimeout(autoRefresh, 10 * MINUTES)
  //console.log("auto-refresh")
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
  addPoolList(poolList)
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
      qsaInnerText("#afiPool #near-balance span.near.balance", convertToDecimals(staked, metaData.decimals,2))
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
          //console.log(`advanced:${advanced} real:${real} prev-real:${previous_real} rewards-per-day:${real_rewards_per_day}  comp:${computed} real-comp:${real - computed} eslapsed-ms:${elapsed_ms}`);
          //console.log(`real-adv:${advanced}, elapsed_ms:${elapsed_ms}, real rew x week :${real_rewards_per_day * 7}`);
        }
      }
      previous_real = real;
      previous_timestamp = now
      if (real > computed || (real > 0 && computed - real > real / 4)) { //if real is bigger or differ is >25%
        computed = real
      }
      console.log(computed)
      // display_cheddar(computed, "afiPool");
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
      //console.log(timeRemaining)
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
      // console.log(accountInfo2)
      // console.log(staked2)
      // qsaInnerText("#refPool #near-balance span.near.balance", convertToDecimals(staked2, metaData2.decimals,2))
      real2 = accountInfo2[1];
      unixTimestamp2 = Number(accountInfo2[2]);
      let now2 = unixTimestamp2 * 1000 //to milliseconds
      var lastBlockTime2 = unixTimestamp2 * 1000;

      if( (unixTimestamp2 * 1000) > Date.now() ) {
        now2 = Date.now()
      }

      if (staked2 > 0) {
        // qs("#refPool #near-balance a .max").style.display = "block";
        if (previous_timestamp2 && real2 > previous_real2) {
          //recompute speed
          let advanced2 = yton(real2) - yton(previous_real2)
          let elapsed_ms2 = now2 - previous_timestamp2
          real_rewards_per_day2 = (advanced2 * 60 * 24)
          //console.log(`advanced:${advanced2} real:${real2} prev-real:${previous_real2} rewards-per-day:${real_rewards_per_day2}  comp:${computed2} real-comp:${real2 - computed2} eslapsed-ms:${elapsed_ms2}`);
          //console.log(`real-adv:${advanced2}, elapsed_ms:${elapsed_ms2}, real rew x week :${real_rewards_per_day2 * 7}`);
        }
      }
      previous_real2 = real2;
      previous_timestamp2 = now2
      if (real2 > computed2 || (real2 > 0 && computed2 - real2 > real2 / 4)) { //if real is bigger or differ is >25%
        computed2 = real2
      }
      //console.log(computed2)
      // display_cheddar(computed2, "refPool");
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
      //console.log(timeRemaining2)
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
      console.log(accountInfo3)
      staked3 = accountInfo3[0];
      qsaInnerText("#stNear #near-balance span.near.balance", convertToDecimals(staked3, metaData3.decimals,2))
      real3 = accountInfo3[1];
      unixTimestamp3 = Number(accountInfo3[2]);
      let now3 = unixTimestamp3 * 1000 //to milliseconds
      var lastBlockTime3 = unixTimestamp3 * 1000;

      if( (unixTimestamp3 * 1000) > Date.now() ) {
        now3 = Date.now()
      }

      if (staked3 > 0) {
        qs("#stNEARPool #near-balance a .max").style.display = "block";
        if (previous_timestamp3 && real3 > previous_real3) {
          //recompute speed
          let advanced3 = yton(real3) - yton(previous_real3)
          let elapsed_ms3 = now3 - previous_timestamp3
          real_rewards_per_day3 = (advanced3 * 60 * 24)
          //console.log(`now: ${now3}, previous_timestamp: ${previous_timestamp3}, advanced:${advanced3} real:${real3} prev-real:${previous_real3} rewards-per-day:${real_rewards_per_day3}  comp:${computed3} real-comp:${real3 - computed3} eslapsed-ms:${elapsed_ms3}`);
          //console.log(`real-adv:${advanced3}, elapsed_ms:${elapsed_ms3}, real rew x week :${real_rewards_per_day3 * 7}`);
        }
      }
      previous_real3 = real3;
      previous_timestamp3 = now3
      if (yton(real3) > computed3 || (real3 > 0 && computed3 - yton(real3) > yton(real3) / 2)) { //if real is bigger or differ is >25%
        computed3 = real3
      }
      // display_cheddar(computed3, "stNEARPool");
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

/**
 * Gets the actual values from the contract and replaces the computed values on the UI (and on the corresponding 
 * object) if it's greater than 4 times
 * @param poolParams 
 */
async function refreshRealRewardsLoopGeneric(poolParams: PoolParams) {

  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened = (poolParams.contractParams.is_active && unixTimestamp >= poolParams.contractParams.farming_start && unixTimestamp <= poolParams.contractParams.farming_end);
  let accName = poolParams.resultParams.accName
  try {

    if (isOpened && wallet.isConnected()) {

      let accountInfo = await poolParams.contract.status(accName)
      console.log(accountInfo)
      poolParams.resultParams.staked = accountInfo[0];
      let stakedWithDecimals = convertToDecimals(poolParams.resultParams.staked, poolParams.metaData.decimals, 2)
      let real = accountInfo[1];
      let computed = poolParams.resultParams.computed
      // let previousReal = poolParams.resultParams.previous_real;
      unixTimestamp = Number(accountInfo[2]);
      // let now = unixTimestamp * 1000 //to milliseconds
      // let previousTimeStamp = poolParams.resultParams.previous_timestamp
      // var lastBlockTime = unixTimestamp * 1000;
      let now = Date.now()
      // if( now > Date.now() ) {
      //   now = Date.now()
      // }
      if (Number(poolParams.resultParams.staked) > 0) {
        qs("#" + poolParams.html.id + " #near-balance a .max").style.display = "block";
        if (poolParams.resultParams.previous_timestamp && yton(real) > yton(poolParams.resultParams.previous_real)) {
          //recompute speed
          let advanced = yton(real) - yton(poolParams.resultParams.previous_real)
          
          poolParams.resultParams.real_rewards_per_day = (advanced * 60 * 24)
          console.log("New rewards_per_day: ", poolParams.resultParams.real_rewards_per_day)
        }
      }
      
      poolParams.resultParams.previous_real = real;
      poolParams.resultParams.real = real;
      poolParams.resultParams.previous_timestamp = now
      if (yton(real) > yton(computed) || (yton(real) > 0 && yton(computed) - yton(real) > yton(real) / 2)) { //if real is bigger or differ is >25%
        poolParams.resultParams.computed = real
      }
      console.log("Computed: ", poolParams.resultParams.computed)
      console.log("Real: ", poolParams.resultParams.real)
      
      qsInnerText("#" + poolParams.html.id + " #near-balance span.near.balance", stakedWithDecimals)
      qsInnerText("#" + poolParams.html.id + " #cheddar-balance", poolParams.resultParams.getDisplayableComputed())
    }
  } catch (ex) {
    console.error(ex);
  }
  finally {

    // let timeRemaining3 = 60;

    // if (isOpened3 && wallet.isConnected()) {

    //   let timePassed3 = (Date.now()-(unixTimestamp3*1000))/1000
    //   timeRemaining3 = 61.3 - timePassed3;
    //   timeRemaining3 = (timeRemaining3 > 0) ? timeRemaining3 : timeRemaining3 + 2
    //   console.log(timeRemaining3)
    // }

    // setTimeout(refreshRealRewardsLoop3, timeRemaining3 * 1000) // every 60 secs
  }
}

async function refreshRealRewardsLoop4() {

  let unixTimestamp4 = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened4 = (contractParams4.is_active && unixTimestamp4 >= contractParams4.farming_start && unixTimestamp4 <= contractParams4.farming_end);

  try {

    if (isOpened4 && wallet.isConnected()) {

      accountInfo4 = await contract4.status()
      staked4 = accountInfo4[0];
      // qsaInnerText("#bananaPool #near-balance span.near.balance", convertToDecimals(staked4, metaData4.decimals,2))
      real4 = accountInfo4[1];
      unixTimestamp4 = Number(accountInfo4[2]);
      let now4 = unixTimestamp4 * 1000 //to milliseconds
      var lastBlockTime4 = unixTimestamp4 * 1000;

      if( (unixTimestamp4 * 1000) > Date.now() ) {
        now4 = Date.now()
      }

      if (staked4 > 0) {
        // qs("#bananaPool #near-balance a .max").style.display = "block";
        if (previous_timestamp4 && real4 > previous_real4) {
          //recompute speed
          let advanced4 = yton(real4) - yton(previous_real4)
          let elapsed_ms4 = now4 - previous_timestamp4
          real_rewards_per_day4 = (advanced4 * 60 * 24)
          console.log(`advanced:${advanced4} real:${real4} prev-real:${previous_real4} rewards-per-day:${real_rewards_per_day4}  comp:${computed4} real-comp:${real4 - computed4} eslapsed-ms:${elapsed_ms4}`);
          //console.log(`real-adv:${advanced4}, elapsed_ms:${elapsed_ms4}, real rew x week :${real_rewards_per_day4 * 7}`);
        }
      }
      previous_real4 = real4;
      previous_timestamp4 = now4
      if (real4 > computed4 || (real4 > 0 && computed4 - real4 > real4 / 2)) { //if real is bigger or differ is >25%
        computed4 = real4
      }
      // display_cheddar(computed4, "bananaPool");
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
      //console.log(timeRemaining4)
    }

    setTimeout(refreshRealRewardsLoop4, timeRemaining4 * 1000) // every 60 secs
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
          //console.log(`date_now:${Date.now()}, round_timestamp:${previous_timestamp3}, rewards:${rewards3}, computed:${computed3}, previous_real:${yton(previous_real3)}, real_rewards_per_day :${real_rewards_per_day3}, elapsed_ms:${elapsed_ms3}`);
          // display_cheddar(computed3, "stNEARPool");
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

async function refreshRewardsDisplayLoopGeneric(poolParams: PoolParams) {
  
  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  let isOpened = (poolParams.contractParams.is_active && unixTimestamp >= poolParams.contractParams.farming_start && unixTimestamp <= poolParams.contractParams.farming_end);
  try {
    if (isOpened && wallet.isConnected()) {
      let previousTimestamp = poolParams.resultParams.previous_timestamp;
      let elapsed_ms = Date.now() - previousTimestamp
      if (toNumber(poolParams.resultParams.staked) != 0) {
        
        var rewards = (poolParams.resultParams.real_rewards_per_day * elapsed_ms / (1000 * 60 * 60 * 24));
        poolParams.resultParams.computed = ntoy(yton(poolParams.resultParams.previous_real) + rewards)
        
        qsInnerText("#" + poolParams.html.id + " #cheddar-balance", poolParams.resultParams.getDisplayableComputed());
      }
      
      poolParams.resultParams.previous_timestamp = Date.now()
    }
  } catch (ex) {
    console.error(ex);
  }
  // finally {
  //   setTimeout(refreshRewardsDisplayLoop3, 200) // 5 times a second
  // }
}

// async function refreshRewardsDisplayLoop4() {
//   let unixTimestamp4 = new Date().getTime() / 1000; //unix timestamp (seconds)
//   let isOpened4 = (contractParams4.is_active && unixTimestamp4 >= contractParams4.farming_start && unixTimestamp4 <= contractParams4.farming_end);
//   try {
//     if (isOpened4 && wallet.isConnected()) {
//       if (previous_timestamp4) {
//         let elapsed_ms4 = Date.now() - previous_timestamp4
//         if (staked4 != 0) {
//           var rewards4 = (real_rewards_per_day4 * elapsed_ms4 / (1000 * 60 * 60 * 24));
//           computed4 = (yton(previous_real4) + rewards4)
//           //console.log(`date_now:${Date.now()}, round_timestamp:${previous_timestamp4}, rewards:${rewards4}, computed:${computed4}, previous_real:${yton(previous_real4)}, real_rewards_per_day :${real_rewards_per_day4}, elapsed_ms:${elapsed_ms4}`);
//           // display_cheddar(computed4, "bananaPool");
//         }
//       }
//     }
//   } catch (ex) {
//     console.error(ex);
//   }
//   finally {
//     setTimeout(refreshRewardsDisplayLoop4, 200) // 5 times a second
//   }
// }

let cheddar_displayed: number = 0;
let cheddar_displayed2: number = 0;
let cheddar_displayed3: number = 0;
let cheddar_displayed4: number = 0;

// function display_cheddar(cheddar_amount: string, poolId: string) {
//   // let humanReadableValue = yton(cheddar_amount)
//   console.log("Displaying cheddar: ", poolId, cheddar_amount)
//   qsaInnerText("#" + poolId + " #cheddar-balance", toStringDec(Number(cheddar_amount)));
//   // switch (pool) {
//   //   case "refPool": {
//   //     qsaInnerText("#refPool #cheddar-balance", toStringDec(cheddar_amount));
//   //     cheddar_displayed2 = cheddar_amount;
//   //     break;
//   //   }
//   //   case "stNEARPool": {
//   //     qsaInnerText("#stNEARPool #cheddar-balance", toStringDec(cheddar_amount));
//   //     cheddar_displayed3 = cheddar_amount;
//   //     break;
//   //   }
//   //   case "bananaPool": {
//   //     qsaInnerText("#bananaPool #cheddar-balance", toStringDec(cheddar_amount));
//   //     cheddar_displayed4 = cheddar_amount;
//   //   }
//   //   case "afiPool": {
//   //     qsaInnerText("#afiPool #cheddar-balance", toStringDec(cheddar_amount));
//   //     cheddar_displayed = cheddar_amount;
//   //     break;
//   //   }
//   // }

// }

async function refreshPoolInfo(poolParams: PoolParams) {
  poolParams.resultParams.accName = poolParams.contract.wallet.getAccountId();
  let accName = poolParams.resultParams.accName
  // Modify this so it's done only once
  qs(".user-info #account-id").innerText = poolParams.resultParams.getDisplayableAccountName();
  //show top-right-balance only if connected wallet
  //show(qs("#top-right-balance"), wallet.isConnected())

  let walletAvailable = toStringDec(yton(await poolParams.cheddarContract.ft_balance_of(poolParams.resultParams.accName)))
  // //update shown wallet balance
  // qsaInnerText("#afiPool #wallet-available span.near.balance", removeDecZeroes(walletAvailable));
  qsaInnerText("#" + poolParams.html.id + " #wallet-available", walletAvailable);
  

  // if (Number(walletAvailable.replace(",", "")) > 1) {
  //   qs("#wallet-available a .max").style.display = "block";
  // }

  //update account & contract stats
  if (wallet.isConnected()) {

    let accountRegistred = await poolParams.contract.storageBalance()

    if(accountRegistred == null) {

      let storageDepost = await poolParams.contract.storageDeposit()
    }
    let metaData = await poolParams.metaData;

    let tokenDecimals = metaData.decimals;

    // var tokenNames = qsa("#afiPool .token-name");


    // tokenNames.forEach.call(tokenNames, function(tokenName) {
    //   // do whatever
    //    tokenName.innerText = metaData.symbol.toUpperCase();
    // });

    let accountInfo = await poolParams.contract.status(accName)
    

    let contractParams = await poolParams.contract.get_contract_params()
    let total_supply = yton(await poolParams.tokenContract.ft_total_supply())
    let staked = accountInfo[0];
    let real = accountInfo[1];

    
    // Check later Calcifer
    // qs("#afiPool #farming_start").innerText = new Date(contractParams.farming_start * 1000).toLocaleString()
    // qs("#afiPool #farming_end").innerText = new Date(contractParams.farming_end * 1000).toLocaleString()


    qs("#pool-stats #total-staked").innerText = convertToDecimals(contractParams.total_staked, Number(metaData.decimals), 5) + " " + metaData.symbol.toUpperCase()
    qs("#pool-stats #rewards-per-day").innerText = (yton(contractParams.farming_rate) * 60 * 24).toString()
    qs("#pool-stats #total-rewards").innerText = (ytonFull(contractParams.total_farmed))


  }
  else {
    poolParams.contractParams.rewards_per_day = ntoy(10);
    accountInfo = ["0", "0"];
    staked = 0;
    real = 0; 
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

  signedOutFlow(wallet)
}

async function addPool(poolParams: PoolParams): Promise<void> {
  var genericPoolElement = qs("#genericPool") as HTMLElement;
  let accName = poolParams.resultParams.accName
  var metaData = poolParams.metaData;
  var contractParams = poolParams.contractParams;
  var accountInfo = await poolParams.contract.status(accName);
  poolParams.resultParams.staked = accountInfo[0]
  poolParams.resultParams.real = accountInfo[1]
  poolParams.resultParams.previous_real = accountInfo[1]
  poolParams.resultParams.computed = accountInfo[1]
  poolParams.resultParams.previous_timestamp = Number(accountInfo[2])

  var newPool = genericPoolElement.cloneNode(true) as HTMLElement; 
  newPool.setAttribute("id", poolParams.html.id);
  newPool.setAttribute("style", "");
  newPool.querySelector("form")?.setAttribute("id", poolParams.html.formId);
  newPool.querySelector("#token-header span.name")!.innerHTML = metaData.name;

  let iconElem = newPool.querySelector("#token-header img")
  if(metaData.icon != null) {
    iconElem!.setAttribute("src", metaData.icon || "");
  } else {
    var iconImage = document.createElement('span');
    iconImage.classList.add('icon');

    iconElem?.parentNode?.replaceChild(iconImage, iconElem);
  }

  newPool.querySelector("#" + poolParams.html.formId +  " .token-name")!.innerHTML = metaData.symbol;
  newPool.querySelector("#farming_start")!.innerHTML = new Date(contractParams.farming_start * 1000).toLocaleString()
  newPool.querySelector("#farming_end")!.innerHTML = new Date(contractParams.farming_end * 1000).toLocaleString()

  
  newPool.querySelector("#near-balance span.near.balance")!.innerHTML =  convertToDecimals(poolParams.resultParams.staked, metaData.decimals, 2)
  let humanReadableValue = yton(poolParams.resultParams.real)
  newPool.querySelector("#cheddar-balance")!.innerHTML = toStringDec(humanReadableValue);

  let walletAvailable = toStringDec(yton(await poolParams.tokenContract.ft_balance_of(accName)))
  //update shown wallet balance
  newPool.querySelector("#wallet-available span.near.balance")!.innerHTML = removeDecZeroes(walletAvailable);
  // newPool.querySelector("span.bold.large.near#wallet-available")!.innerHTML = walletAvailable;

  if (Number(walletAvailable.replace(".", "")) > 1) {
    let elem = newPool.querySelector("#wallet-available a .max") as HTMLElement
    elem.style.display = "block";
  }

  newPool.querySelector("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_staked, metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
  newPool.querySelector("#pool-stats #rewards-per-day")!.innerHTML = yton((BigInt(contractParams.farming_rate) * BigInt(60) * BigInt(24)).toString()).toString();
  newPool.querySelector("#pool-stats #total-rewards")!.innerHTML = (ytonFull(contractParams.total_farmed));
  
  newPool.querySelector("#harvest")?.addEventListener("click", harvestClicked);
  newPool.querySelector("#stake")?.addEventListener("click", stakeClicked(poolParams, newPool));
  newPool.querySelector("#unstake")?.addEventListener("click", unstakeClicked(poolParams, newPool));

  qs("#pool_list").appendChild(newPool);
  // refreshRewardsDisplayLoopGeneric(poolParams)
  setInterval(refreshRewardsDisplayLoopGeneric.bind(null, poolParams), 200);
  setInterval(refreshRealRewardsLoopGeneric.bind(null, poolParams), 60 * 1000);

  
  
}

async function addPoolList(poolList: Array<PoolParams>) {
  qs("#pool_list").innerHTML = ""
  poolList.forEach(element => {
    addPool(element);
  });
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
    // contract1 = new StakingPoolP1(nearConfig.farms[0].contractName);
    // cheddarContractName1 = new NEP141Trait(nearConfig.farms[0].cheddarContractName);
    // tokenContractName1 = new NEP141Trait(nearConfig.farms[0].tokenContractName);
    // const afiPoolHtml = new HtmlPoolParams("afipooldiv", "afiPool");
    // const afiPoolParams = new PoolParams(afiPoolHtml, contract1, cheddarContractName1, tokenContractName1);
    // addPool(afiPoolParams);

    // contract2 = new StakingPoolP1(nearConfig.farms[1].contractName);
    // cheddarContractName2 = new NEP141Trait(nearConfig.farms[1].cheddarContractName);
    // tokenContractName2 = new NEP141Trait(nearConfig.farms[1].tokenContractName);

    // contract3 = new StakingPoolP1(nearConfig.farms[2].contractName);
    // cheddarContractName3 = new NEP141Trait(nearConfig.farms[2].cheddarContractName);
    // tokenContractName3 = new NEP141Trait(nearConfig.farms[2].tokenContractName);

    // contract4 = new StakingPoolP1(nearConfig.farms[3].contractName);
    // cheddarContractName4 = new NEP141Trait(nearConfig.farms[3].cheddarContractName);
    // tokenContractName4 = new NEP141Trait(nearConfig.farms[3].tokenContractName);

    ////console.log(nearConfig.farms[0].networkId)

    //init narwallets listeners
    narwallets.setNetwork(nearConfig.farms[0].networkId); //tell the wallet which network we want to operate on
    addNarwalletsListeners(narwalletConnected, narwalletDisconnected) //listen to narwallets events

    //set-up auto-refresh loop (10 min)
    setInterval(autoRefresh, 10 * MINUTES)
    //set-up auto-refresh rewards *display* (5 times/sec)
    // refreshRewardsDisplayLoop()
    // refreshRewardsDisplayLoop2()
    //refreshRewardsDisplayLoop3()
    // refreshRewardsDisplayLoop4()
    // //set-up auto-adjust rewards *display* to real rewards (once a minute)
    // refreshRealRewardsLoop()
    // refreshRealRewardsLoop2()
    //refreshRealRewardsLoop3()
    // refreshRealRewardsLoop4()

    //check if signed-in with NEAR Web Wallet
    await initNearWebWalletConnection()

    if (nearWebWalletConnection.isSignedIn()) {
      //already signed-in with NEAR Web Wallet
      //make the contract use NEAR Web Wallet
      wallet = new NearWebWallet(nearWebWalletConnection);

      // contract1.wallet = wallet;
      // cheddarContractName1.wallet = wallet;
      // tokenContractName1.wallet = wallet;

      // contract2.wallet = wallet;
      // cheddarContractName2.wallet = wallet;
      // tokenContractName2.wallet = wallet;

      // contract3.wallet = wallet;
      // cheddarContractName3.wallet = wallet;
      // tokenContractName3.wallet = wallet;

      // contract4.wallet = wallet;
      // cheddarContractName4.wallet = wallet;
      // tokenContractName4.wallet = wallet;

      await signedInFlow(wallet)

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

