import { baseDecode } from 'borsh';
import { connect, Contract, keyStores, Near, WalletConnection, ConnectedWalletAccount, RequestSignTransactionsOptions, utils } from 'near-api-js'
import { Action, createTransaction, functionCall } from 'near-api-js/lib/transaction';
import { PublicKey } from 'near-api-js/lib/utils'

import { ENV, CHEDDAR_CONTRACT_NAME, TESTNET_CHEDDAR_CONTRACT_NAME, getConfig } from './config'

import { WalletInterface } from './wallet-api/wallet-interface';
import { disconnectedWallet } from './wallet-api/disconnected-wallet';
import { NearWebWallet } from './wallet-api/near-web-wallet/near-web-wallet';
import { narwallets, addNarwalletsListeners } from './wallet-api/narwallets/narwallets';
import { toNumber, ntoy, yton, ytonLong, toStringDec, toStringDecSimple, toStringDecLong, toStringDecMin, ytonFull, addCommas, convertToDecimals, removeDecZeroes, convertToBase } from './util/conversions';

//qs/qsa are shortcut for document.querySelector/All
import { qs, qsa, qsi, showWait, hideWaitKeepOverlay, showErr, showSuccess, showMessage, show, hide, hidePopup, hideOverlay, qsaInnerText, showError, showPopup, qsInnerText, qsaAttribute } from './util/document';
import { checkRedirectSearchParams, checkRedirectSearchParamsMultiple } from './wallet-api/near-web-wallet/checkRedirectSearchParams';
import { FungibleTokenMetadata, NEP141Trait } from './contracts/NEP141';
import { PoolParams, PoolResultParams } from './entities/poolParams';
import { getPoolList } from './entities/poolList';
import { ContractData, PoolParamsP3 } from './entities/poolParamsP3';
import { U128String } from './wallet-api/util';
import { HTMLTokenInputData, RewardTokenIconData, UnclaimedRewardsData } from './entities/genericData';

import * as nearAPI from "near-api-js"
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';

//get global config
//const nearConfig = getConfig(process.env.NODE_ENV || 'testnet')
export let nearConfig = getConfig(ENV); //default testnet, can change according to URL on window.onload
export let near: nearAPI.Near
// global variables used throughout
export let wallet: WalletInterface = disconnectedWallet;

let nearWebWalletConnection: WalletConnection;
let nearConnectedWalletAccount: ConnectedWalletAccount;
let requestSignTransOptions: RequestSignTransactionsOptions;
let accountName;
let isPaused = false;

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


//New filters
function filterPools(className: string){
  return function (event: Event){
    filterButtonClicked(event)
    hideAllPools()
    let livePools = qsa(`.${className}`)
    showSelectedPools(livePools)
  }
}

function filterButtonClicked (event: Event){
  let previousFilterClicked= qsa(".activeFilterButton")
  previousFilterClicked.forEach(button => {
    button.classList.remove("activeFilterButton")
  })
  let buttonClicked = event.target as HTMLElement
  buttonClicked.classList.add("activeFilterButton")
}

function hideAllPools() {
  let allPools = document.querySelectorAll(".pool-container")
  allPools.forEach(pool => {
    pool.classList.add("hidden")
  });
}

function showSelectedPools(selectedPools: NodeListOf<Element>) {
  selectedPools.forEach(pool => {
    pool.classList.remove("hidden")
  });
}


//Events on filter buttons
qs("#live-filter").onclick=filterPools("active-pool")
qs("#ended-filter").onclick=filterPools("inactive-pool")
qs('#your-farms-filter').onclick= filterPools("your-farms")


function depositClicked(pool: HTMLElement) {
  return async function (event: Event) {
    event.preventDefault()

    pool.querySelector("#deposit")!.classList.remove("hidden")
    pool.querySelector("#activated")!.classList.add("hidden")
  }
}

function stakeMultiple(poolParams: PoolParamsP3, newPool: HTMLElement) {
  return async function (event: Event){
    event?.preventDefault()
    showWait("Staking...")
    
    // let stakeContainerList = newPool.querySelectorAll(".main-stake .input-container")  
    let inputArray: HTMLInputElement[] = []

    try {
      let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
      const contractParams = poolParams.contractParams
      const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
      if (!isDateInRange) throw Error("Pools is Closed.")
      
      const { htmlInputArray, amountValuesArray: amountValues, transferedAmountWithSymbolArray: stakedAmountWithSymbol } = await getInputDataMultiple(poolParams, newPool, "stake")
      inputArray = htmlInputArray
      
      qsaAttribute("input", "disabled", "disabled")

      //get amount
      const min_deposit_amount = 1;
            
      // TODO DANI: está ejecutando cosas después del stake, cuando el stake no se terminó
      await poolParams.stake(amountValues)
      //clear form
      for(let i = 0; i < inputArray.length; i++) {
        inputArray[i].value = ""  
      }
      
      poolParams.resultParams.addStaked(amountValues)
      // await refreshPoolInfoMultiple(poolParams, newPool)

      showSuccess(`Staked ${stakedAmountWithSymbol.join(" - ")}`)

    }
    catch (ex) {
      showErr(ex as Error)
    }
    // re-enable the form, whether the call succeeded or failed
    inputArray.forEach(input => {
      input.removeAttribute("disabled")
    });
  }
}

function unstakeMultiple(poolParams: PoolParamsP3, newPool: HTMLElement) {
  return async function (event: Event){
    event?.preventDefault()
    showWait("Unstaking...")
    
    // let stakeContainerList = newPool.querySelectorAll(".main-stake .input-container")  
    let inputArray: HTMLInputElement[] = []

    try {
      let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
      const contractParams = poolParams.contractParams
      const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
      if (!isDateInRange) throw Error("Pools is Closed.")
      
      const { htmlInputArray, amountValuesArray: amountValues, transferedAmountWithSymbolArray: unstakedAmountWithSymbol } = await getInputDataMultiple(poolParams, newPool, "unstake")
      inputArray = htmlInputArray
      
      qsaAttribute("input", "disabled", "disabled")

      //get amount
      const min_deposit_amount = 1;
            
      // TODO DANI: está ejecutando cosas después del stake, cuando el stake no se terminó
      await poolParams.unstake(amountValues)
      //clear form
      for(let i = 0; i < inputArray.length; i++) {
        inputArray[i].value = ""  
      }
      
      poolParams.resultParams.addStaked(amountValues.map(value => -value))
      // await refreshPoolInfoMultiple(poolParams, newPool)

      showSuccess(`Staked ${unstakedAmountWithSymbol.join(" - ")}`)

    }
    catch (ex) {
      showErr(ex as Error)
    }
    // re-enable the form, whether the call succeeded or failed
    inputArray.forEach(input => {
      input.removeAttribute("disabled")
    });
  }
}

async function getInputDataMultiple(poolParams: PoolParamsP3, newPool: HTMLElement, action: string): Promise<HTMLTokenInputData> {
  let htmlInputArray: HTMLInputElement[] = []
  let amountValuesArray: bigint[] = []
  let stakedAmountWithSymbolArray: string[] = []

  let inputContainerList = newPool.querySelectorAll(`.main-${action} .input-container`)  
  const stakeTokenContractList = poolParams.stakeTokenContractList
  const walletAvailableList = await poolParams.getWalletAvailable()
  for(let i = 0; i < inputContainerList.length; i++) {
    let stakeContainer = inputContainerList[i]
    let input = stakeContainer.querySelector(".amount") as HTMLInputElement
    htmlInputArray.push(input)
    let amount = parseFloat(input.value)
    if (isNaN(amount)) {
      throw Error("Please Input a Number.")
    }
    const metaData = stakeTokenContractList[i].metaData

    const stakeAmountBN: bigint = BigInt(convertToBase(amount.toString(), metaData.decimals.toString()))
    if(BigInt(walletAvailableList[i]) < stakeAmountBN) {
      const balanceDisplayable = convertToDecimals(walletAvailableList[i], metaData.decimals, 7)
      throw Error(`Only ${balanceDisplayable} ${metaData.symbol} Available to ${action}.`)
    }
    
    amountValuesArray.push(stakeAmountBN)
    stakedAmountWithSymbolArray.push(`${amount} ${metaData.symbol}`)
  }
  return {
    htmlInputArray,
    amountValuesArray,
    transferedAmountWithSymbolArray: stakedAmountWithSymbolArray,
  }
}

function stakeSingle(poolParams: PoolParams, newPool: HTMLElement) {
  return async function (event: Event){
    event?.preventDefault()
    showWait("Staking...")
    
    let stakeInput = newPool.querySelector(".main-stake input") as HTMLInputElement
    

    try {
      let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
      const contractParams = poolParams.contractParams
      const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
      if (!isDateInRange) throw Error("Pools is Closed.")
      
      stakeInput.setAttribute("disabled", "disabled")
      let stakeAmount = parseFloat(stakeInput.value)
      //get amount
      const min_deposit_amount = 1;
      if (isNaN(stakeAmount)) {
        throw Error("Please Input a Number.")
      }

      const walletAvailable = await poolParams.getWalletAvailable()
      if (stakeAmount > parseFloat(walletAvailable)) throw Error(`Only ${walletAvailable} ${poolParams.metaData.symbol} Available to Stake.`);
      await poolParams.stakeTokenContract.ft_transfer_call(poolParams.stakingContract.contractId, convertToBase(stakeAmount.toString(), poolParams.metaData.decimals.toString()), "to farm")

      //clear form
      stakeInput.value = ""
      poolParams.resultParams.addStaked(ntoy(stakeAmount))
      await refreshPoolInfo(poolParams, newPool)//DUDA esto no debería ser refreshPoolInfoSingle?

      showSuccess("Staked " + toStringDecMin(stakeAmount) + poolParams.metaData.symbol)

    }
    catch (ex) {
      showErr(ex as Error)
    }

    // re-enable the form, whether the call succeeded or failed
    stakeInput.removeAttribute("disabled")
  }
}

function harvestMultiple(poolParams: PoolParamsP3, newPool: HTMLElement) {
  return async function (event: Event) {
    event?.preventDefault()
    showWait("Harvesting...")
    
    // let amount = poolParams.resultParams.getCurrentCheddarRewards()

    await poolParams.stakingContract.withdraw_crop()

    // poolParams.resultParams.computed = 0n
    // poolParams.resultParams.real = 0n
    // newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = "0"

    // showSuccess("Harvested" + toStringDecMin(parseFloat(amount)) + " CHEDDAR")
    showSuccess("Harvested successfully")
  }
}

function harvestSingle(poolParams: PoolParams, newPool: HTMLElement){
  return async function (event: Event) {
    event?.preventDefault()
    showWait("Harvesting...")
    
    let amount = poolParams.resultParams.getCurrentCheddarRewards()

    await poolParams.stakingContract.withdraw_crop()

    poolParams.resultParams.computed = 0n
    poolParams.resultParams.real = 0n
    // newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = "0"

    showSuccess("Harvested" + toStringDecMin(parseFloat(amount)) + " CHEDDAR")
  }
}

function unstakeSingle(poolParams: PoolParams, newPool: HTMLElement){
  return async function (event: Event){
    event?.preventDefault()
    showWait("Unstaking...")

    let unstakeInput = newPool.querySelector(".main-unstake input") as HTMLInputElement

    try {      
      unstakeInput.setAttribute("disabled", "disabled")
      let unstakeAmount = parseFloat(unstakeInput.value)
      const staked = poolParams.resultParams.staked
      const stakedDisplayable = Number(convertToDecimals(staked.toString(), poolParams.metaData.decimals, 5))
      if (isNaN(unstakeAmount)) {
        throw Error("Please Input a Number.")
      }
      
      if (unstakeAmount > stakedDisplayable) throw Error(`Only ${stakedDisplayable} ${poolParams.metaData.symbol} Available to Unstake.`);
      await poolParams.stakingContract.unstake(convertToBase(unstakeAmount.toString(), poolParams.metaData.decimals.toString()))
      

      //clear form
      unstakeInput.value = ""

      //refresh acc info
      await refreshPoolInfo(poolParams, newPool)
      showSuccess("Unstaked " + toStringDecMin(unstakeAmount) + poolParams.metaData.symbol)

      poolParams.resultParams.addStaked(ntoy(unstakeAmount))
    }
    catch (ex) {
      showErr(ex as Error)
    }

    // re-enable the form, whether the call succeeded or failed
    unstakeInput.removeAttribute("disabled")
  }
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
// let epochCached: EpochInfo;
// let endOfEpochCached = new Date();
// let epochDurationMs = 12 * HOURS;
// async function endOfEpoch(): Promise<Date> {
//   if (new Date() >= endOfEpochCached && wallet.isConnected()) {
//     try {
//       epochCached = await computeCurrentEpoch(wallet);
//       endOfEpochCached = new Date(epochCached.ends_dtm);
//       epochDurationMs = epochCached.duration_ms;
//     }
//     catch (ex) {
//       showErr(ex);
//       return new Date(new Date().getTime() - 12 * HOURS);
//     }
//   }
//   return endOfEpochCached;
// }

//--------------------------------------
// AutoRefresh
async function autoRefresh() {
  if (wallet && wallet.isConnected()) {
    try {
      //await refreshPoolInfo()
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
  await addPoolList(poolList)
  await refreshAccountInfoGeneric(poolList)
  qs(".user-info #account-id").innerText = poolList[0].resultParams.getDisplayableAccountName()
  setDefaultFilter()
}

function setDefaultFilter (){
  const event= new Event ("click")
  qs("#your-farms-filter").dispatchEvent(event) 
}

// Initialize contract & set global variables
async function initNearWebWalletConnection() {

  // Initialize connection to the NEAR network
  const near = await connect(Object.assign({ deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } }, nearConfig.farms[0]))
  // Initializing Wallet based Account.
  nearWebWalletConnection = new WalletConnection(near, null)
  nearConnectedWalletAccount = new ConnectedWalletAccount(nearWebWalletConnection, near.connection, nearWebWalletConnection.getAccountId())
  //console.log(nearConnectedWalletAccount)
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

//DUDA si no usamos el submitForm borrar esto
async function setupTransaction({
  receiverId,
  actions,
  nonceOffset = 1,
}: {
  receiverId: string;
  actions: Action[];
  nonceOffset?: number;
}) {

  //console.log(nearConnectedWalletAccount)


  const localKey = await nearConnectedWalletAccount.connection.signer.getPublicKey(
    nearConnectedWalletAccount.accountId,
    nearConnectedWalletAccount.connection.networkId
  );
  let accessKey = await nearConnectedWalletAccount.accessKeyForTransaction(
    receiverId,
    actions,
    localKey
  );
  if (!accessKey) {
    throw new Error(
      `Cannot find matching key for transaction sent to ${receiverId}`
    );
  }

  const block = await nearConnectedWalletAccount.connection.provider.block({ finality: 'final' });
  const blockHash = baseDecode(block.header.hash);

  const publicKey = PublicKey.from(accessKey.public_key);
  const nonce = accessKey.access_key.nonce + nonceOffset;

  return createTransaction(
    nearConnectedWalletAccount.accountId,
    publicKey,
    receiverId,
    nonce,
    actions,
    blockHash
  );
}

function showOrHideMaxButton(walletBalance: String, elem: HTMLElement) {
  if (Number(walletBalance.replace(".", "")) > 0) {
    //console.log(elem)
    elem.classList.remove("hidden")
  }
  else {
    elem.classList.add("hidden")
  }
}

function setAccountInfo(poolParams: PoolParams, accountInfo: string[]){
  poolParams.resultParams.staked = BigInt(accountInfo[0])
  poolParams.resultParams.real = BigInt(accountInfo[1])
  poolParams.resultParams.computed = BigInt(accountInfo[1])
  poolParams.resultParams.previous_timestamp = Number(accountInfo[2])
}

async function refreshPoolInfo(poolParams: PoolParams, newPool: HTMLElement){
  poolParams.resultParams.accName = poolParams.stakingContract.wallet.getAccountId()  
}

async function refreshPoolInfoSingle(poolParams: PoolParams, newPool: HTMLElement){
  var metaData = poolParams.metaData;
  let accName = poolParams.resultParams.accName
  
  let accountInfo = await poolParams.stakingContract.status(accName)
  
  let staked = (accountInfo) ? BigInt(accountInfo[0]) : 0;
  let displayableStaked = convertToDecimals(staked.toString(), metaData.decimals, 7)
  
  let unstakeMaxButton = qs(".unstake .max-button") as HTMLElement
  newPool.querySelector(".unstake .value")!.innerHTML  = displayableStaked
  showOrHideMaxButton(displayableStaked.toString(), unstakeMaxButton)


  const walletBalances = await poolParams.getWalletAvailableDisplayable()
  
  let stakeMaxButton = qs(".stake .max-button") as HTMLElement
  newPool.querySelector(".stake .value")!.innerHTML = removeDecZeroes(walletBalances.toString())
  showOrHideMaxButton(walletBalances.toString(), stakeMaxButton)


  setAccountInfo(poolParams, accountInfo)
  let unclaimedRewards = poolParams.resultParams.getCurrentCheddarRewards()

  // newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = unclaimedRewards.toString()
}

async function refreshPoolInfoMultiple(poolParams: PoolParamsP3, newPool: HTMLElement){
  var metaData = poolParams.metaData;
  let accName = poolParams.resultParams.accName
  
  let accountInfo = await poolParams.stakingContract.status(accName)//DUDA xq stakingContract en simple devuelve un array de string y en multiple otro devuelve un "status"?
  
  let staked = (accountInfo) ? BigInt(accountInfo.stake_tokens) : 0;
  let displayableStaked = convertToDecimals(staked.toString(), metaData.decimals, 7)
  
  let unstakeMaxButton = qs(".unstake .max-button") as HTMLElement
  newPool.querySelector(".unstake .value")!.innerHTML  = displayableStaked
  showOrHideMaxButton(displayableStaked.toString(), unstakeMaxButton)


  const walletBalances = await poolParams.getWalletAvailableDisplayable()
  
  let stakeMaxButton = qs(".stake .max-button") as HTMLElement
  newPool.querySelector(".stake .value")!.innerHTML = removeDecZeroes(walletBalances.toString())
  showOrHideMaxButton(walletBalances.toString(), stakeMaxButton)


  setAccountInfo(poolParams, accountInfo)
  let unclaimedRewards = poolParams.resultParams.getCurrentCheddarRewards()

  // newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = unclaimedRewards.toString()
}


async function refreshAccountInfoGeneric(poolList: Array<PoolParams>) {
  poolList.forEach(poolParams => {
    //refreshPoolInfo(poolParams)
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

// function autoFillStakeAmount2= (e)=>{
//   console.log("Hello im an event")
//   qs("input.stake-amount") = e * 2
// }

function autoFillStakeAmount(poolParams: PoolParamsP3, pool: HTMLElement, inputRoute: string, mul: boolean) {
  return function (event: Event) {
    event.preventDefault()
    let value1 = (event.target as HTMLInputElement).value
    let input2 = pool.querySelector(`${inputRoute}`) as HTMLInputElement
    if (value1 == "") {
      input2.value = ""
    } 
    //We use this || because the first option have issues recognizing if "number+string" is a number or not (example value1="1a")
    else if (Number.isNaN(value1) || (value1 != parseFloat(value1).toString())) {
      input2.value = "Please Input a Number"
    } else {
      let rates = poolParams.contractParams.stake_rates
      const mulRate = Number(BigInt(rates[1]) * 100n / (BigInt(rates[0]))) / 100
      const rate = mul ? mulRate : (mulRate ** -1)
      //Replace the "2" with proper variable name
      input2.value = (Number(value1) * rate).toString()
    }
  }
}

async function addPoolSingle(poolParams: PoolParams, newPool: HTMLElement): Promise<void> {
  const walletBalance: U128String = await poolParams.getWalletAvailable()

  const metaData = poolParams.metaData
  let totalStaked = poolParams.contractParams.total_staked.toString()
  const rewardsPerDay = getRewardsPerDaySingle(poolParams)

  var contractData = {
    contract: poolParams.stakeTokenContract,
    metaData: poolParams.metaData,
    balance: walletBalance
  }

  addInput(newPool, contractData, "stake")
  addInput(newPool, contractData, "unstake", poolParams.resultParams.staked.toString())

  // newPool.querySelector(".stake span.value")!.innerHTML = removeDecZeroes(walletBalance.toString());

  // newPool.querySelector(".main-stake .token-input-container")?.classList.remove("hidden")
  // newPool.querySelector(".main-unstake .token-input-container")?.classList.remove("hidden")

  // let stakeMaxButton = newPool.querySelector(".stake .max-button") as HTMLElement
  // stakeMaxButton.addEventListener("click", maxStakeClicked(newPool))
  
  // showOrHideMaxButton(walletBalance.toString(), stakeMaxButton)//TODO test if this function is working in the new pool



  newPool.querySelectorAll(".token-name").forEach(element => {
    element.innerHTML = metaData.symbol
  })

  
  
  // newPool.querySelector("#staking-unstaking-container .unstake .value")!.innerHTML = stakedDisplayable
  
  let unclaimedRewards = poolParams.resultParams.getCurrentCheddarRewards()

  // console.log(unclaimedRewards)

  // newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = unclaimedRewards.toString()


  // let unstakeMaxButton = newPool.querySelector(`.unstake .max-button`) as HTMLElement
  // unstakeMaxButton.addEventListener("click", maxUnstakeClicked(newPool))
  // showOrHideMaxButton(stakedDisplayable.toString(), unstakeMaxButton)

  // if (Number(stakedDisplayable) > 0) {
  //   unstakeMaxButton.classList.remove("hidden")
  // }

  let totalFarmed = poolParams.contractParams.total_farmed.toString()
  newPool.querySelector(".total-token-farmed-value")!.innerHTML = convertToDecimals(totalFarmed, 24, 5)

  newPool.querySelector(".stats-container .token-total-rewards-value")!.innerHTML = yton(rewardsPerDay.toString()).toString()

  newPool.querySelector(".stats-container .total-staked-value")!.innerHTML = convertToDecimals(totalStaked, metaData.decimals, 5).toString()

  newPool.querySelector("#stake-button")?.addEventListener("click", stakeSingle(poolParams, newPool))

  newPool.querySelector("#unstake-button")?.addEventListener("click", unstakeSingle(poolParams, newPool))

  newPool.querySelector("#activate")?.addEventListener("click", depositClicked(newPool))

  newPool.querySelector("#harvest-button")?.addEventListener("click", harvestSingle(poolParams, newPool))


  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  if(isDateInRange) {
    window.setInterval(refreshPoolInfoSingle.bind(null, poolParams, newPool), 5000)
  }
}

async function addPoolMultiple(poolParams: PoolParamsP3, newPool: HTMLElement): Promise<void> {

  let tokenSymbols = []
  await poolParams.getWalletAvailable()
  for(let i=0; i < poolParams.stakeTokenContractList.length; i++){
    const contractData = poolParams.stakeTokenContractList[i]
    const metaData = contractData.metaData

    addInput(newPool, contractData, "stake")
    addInput(newPool, contractData, "unstake", poolParams.resultParams.staked[i])
    
    tokenSymbols.push(`${metaData.symbol.toLowerCase()}`)

    newPool.querySelector("#harvest-button")?.addEventListener("click", harvestMultiple(poolParams, newPool))
  }

  //I use this 2 for loops to match every combination of inputs without repeating itself
  for (let i=0; i < tokenSymbols.length; i++){
    for (let u=0; u < tokenSymbols.length; u++){
      if (i != u){
        newPool.querySelector(`.main-stake .${tokenSymbols[i]}-input input`)!.addEventListener("input", autoFillStakeAmount(poolParams, newPool, `.main-stake .${tokenSymbols[u]}-input input`, i == 0))
        newPool.querySelector(`.main-unstake .${tokenSymbols[i]}-input input`)!.addEventListener("input", autoFillStakeAmount(poolParams, newPool, `.main-unstake .${tokenSymbols[u]}-input input`, i == 0))
      }
    }
  }

  newPool.querySelector("#stake-button")?.addEventListener("click", stakeMultiple(poolParams, newPool))
  newPool.querySelector("#unstake-button")?.addEventListener("click", unstakeMultiple(poolParams, newPool))
  
}

function addInput(newPool: HTMLElement, contractData: ContractData, action: string, stakedAmount?: U128String) {
  let inputContainer = qs(".generic-token-input-container")
  var newInputContainer = inputContainer.cloneNode(true) as HTMLElement
  
  const metaData = contractData.metaData
  newInputContainer.classList.remove("generic-token-input-container")
  newInputContainer.classList.add("token-input-container")
  newInputContainer.classList.add(`${metaData.symbol.toLowerCase()}-input`)
  newInputContainer.classList.remove(`hidden`)

  newInputContainer.querySelector(".available-info span")!.innerHTML = `Available to ${action}`
  newInputContainer.querySelector(".amount-available")?.classList.add(action)
  
  let inputLogoContainer = newInputContainer.querySelector(".input-container .token-logo") as HTMLElement
  let amountAvailableValue = newInputContainer.querySelector(".amount-available .value")
  let maxButton = newInputContainer.querySelector(".max-button") as HTMLElement

  if (metaData.icon != null){
    // inputLogoContainer.innerHTML= `${metaData.icon}`
    if(metaData.icon.startsWith("data:image/svg+xml")) {
      let tokenLogoElement = newInputContainer.querySelector("img.token-logo")
      tokenLogoElement?.setAttribute("src", metaData.icon)
      inputLogoContainer?.classList.remove("hidden")
    } else if(metaData.icon.startsWith("<svg")) {
      let tokenLogoElement = newInputContainer.querySelector("div.token-logo")
      tokenLogoElement!.innerHTML = metaData.icon
      tokenLogoElement!.classList.remove("hidden")
    }
  } else {
    inputLogoContainer.innerHTML= `${metaData.name}`
  }

  if(action == "stake") {
    amountAvailableValue!.innerHTML= convertToDecimals(contractData.balance, contractData.metaData.decimals, 7)
  } else if(action == "unstake") {
    amountAvailableValue!.innerHTML= convertToDecimals(stakedAmount, contractData.metaData.decimals, 7)
  }
  
  showOrHideMaxButton(contractData.balance, maxButton)

  newPool.querySelector(`.main-${action}`)!.append(newInputContainer)
}

async function toggleExpandStakeUnstakeSection (newPool: HTMLElement, elemWithListener: HTMLElement){
  let expandPoolButton = newPool.querySelector(".expand-button")! as HTMLElement;
  let hidePoolButton = newPool.querySelector(".hide-button")! as HTMLElement;
  let stakingUnstakingContainer = newPool.querySelector("#activated")! as HTMLElement;
  elemWithListener.addEventListener("click", await toggleActions(expandPoolButton));
  elemWithListener.addEventListener("click", await toggleActions(hidePoolButton));
  elemWithListener.addEventListener("click", await toggleActions(stakingUnstakingContainer));
}

async function addPool(poolParams: PoolParams | PoolParamsP3): Promise<void> {
  var genericPoolElement = qs("#generic-pool-container") as HTMLElement;
  var metaData = poolParams.metaData;
  let singlePoolParams: PoolParams
  let multiplePoolParams: PoolParamsP3
  let isContractActivated = null
  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end

  var newPool = genericPoolElement.cloneNode(true) as HTMLElement;  


  newPool.setAttribute("id", poolParams.html.id)
  newPool.classList.remove("hidden")
  newPool.classList.add("pool-container")


  let iconElem = newPool.querySelectorAll("#token-logo-container img")
  
  iconElem.forEach(icon => {
    icon!.setAttribute("src", metaData.icon || "");
  });

  if (poolParams instanceof PoolParams) {
    singlePoolParams = poolParams
    await addPoolSingle(singlePoolParams, newPool)
    isContractActivated = await poolParams.stakeTokenContract.storageBalance();
  } else {
    multiplePoolParams = poolParams
    await addPoolMultiple(multiplePoolParams, newPool)
    isContractActivated = await poolParams.stakingContract.storageBalance();
  }

  // New code
  // let poolContainer = newPool.querySelector("#generic-pool-container")! as HTMLElement;
  let poolContainer = newPool.querySelector("#pool-container")! as HTMLElement
  let showContractStart = newPool.querySelector("#contract-start")
  let showContractEnd = newPool.querySelector("#contract-end")
  let showAndHideVisibilityTool = newPool.querySelector(".visual-tool-expanding-indication-hidden")! as HTMLElement;
  let infoIcon = newPool.querySelector("#new-token-header .information-icon-container")! as HTMLElement;
  let poolStats = newPool.querySelector("#token-pool-stats")! as HTMLElement;
  let expandPoolButton = newPool.querySelector(".expand-button")! as HTMLElement;
  let hidePoolButton = newPool.querySelector(".hide-button")! as HTMLElement;
  let stakeTabButton = newPool.querySelector(".staking")! as HTMLElement;
  let unstakeTabButton = newPool.querySelector(".unstaking")! as HTMLElement;
  let staking = newPool.querySelector(".main-stake")! as HTMLElement;
  let unstaking = newPool.querySelector(".main-unstake")! as HTMLElement;
  let stakeButton = newPool.querySelector("#stake-button")! as HTMLElement;
  let unstakeButton = newPool.querySelector("#unstake-button")! as HTMLElement;
  var contractParams = poolParams.contractParams;
  let unclaimedRewardsDollarsValue = newPool.querySelector(".unclaimed-rewards-dollars-value")! as HTMLElement;
  let unclaimedRewardsInfoContainer = newPool.querySelector(".unclaimed-rewards-info-container")! as HTMLElement;

  
  showContractStart!.innerHTML = new Date(contractParams.farming_start * 1000).toLocaleString()
  showContractEnd!.innerHTML = new Date(contractParams.farming_end * 1000).toLocaleString()

  infoIcon.addEventListener("mouseover", showElement(poolStats));
  poolStats.addEventListener("mouseover", showElement(poolStats));
  poolStats.addEventListener("mouseout", hideElement(poolStats));

  if(poolParams.resultParams.hasStakedTokens()){
    newPool.classList.add("your-farms")
  }
  if(isDateInRange) {
    newPool.classList.add("active-pool")
  } else {
    newPool.classList.add("inactive-pool")
  }

  // TODO MARTIN //DUDA tengo q hacer algo más acá o ya lo terminé y nunca borre el TODO?
  let activateButtonContainer = newPool.querySelector("#activate") as HTMLElement
  let activateButton = newPool.querySelector(".activate") as HTMLElement
  let activated = newPool.querySelector("#activated") as HTMLElement
  let harvestButton = newPool.querySelector("#harvest-button") as HTMLElement

  activated.classList.add("hidden")
  activateButtonContainer.classList.add("hidden")
  
  if(newPool.classList.contains("inactive-pool") && !newPool.classList.contains("your-farms")) {
    // Completely ended contract. Don't put listeners regarding stake/unstake/harvest
  } else {
    newPool.addEventListener("mouseover", paintOrUnPaintElement("visual-tool-expanding-indication-hidden", showAndHideVisibilityTool));
    newPool.addEventListener("mouseout", paintOrUnPaintElement("visual-tool-expanding-indication-hidden",showAndHideVisibilityTool));
    // Live and ended contracts.
    expandPoolButton.classList.remove("hidden")

    toggleExpandStakeUnstakeSection(newPool, poolContainer)
    toggleExpandStakeUnstakeSection(newPool, expandPoolButton)
    toggleExpandStakeUnstakeSection(newPool, hidePoolButton)

    unstakeTabButton.addEventListener("click", showElementHideAnother(unstaking, staking));
    unstakeTabButton.addEventListener("click", showElementHideAnother(unstakeButton, stakeButton));
    unstakeTabButton.addEventListener("click", setActiveColor);
    unstakeTabButton.addEventListener("click", cancelActiveColor(stakeTabButton));
    
    if (!newPool.classList.contains("inactive-pool")) {
      stakeTabButton.addEventListener("click", showElementHideAnother(staking, unstaking));
      stakeTabButton.addEventListener("click", showElementHideAnother(stakeButton, unstakeButton));
      stakeTabButton.addEventListener("click", setActiveColor);
      stakeTabButton.addEventListener("click", cancelActiveColor(unstakeTabButton));
      
      if (!newPool.classList.contains("your-farms")) {
        activateButtonContainer.classList.remove("hidden")
        activateButton.addEventListener("click", depositClicked(newPool))
        harvestButton.classList.add("hidden")
        
        if (poolParams.html.formId == "nearcon" || poolParams.html.formId == "cheddar") {
          let warningText = "ONLY ACTIVATE IF PREVIOUSLY STAKED<br>0.05 NEAR storage deposit, gets refunded."
          newPool.querySelector("#depositWarning")!.innerHTML = warningText

        }
      } else {
        activateButtonContainer.classList.add("hidden")
        activateButton.setAttribute("disabled", "disabled")
      }
      
    } else {
      newPool.querySelector("#staking-unstaking-container .staking")!.setAttribute("disabled", "disabled")
      const event= new Event ("click")
      newPool.querySelector("#staking-unstaking-container .unstaking")!.dispatchEvent(event)
      

    }
  }

  await addRewardTokenIcons(poolParams, newPool)
  await addUnclaimedRewards(poolParams, newPool)
  unclaimedRewardsDollarsValue.addEventListener("mouseover", toggleElement(unclaimedRewardsInfoContainer));
  unclaimedRewardsDollarsValue.addEventListener("mouseout", toggleElement(unclaimedRewardsInfoContainer));
  unclaimedRewardsInfoContainer.addEventListener("mouseover", showElement(unclaimedRewardsInfoContainer));
  unclaimedRewardsInfoContainer.addEventListener("mouseout", hideElement(unclaimedRewardsInfoContainer));
  // await addUnclaimedRewards(poolParams, newPool)

  qs("#pool_list").append(newPool)

  newPool.querySelector("#contract-information .deposit-fee-value")!.innerHTML = (contractParams.fee_rate) ? contractParams.fee_rate / 100 + "%" : "0%"
}

async function addRewardTokenIcons(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  const tokenIconDataArray: RewardTokenIconData[] = await poolParams.getRewardTokenIconData()
  const icon = qs(".generic-mini-icon")
  const container = newPool.querySelector(".reward-tokens-value") as HTMLElement
  var parser = new DOMParser();
  
  for(let i = 0; i < tokenIconDataArray.length; i++) {
    const tokenIconData = tokenIconDataArray[i]
    var newMiniIcon: HTMLElement
    if(tokenIconData.isSvg) {
      var doc = parser.parseFromString(tokenIconData.src, "image/svg+xml");
      newMiniIcon = doc.documentElement
    } else {
      newMiniIcon = icon.cloneNode(true) as HTMLElement 
      newMiniIcon.setAttribute("src", tokenIconData.src)
      newMiniIcon.setAttribute("alt", tokenIconData.alt)
    }
    toggleGenericClass(newMiniIcon, "mini-icon")
    container.append(newMiniIcon)
  }
}

async function addUnclaimedRewards(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  const rowContainer = newPool.querySelector(".unclaimed-rewards-info-container") as HTMLElement
  const row = qs(".generic-unclaimed-rewards-row") as HTMLElement
  const icon = qs(".generic-mini-icon")
  const unclaimedRewardsDataArray = await poolParams.getUnclaimedRewardsData()
  var parser = new DOMParser();
  
  for(let i = 0; i < unclaimedRewardsDataArray.length; i++) {
    const newRow = row.cloneNode(true) as HTMLElement
    let unclaimedRewardData = unclaimedRewardsDataArray[i]
    newRow.querySelector(".amount")!.innerHTML = unclaimedRewardData.amount

    const iconContainer = newRow.querySelector(".icon") as HTMLElement
    
    var newMiniIcon: HTMLElement
    if(unclaimedRewardData.iconData.isSvg) {
      var doc = parser.parseFromString(unclaimedRewardData.iconData.src, "image/svg+xml");
      newMiniIcon = doc.documentElement
    } else {
      newMiniIcon = icon.cloneNode(true) as HTMLElement
      newMiniIcon.setAttribute("src", unclaimedRewardData.iconData.src)
      newMiniIcon.setAttribute("alt", unclaimedRewardData.iconData.alt)
    }
    toggleGenericClass(newMiniIcon, "mini-icon")
    iconContainer.append(newMiniIcon)
    toggleGenericClass(newRow, "unclaimed-rewards-row")
    rowContainer.append(newRow)
  }
}

function toggleGenericClass(element: HTMLElement, className: string) {
  element.classList.remove(`generic-${className}`)
  element.classList.add(`${className}`)
  element.classList.remove("hidden")
}

function getRewardsPerDaySingle(poolParams: PoolParams) {
  return BigInt(poolParams.contractParams.farming_rate) * 60n * 24n
}

//DUDA no estoy seguro de si esto lo usabamos o no al final
function maxStakeClicked(pool: HTMLElement) {
  return function (event: Event) {
    event.preventDefault()

    let input = pool.querySelector(".main-stake input") as HTMLInputElement
    const amount = pool.querySelector(".stake .value")!.innerHTML

    input.value = amount.toString()
  }
}
//DUDA idem
function maxUnstakeClicked(pool: HTMLElement) {
  return function (event: Event) {
    event.preventDefault()

    let input = pool.querySelector(".main-unstake input") as HTMLInputElement
    const amount = pool.querySelector(".unstake .value")!.innerHTML

    input.value = amount.toString()
  }
}


async function addPoolList(poolList: Array<PoolParams|PoolParamsP3>) {
  qs("#pool_list").innerHTML = ""
  for (let i = 0; i < poolList.length; i++) {
    await addPool(poolList[i]);
  }



  qs("#pool_list").style.display = "grid"

  if (qs("#pool_list").childElementCount == 0) {
    qs("#pool_list").innerHTML = "<h2 style='color: #8542EB;text-shadow: white 0px 1px 5px;margin-top:5rem;'>You have No Staked Pools.</h2>"
  }

  qs(".loader").style.display = "none"

  isPaused = false;
}

window.onload = async function () {
  try {
    
    let env = ENV //default

    // const parts = window.location.pathname.split("/")
    // const i = parts.indexOf("DApp")
    // if (i >= 0) { env = parts[i + 1] }

    if (env != nearConfig.farms[0].networkId)
      nearConfig = getConfig(ENV);

    near = await nearAPI.connect(
      Object.assign(
          {
              deps: {
                  keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore()
              }
          },
          nearConfig.farms[0]
      )
    )

    var countDownDate = new Date("Jan 2, 2022 18:00:00 UTC");
    var countDownDate = new Date(countDownDate.getTime() - countDownDate.getTimezoneOffset() * 60000)

    //console.log(countDownDate)

    //DUDA para que es esto?
    // var x = setInterval(function() {

    //   // Get today's date and time
    //   var now = new Date().getTime();
    //   var d = new Date();
    //   var d = new Date(d.getTime() - d.getTimezoneOffset() * 60000)

    //   // Find  distance between now and the count down date
    //   var distance = countDownDate.getTime() - d.getTime();
    //   //console.log(distance)

    //   // Time calculations for days, hours, minutes and seconds
    //   var days = Math.floor(distance / (1000 * 60 * 60 * 24));
    //   var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    //   var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    //   var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    //   // Display the result in the element with id="demo"
    //   document.getElementById("timer")!.innerHTML = "<h2><span style='color:#222'>New Pools Start In: </span><span style='color:rgba(80,41,254,0.88)'>" + hours + "h : "
    //   + minutes + "m : " + seconds + "s" + "</span></h2>";

    //   document.getElementById("timer-non")!.innerHTML = "<h2><span style='color:#222'>New Pools Start In: </span><span style='color:rgba(80,41,254,0.88)'>" + hours + "h : "
    //   + minutes + "m : " + seconds + "s" + "</span></h2>";

    //   // If the count down is finished, write some text
    //   if (distance < 0) {
    //     clearInterval(x);
    //     document.getElementById("timer")!.innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS LIVE!</h2>";
    //     document.getElementById("timer-non")!.innerHTML = "<h2 style='color:rgba(80,41,254,0.88)'>FARM IS LIVE!</h2>";
    //   }
    // }, 1000);

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
      wallet = new NearWebWallet(nearWebWalletConnection);//DUDA q pedo con esto?
      
      accountName = wallet.getAccountId()
      qsInnerText("#account-id", accountName)
      await signedInFlow(wallet)
      const cheddarContractName = (ENV == 'mainnet') ? CHEDDAR_CONTRACT_NAME : TESTNET_CHEDDAR_CONTRACT_NAME//DUDA y esto?
      const cheddarContract = new NEP141Trait(cheddarContractName);
      cheddarContract.wallet = wallet;
      const cheddarBalance = await cheddarContract.ft_balance_of(accountName)
      const amountAvailable = toStringDec(yton(await wallet.getAccountBalance()))
      qsInnerText("#my-account #wallet-available", amountAvailable)
      qsInnerText("#my-account #cheddar-balance", convertToDecimals(cheddarBalance, 24, 5))

      let circulatingSupply = await cheddarContract.ft_total_supply()
      document.querySelector("#circulatingSupply span")!.innerHTML = "Circulating Supply:&nbsp;" + toStringDec(yton(circulatingSupply)).split('.')[0];

      //check if we're re-spawning after a wallet-redirect
      //show transaction result depending on method called
      const poolList = await getPoolList(wallet)
      const searchParamsResultArray = await checkRedirectSearchParamsMultiple(nearWebWalletConnection, nearConfig.farms[0].explorerUrl || "explorer");
      let method: string = ""
      let err
      let args = []
      searchParamsResultArray.forEach(searchParamsResult => {
        const { err: errResult, data, method: methodResult, finalExecutionOutcome } = searchParamsResult
        if(errResult) {
          err = errResult
          return
        }
        if(methodResult) {
          method = methodResult  
        }
        
        if (finalExecutionOutcome) {
          const arg = JSON.parse(atob(finalExecutionOutcome.transaction.actions[0].FunctionCall.args))
          args.push(arg)
        }
        
      });

      if (err) {
        showError(err, "Transaction - " + method || "");
      } else if(method == "ft_transfer_call") {
        // @ts-ignore
        await stakeResult(args)
      } else if(method == "unstake"){
        // @ts-ignore
        await unstakeResult(args)
      }
      // const { err, data, method, finalExecutionOutcome } = await checkRedirectSearchParams(nearWebWalletConnection, nearConfig.farms[0].explorerUrl || "explorer");
      // if (finalExecutionOutcome) {
      //   var args = JSON.parse(atob(finalExecutionOutcome.transaction.actions[0].FunctionCall.args))
      // }

      // if (err) {
      //   showError(err, "Transaction - " + method || "");
      // }
      // else if (method == "deposit_and_stake") {
      //   showSuccess("Deposit Successful")
      // }
      // if (method == "unstake" && data == null) {
      //   showSuccess("Unstaked All and Harvested Cheddar")
      // } else if (method == "unstake" && args.amount != null) {
      //   var receiver = finalExecutionOutcome?.transaction.receiver_id;
      //   for (let i = 0; i < poolList.length; i++) {
      //     //console.log("poolList[i].contract.contractId: ", poolList[i].contract.contractId)
      //     if (poolList[i].stakingContract.contractId == receiver) {//DUDA q onda con esto?
      //       const metaData = poolList[i].metaData
      //       showSuccess(`Unstaked ${convertToDecimals(args.amount, metaData.decimals, 2)} ${metaData.symbol}`)
      //       // showSuccess(`Unstaked ${convertToDecimals(data, metaData.decimals, 2)} ${metaData.symbol}`)
      //       break;
      //     }
      //   }
      // } else if (method == "withdraw_crop") {

      //   if (finalExecutionOutcome) {
      //     var log = (finalExecutionOutcome.receipts_outcome[3].outcome.logs[0]).split(' ');
      //     var message = yton(log[3]) + ' Cheddar Harvested!'
      //     showSuccess(message)
      //   }

      // } else if (method == "storage_deposit") {
      //   showSuccess(`Storage Deposit Successful`)
      // }
      // else if (data) {

      //   switch (method) {
      //     case "liquid_unstake": {
      //       showSection("#unstake")
      //       showUnstakeResult(data)
      //       break;
      //     }
      //     case "nslp_add_liquidity": {
      //       showSection("#liquidity")
      //       //showLiquidityOwned();
      //       break;
      //     }
      //     case "withdraw_crop": {
      //       showSuccess(`${yton(data)} Cheddar Harvested!`)
      //       break;
      //     }
      //     case "unstake": {
      //       var receiver = finalExecutionOutcome?.transaction.receiver_id;
      //       //console.log("Receiver: ", receiver)
      //       //console.log("Length: ", poolList.length)
      //       // if(receiver) {
      //       for (let i = 0; i < poolList.length; i++) {
      //         //console.log("poolList[i].tokenContract.contractId: ", poolList[i].tokenContract.contractId)
      //         if (poolList[i].tokenContract.contractId == receiver) {//DUDA que onda con esto?
      //           const metaData = poolList[i].metaData
      //           showSuccess(`Unstaked ${convertToDecimals(data, metaData.decimals, 2)} ${metaData.symbol}`)
      //           break;
      //         }
      //       }
      //       // }
      //       break;
      //     }
      //     case "ft_transfer_call": {
      //       /** TODO - Fix for mutliple transactions **/
      //       var receiver = finalExecutionOutcome?.transaction.receiver_id;
      //       for (let i = 0; i < poolList.length; i++) {
      //         if (poolList[i].tokenContract.contractId == receiver) {//DUDA que onda con esto?
      //           const metaData = poolList[i].metaData
      //           showSuccess(`Staked ${convertToDecimals(data, metaData.decimals, 2)} ${metaData.symbol}`)
      //           break;
      //         }
      //       }
      //       break;
      //     }
      //     default:
      //       showSuccess(data[0], "Transaction Result")
      //   }
      // }

    }
    else {
      //not signed-in 
      await signedOutFlow() //show home-not-connected -> select wallet page
    }
  }
  catch (ex) {
    showErr(ex)//DUDA q onda con esto?
  }
}

function showErrResult() {

}

async function stakeResult(argsArray: [{amount: string, msg: string, receiver_id: string}]) {
  let message = "Staked: "
  let tokensStakedMessage: string[] = []
  const poolList = await getPoolList(wallet)
  let pool: PoolParams | PoolParamsP3 | undefined
  for(let i = 0; i < poolList.length; i++) {
    if(argsArray[0].receiver_id == poolList[i].stakingContract.contractId) {
      pool = poolList[i]
      break
    }
  }
  if(!pool) {
    throw new Error(`No pool found with contract id ${argsArray[0].receiver_id}`)
  }

  await Promise.all(argsArray.map(async (args, index) => {
    console.log("Args:", args)
    // const args = JSON.parse(atob(finalExecutionOutcome.transaction.actions[0].FunctionCall.args))
    let metadata
    if(pool instanceof PoolParams) {
      metadata = await pool.stakeTokenContract.ft_metadata()
    } else if(pool instanceof PoolParamsP3) {
      metadata = await pool.stakeTokenContractList[index].contract.ft_metadata()
    }
    if(!metadata) {
      // This if should never be true
      throw new Error("Error obtaining metadata on stake result")
    }
    const amount = convertToDecimals(args.amount, metadata.decimals, 7)
    tokensStakedMessage.push(
      `${amount} ${metadata.symbol}`
    )
  }))
  message += tokensStakedMessage.join(" - ")
  showSuccess(message, "Stake")
}

async function unstakeResult(argsArray: [{amount: string, token: string}]) {
  let message = "Unstaked: "
  let tokensUnstakedMessage: string[] = []
  
  for(let i = 0; i < argsArray.length; i++) {
    const args = argsArray[i]
    let contract = new NEP141Trait(args.token)
    contract.wallet = wallet

    const metaData = await contract.ft_metadata()
    const amount = convertToDecimals(args.amount, metaData.decimals, 7)
    tokensUnstakedMessage.push(
      `${amount} ${metaData.symbol}`
    )
  }
  message += tokensUnstakedMessage.join(" - ")
  showSuccess(message, "Stake")
}

// NEW CODE
async function toggleActions(elementToShow: HTMLElement) {
  return function (event: Event) {
    event.preventDefault();
    let element = event.target as HTMLElement
    const tagName = element.tagName.toLowerCase()
    const tagsToIgnore = ["button", "input", "span", "img"]

    if (!tagsToIgnore.includes(tagName) || element.classList.contains("toggle-display")) {
      elementToShow.classList.toggle("hidden")
    }    
  }
}


function toggleElement(elementToShow: HTMLElement) {
  return function (event: Event) {
    event.preventDefault();
    elementToShow.classList.toggle("hidden");
  }
}

function paintOrUnPaintElement(previousColoringClass: string, elementToPaint: HTMLElement){
  return function (event: Event){
    event.preventDefault()
    elementToPaint.classList.toggle("transparent")
    elementToPaint.classList.toggle(previousColoringClass)
  }
}

function showElement(elementToShow: HTMLElement) {
  return function (event: Event) {
    event.preventDefault();
    elementToShow.classList.remove("hidden");
  }
}

function hideElement(elementToHide: HTMLElement) {
  return function (event: Event) {
    event.preventDefault();
    elementToHide.classList.add("hidden");
  }
}

function showElementHideAnother(elementToShow: HTMLElement, elementToHide: HTMLElement) {
  return function (event: Event) {
    event.preventDefault();
    elementToShow.classList.remove("hidden");
    elementToHide.classList.add("hidden");
  }
}

function setActiveColor(event: Event) {
  let element = event.target as HTMLElement
  element.classList.add("active");
}

function cancelActiveColor(elementToDisplayAsNotActive: HTMLElement) {
  return function (event: Event) {
    event.preventDefault();
    elementToDisplayAsNotActive.classList.remove("active");
  }
}