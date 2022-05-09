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
import { ContractData, HtmlPoolParams, PoolParamsP3 } from './entities/poolParamsP3';
import { U128String } from './wallet-api/util';
import { DetailRowElements, HTMLTokenInputData, TokenIconData, UnclaimedRewardsData } from './entities/genericData';

import * as nearAPI from "near-api-js"
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import { getPrice as getTokenData, getPrices as getTokenDataArray } from './util/oracle';
import { RefTokenData } from './entities/refResponse';

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
let loggedWithNarwallets = false

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
// qs('#near-web-wallet-box').onclick = loginNearWebWallet
// qs('#narwallets-wallet-box').onclick = loginNarwallets

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
// qs('#stake-form-not-connected').onsubmit =
//   async function (event) {
//     event.preventDefault()
//     sayChoose();
//   }


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


function depositClicked(poolParams: PoolParams|PoolParamsP3, pool: HTMLElement) {
  return async function (event: Event) {
    event.preventDefault()
    await poolParams.stakingContract.storageDeposit()
    
    pool.querySelector("#deposit")!.classList.remove("hidden")
    pool.querySelector("#activated")!.classList.add("hidden")
  }
}

async function getUnclaimedRewardsInUSDSingle(poolParams: PoolParams): Promise<number> {
  const rewardToken = "cheddar"
  const rewardTokenData: RefTokenData = await getTokenData(rewardToken)
  const metaData = await poolParams.cheddarContract.ft_metadata()
  const currentRewards: bigint = poolParams.resultParams.real
  const currentRewardsDisplayable = convertToDecimals(currentRewards, metaData.decimals, 5)
  return parseFloat(rewardTokenData.price) * parseFloat(currentRewardsDisplayable)
}

async function convertToUSDMultiple(tokenContractList: ContractData[], amountList: U128String[]): Promise<string> {
  // const stakeTokenContractList = poolParams.stakeTokenContractList
  const rewardTokenArray = tokenContractList.map(tokenContract => tokenContract.metaData.symbol)
  const rewardTokenDataMap: Map<string, RefTokenData> = await getTokenDataArray(rewardTokenArray)
  let amountInUsd: number = 0
  tokenContractList.forEach((tokenContract, index) => {
    const metaData = tokenContract.metaData
    const symbol = metaData.symbol
    const unclaimedRewards = amountList[index]
    const currentRewardsDisplayable = convertToDecimals(unclaimedRewards, metaData.decimals, 7)
    const tokenData = rewardTokenDataMap.get(symbol.toLowerCase())

    amountInUsd += parseFloat(tokenData!.price) * parseFloat(currentRewardsDisplayable)
  })

  return amountInUsd.toFixed(5)
}

async function getTotalStakedInUSDMultiple(poolParams: PoolParamsP3): Promise<number> {
  const stakeTokenContractList = poolParams.stakeTokenContractList
  const rewardTokenArray = stakeTokenContractList.map(stakeTokenContract => stakeTokenContract.metaData.symbol)
  const rewardTokenDataMap: Map<string, RefTokenData> = await getTokenDataArray(rewardTokenArray)
  let totalStaked = 0
  stakeTokenContractList.forEach((stakeTokenContract, index) => {
    const metaData = stakeTokenContract.metaData
    const symbol = metaData.symbol
    const unclaimedRewards = poolParams.resultParams.farmed[index]
    const currentRewardsDisplayable = convertToDecimals(unclaimedRewards, metaData.decimals, 7)
    const tokenData = rewardTokenDataMap.get(symbol.toLowerCase())

    totalStaked += parseFloat(tokenData!.price) * parseFloat(currentRewardsDisplayable)
  })

  return totalStaked
}

async function getUnclaimedRewardsInUSDMultiple(poolParams: PoolParamsP3): Promise<number> {
  const farmTokenContractList = poolParams.farmTokenContractList
  const rewardTokenArray = farmTokenContractList.map(farmTokenContract => farmTokenContract.metaData.symbol)
  const rewardTokenDataMap: Map<string, RefTokenData> = await getTokenDataArray(rewardTokenArray)
  let pendingRewards = 0
  farmTokenContractList.forEach((farmTokenContract, index) => {
    const metaData = farmTokenContract.metaData
    const symbol = metaData.symbol
    const unclaimedRewards = poolParams.resultParams.farmed[index]
    const currentRewardsDisplayable = convertToDecimals(unclaimedRewards, metaData.decimals, 7)
    const tokenData = rewardTokenDataMap.get(symbol.toLowerCase())

    pendingRewards += parseFloat(tokenData!.price) * parseFloat(currentRewardsDisplayable)
  })
  
  return pendingRewards
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
            
      await poolParams.stake(amountValues)
      if (loggedWithNarwallets) {
        //clear form
        for(let i = 0; i < inputArray.length; i++) {
          inputArray[i].value = ""  
        }
        
        poolParams.resultParams.addStaked(amountValues)
        // await refreshPoolInfoMultiple(poolParams, newPool)

        showSuccess(`Staked ${stakedAmountWithSymbol.join(" - ")}`)
      }

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
            
      await poolParams.unstake(amountValues)
      if (loggedWithNarwallets) {
        //clear form
        for(let i = 0; i < inputArray.length; i++) {
          inputArray[i].value = ""  
        }
        
        poolParams.resultParams.addStaked(amountValues.map(value => -value))
        // await refreshPoolInfoMultiple(poolParams, newPool)
  
        showSuccess(`Staked ${unstakedAmountWithSymbol.join(" - ")}`)
      }

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
      if (stakeAmount > parseFloat(walletAvailable)) throw Error(`Only ${walletAvailable} ${poolParams.stakingContractMetaData.symbol} Available to Stake.`);
      await poolParams.stakeTokenContract.ft_transfer_call(poolParams.stakingContract.contractId, convertToBase(stakeAmount.toString(), poolParams.stakingContractMetaData.decimals.toString()), "to farm")

      if (loggedWithNarwallets) {
        //clear form
        stakeInput.value = ""
        poolParams.resultParams.addStaked(ntoy(stakeAmount))
        refreshPoolInfo(poolParams, newPool)//DUDA esto no debería ser refreshPoolInfoSingle?
  
        showSuccess("Staked " + toStringDecMin(stakeAmount) + poolParams.stakingContractMetaData.symbol)
      }

    }
    catch (ex) {
      showErr(ex as Error)
    }

    // re-enable the form, whether the call succeeded or failed
    stakeInput.removeAttribute("disabled")
  }
}

// TODO DANI - implement
function harvestMultiple(poolParams: PoolParamsP3, newPool: HTMLElement) {
  return async function (event: Event) {
    event?.preventDefault()
    showWait("Harvesting...")

    await poolParams.stakingContract.withdraw_crop()

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
      const stakedDisplayable = Number(convertToDecimals(staked.toString(), poolParams.stakingContractMetaData.decimals, 5))
      if (isNaN(unstakeAmount)) {
        throw Error("Please Input a Number.")
      }
      
      if (unstakeAmount > stakedDisplayable) throw Error(`Only ${stakedDisplayable} ${poolParams.stakingContractMetaData.symbol} Available to Unstake.`);
      await poolParams.stakingContract.unstake(convertToBase(unstakeAmount.toString(), poolParams.stakingContractMetaData.decimals.toString()))
      
      if (loggedWithNarwallets) {
        //clear form
        unstakeInput.value = ""
  
        //refresh acc info
        refreshPoolInfo(poolParams, newPool)

        poolParams.resultParams.addStaked(ntoy(unstakeAmount))
        // refreshPoolInfoSingle(poolParams, newPool) //Esta línea la agregué porque pensé que corresponde pero realmente estoy confundido.
        showSuccess("Unstaked " + toStringDecMin(unstakeAmount) + poolParams.stakingContractMetaData.symbol)
      }
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
  let allYourFarmsPools = qsa(".your-farms")
  let allLivePools = qsa(".active-pool")
  const event= new Event ("click")
  //If you don´t have farms show live pools as default
  if (allYourFarmsPools.length == 0){
    qs("#live-filter")!.dispatchEvent(event)
    if (allLivePools.length == 0){
      qs("#ended-filter")!.dispatchEvent(event)
    }
  } else {
    qs("#your-farms-filter").dispatchEvent(event)
  }
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

function showOrHideMaxButton(walletBalance: String, elem: HTMLElement) {
  if (Number(walletBalance.replace(".", "")) > 0) {
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

function refreshPoolInfo(poolParams: PoolParams, newPool: HTMLElement){
  poolParams.resultParams.accName = poolParams.stakingContract.wallet.getAccountId()
}

async function refreshPoolInfoSingle(poolParams: PoolParams, newPool: HTMLElement){
  var metaData = poolParams.stakingContractMetaData;
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

//TODO MARTIN
async function refreshPoolInfoMultiple(poolParams: PoolParamsP3, newPool: HTMLElement){
  await poolParams.refreshAllExtraData()

  const totalStakedInUsd: string = await convertToUSDMultiple(poolParams.stakeTokenContractList, poolParams.contractParams.total_staked)
  newPool.querySelector(".total-staked-row .total-staked-value-usd")!.innerHTML = totalStakedInUsd
  const totalStakedDetailsElements: NodeListOf<HTMLElement> = newPool.querySelectorAll(".total-staked-info-container .detail-row")
  for(let i = 0; i < totalStakedDetailsElements.length; i++) {
    const row = totalStakedDetailsElements[i]
    const tokenMetadata = poolParams.stakeTokenContractList[i].metaData
    const content = convertToDecimals(poolParams.contractParams.total_staked[i], tokenMetadata.decimals, 7)
    row.querySelector(".content")!.innerHTML = content
    
  }

  // var metaData = poolParams.stakingContractMetaData;
  // let accName = poolParams.resultParams.accName
  
  // let accountInfo = await poolParams.stakingContract.status(accName)
  // let stakedArray = []
  // let displayableStakedArray = []
  
  // for (let i = 0; i < accountInfo.stake_tokens.length; i++) {
  //   stakedArray.push((accountInfo) ? BigInt(accountInfo.stake_tokens[i]) : 0)
  //   displayableStakedArray.push(convertToDecimals(stakedArray[i].toString(), metaData.decimals, 7))
  // }
  

  // let unstakeMaxButton = qs(".unstake .max-button") as HTMLElement
  // showOrHideMaxButton(displayableStakedArray.toString(), unstakeMaxButton)//Esto también


  // const walletBalancesArray = await poolParams.getWalletAvailableDisplayable()//DUDA Esto devuelve un array, revisar lo que lo usa.
  
  // let stakeMaxButton = qs(".stake .max-button") as HTMLElement
  // newPool.querySelector(".stake .value")!.innerHTML = removeDecZeroes(walletBalancesArray.toString())//Esto ya se hace, no?
  // showOrHideMaxButton(walletBalancesArray.toString(), stakeMaxButton)


  // setAccountInfo(poolParams, accountInfo)
  // let unclaimedRewards = poolParams.resultParams.getCurrentCheddarRewards()

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
  loggedWithNarwallets = true
  signedInFlow(wallet)
}

/// when the user chooses "disconnect from web-page" in the narwallets-chrome-extension
function narwalletDisconnected(ev: CustomEvent) {
  loggedWithNarwallets = false
  wallet = disconnectedWallet;

  signedOutFlow()
}

function calculateAmountHaveStaked(stakeRates: bigint[], amount: bigint, amountIndex: number, newAmountIndex: number) {
	const amountToStake = amount * stakeRates[newAmountIndex] / stakeRates[amountIndex]
	return amountToStake
}

function calculateAmountToStake(stakeRates: bigint[], totalStaked: bigint[], amount: bigint, amountIndex: number, newAmountIndex: number) {
	const totalAmountStakedWithThisStake = totalStaked[amountIndex] + amount
	const totalAmountToHaveStakedOfSecondaryToken = calculateAmountHaveStaked(stakeRates, totalAmountStakedWithThisStake, amountIndex, newAmountIndex)
	const amountToStake = totalAmountToHaveStakedOfSecondaryToken - totalStaked[newAmountIndex]
	return amountToStake > 0n ? amountToStake : 0n
}

function calculateAmountToUnstake(stakeRates: bigint[], totalStaked: bigint[], amount: bigint, alreadySetIndex: number, newIndex: number) {
	const totalAmountStakedWithThisUnstake = totalStaked[alreadySetIndex] - amount
	const totalAmountToHaveStakedOfSecondaryToken = calculateAmountHaveStaked(stakeRates, totalAmountStakedWithThisUnstake, alreadySetIndex, newIndex)
	const amountToUnstake = totalStaked[newIndex] - totalAmountToHaveStakedOfSecondaryToken
	return amountToUnstake > 0n ? amountToUnstake : 0n
}

function autoFillStakeAmount(poolParams: PoolParamsP3, pool: HTMLElement, inputRoute: string, index: number) {
  return function (event: Event) {
    event.preventDefault()
    const value1 = (event.target as HTMLInputElement).value
    const amountToStake = BigInt(convertToBase(value1, poolParams.stakeTokenContractList[index].metaData.decimals.toString()))

    let inputs: NodeListOf<HTMLInputElement> = pool.querySelectorAll(`${inputRoute} input`)! as NodeListOf<HTMLInputElement>
    const stakeRates = poolParams.contractParams.stake_rates.map(rate => BigInt(rate))
    const totalStaked = poolParams.resultParams.staked.map(total => BigInt(total))
    for(let i = 0; i < inputs.length; i++) {
      if(i != index) {
        let amountToTransferSecondaryBN
        if(inputRoute.includes("unstake")) {
          amountToTransferSecondaryBN = calculateAmountToUnstake(stakeRates, totalStaked, amountToStake, index, i)
        } else {
          amountToTransferSecondaryBN = calculateAmountToStake(stakeRates, totalStaked, amountToStake, index, i)
          
        }
        const amountToStakeSecondary = convertToDecimals(amountToTransferSecondaryBN, poolParams.stakeTokenContractList[i].metaData.decimals, 5)
        inputs.item(i).value = amountToStakeSecondary
      }
    }
  }
}

async function addPoolSingle(poolParams: PoolParams, newPool: HTMLElement): Promise<void> {
  const walletBalance: U128String = await poolParams.getWalletAvailable()

  const metaData = poolParams.stakingContractMetaData
  let totalStaked = poolParams.contractParams.total_staked.toString()
  const rewardsPerDay = getRewardsPerDaySingle(poolParams)

  const stakeTokenContractData: ContractData = await poolParams.getStakeTokenContractData();
  const farmTokenContractData: ContractData = await poolParams.getFarmTokenContractData();
  // var contractData = {
  //   contract: poolParams.stakeTokenContract,
  //   metaData: poolParams.metaData,
  //   balance: walletBalance
  // }

  addInput(newPool, stakeTokenContractData, "stake")
  addInput(newPool, stakeTokenContractData, "unstake", poolParams.resultParams.staked.toString())

  //ACA
  addFarmedTokensBasicInfo(poolParams, newPool, stakeTokenContractData)
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
  
  let unclaimedRewards = await getUnclaimedRewardsInUSDSingle(poolParams)

  newPool.querySelector(".unclaimed-rewards-dollars-value")!.innerHTML = unclaimedRewards.toFixed(7).toString()


  // let unstakeMaxButton = newPool.querySelector(`.unstake .max-button`) as HTMLElement
  // unstakeMaxButton.addEventListener("click", maxUnstakeClicked(newPool))
  // showOrHideMaxButton(stakedDisplayable.toString(), unstakeMaxButton)

  // if (Number(stakedDisplayable) > 0) {
  //   unstakeMaxButton.classList.remove("hidden")
  // }

  let totalFarmed = poolParams.contractParams.total_farmed.toString()
  newPool.querySelector(".total-token-farmed-value")!.innerHTML = convertToDecimals(totalFarmed, 24, 5)

  newPool.querySelector(".token-total-rewards-value")!.innerHTML = yton(rewardsPerDay.toString()).toString()

  // TODO reimplement when popup is ready
  // addTotalStaked(newPool, poolParams.metaData.symbol, convertToDecimals(totalStaked, metaData.decimals, 7).toString())
  // const contractData: ContractData = await poolParams.getStakeTokenContractData();
  const totalStakedInUsd = await convertToUSDMultiple([stakeTokenContractData], [poolParams.contractParams.total_staked])
  const totalFarmedInUsd = await convertToUSDMultiple([farmTokenContractData], [(BigInt(poolParams.contractParams.farming_rate) * 60n * 24n).toString()])
  newPool.querySelector(".total-staked-value-usd")!.innerHTML = totalStakedInUsd
  newPool.querySelector(".total-farmed-value-usd")!.innerHTML = totalFarmedInUsd

  newPool.querySelector("#stake-button")?.addEventListener("click", stakeSingle(poolParams, newPool))

  newPool.querySelector("#unstake-button")?.addEventListener("click", unstakeSingle(poolParams, newPool))

  newPool.querySelector("#activate")?.addEventListener("click", depositClicked(poolParams, newPool))

  newPool.querySelector("#harvest-button")?.addEventListener("click", harvestSingle(poolParams, newPool))


  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  if(isDateInRange) {
    window.setInterval(refreshPoolInfoSingle.bind(null, poolParams, newPool), 5000)
  }
}

//ACA
function addFarmedTokensBasicInfo(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement, contractData: ContractData) {
  const poolContainer = newPool.querySelector("#pool-container") as HTMLElement
  const tokenPoolStatsContainer = newPool.querySelector("#token-pool-stats") as HTMLElement

  addStakedTokenBasicData(poolParams, newPool, contractData)

  const genericNewPoolHeader = qs(".generic-new-pool-header") as HTMLElement
  const newNewPoolHeader = genericNewPoolHeader.cloneNode(true) as HTMLElement
  
  newNewPoolHeader.classList.remove("hidden")
  newNewPoolHeader.classList.remove("generic-new-pool-header")
  

  const newTokenPoolStats = newNewPoolHeader.cloneNode(true) as HTMLElement


  poolContainer.prepend(newNewPoolHeader)
  tokenPoolStatsContainer.prepend(newTokenPoolStats)
}

async function addPoolMultiple(poolParams: PoolParamsP3, newPool: HTMLElement): Promise<void> {
  //ACA  descomentar esto cuando .getStakeTokenContractData esté bien implementado
  // const stakeTokenContractData: ContractData = await poolParams.getStakeTokenContractData();
  let tokenSymbols = []
  await poolParams.getWalletAvailable()
  for(let i=0; i < poolParams.stakeTokenContractList.length; i++){
    const contractData = poolParams.stakeTokenContractList[i]
    const metaData = contractData.metaData

    addInput(newPool, contractData, "stake")
    addInput(newPool, contractData, "unstake", poolParams.resultParams.staked[i])

    // addFarmedTokensBasicInfo(poolParams, newPool, stakeTokenContractData)
    
    tokenSymbols.push(`${metaData.symbol.toLowerCase()}`)

    newPool.querySelector("#harvest-button")?.addEventListener("click", harvestMultiple(poolParams, newPool))

    
  }

  // const unclaimedRewards = await getUnclaimedRewardsInUSDMultiple(poolParams)
  const unclaimedRewards = await convertToUSDMultiple(poolParams.farmTokenContractList, poolParams.resultParams.farmed)

  newPool.querySelector(".unclaimed-rewards-dollars-value")!.innerHTML = unclaimedRewards

  const totalStakedInUsd: string = await convertToUSDMultiple(poolParams.stakeTokenContractList, poolParams.contractParams.total_staked)
  newPool.querySelector(".total-staked-row .total-staked-value-usd")!.innerHTML = totalStakedInUsd

  const rewardsPerDay = poolParams.contractParams.farm_token_rates.map(rate => (BigInt(rate) * 60n * 24n).toString())
  const totalFarmedInUsd = await convertToUSDMultiple(poolParams.farmTokenContractList, rewardsPerDay)
  newPool.querySelector(".total-farmed-value-usd")!.innerHTML = totalFarmedInUsd
  // TODO reimplement when popup is ready
  // for(let i = poolParams.contractParams.total_staked.length - 1; i >= 0; i--) {
  //   const tokenName = poolParams.stakeTokenContractList[i].metaData.symbol
  //   const totalStaked = convertToDecimals(poolParams.contractParams.total_staked[i], poolParams.stakeTokenContractList[i].metaData.decimals, 7)

  //   addTotalStaked(newPool, tokenName, totalStaked)
  // }

  //I use this 2 for loops to match every combination of inputs without repeating itself
  for (let i=0; i < tokenSymbols.length; i++){
    newPool.querySelector(`.main-stake .${tokenSymbols[i]}-input input`)!.addEventListener("input", autoFillStakeAmount(poolParams, newPool, `.main-stake`, i))
    newPool.querySelector(`.main-unstake .${tokenSymbols[i]}-input input`)!.addEventListener("input", autoFillStakeAmount(poolParams, newPool, `.main-unstake`, i))
  }

  newPool.querySelector("#stake-button")?.addEventListener("click", stakeMultiple(poolParams, newPool))
  newPool.querySelector("#unstake-button")?.addEventListener("click", unstakeMultiple(poolParams, newPool))
  
  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  if(isDateInRange) {
    window.setInterval(refreshPoolInfoMultiple.bind(null, poolParams, newPool), 5000)
  }
}

function addFocusClass(input:HTMLElement) {
  return function (event:Event) {
    event?.preventDefault
    input.classList.toggle("focused")
  }
}

// function addTotalStaked(newPool: HTMLElement, tokenName: string, value: string) {
//   let totalStakedContainer = qs(".generic-total-staked-row")
//   var newTotalStakedContainer = totalStakedContainer.cloneNode(true) as HTMLElement
  
//   newTotalStakedContainer.querySelector(".token-name")!.innerHTML = tokenName
//   newTotalStakedContainer.querySelector(".total-staked-value")!.innerHTML = value

//   toggleGenericClass(newTotalStakedContainer, "total-staked-row")
//   newPool.querySelector(`.main-contract-information ul`)!.prepend(newTotalStakedContainer)

// }

function addInput(newPool: HTMLElement, contractData: ContractData, action: string, stakedAmount?: U128String) {
  let inputContainer = qs(".generic-token-input-container")
  var newInputContainer = inputContainer.cloneNode(true) as HTMLElement
  let inputRowContainer = newInputContainer.querySelector(".input-container") as HTMLElement
  let infoRowContainer = newInputContainer.querySelector(".available-info") as HTMLElement
  let input = newInputContainer.querySelector("input") as HTMLElement
  
  const metaData = contractData.metaData
  newInputContainer.classList.remove("generic-token-input-container")
  newInputContainer.classList.add("token-input-container")
  newInputContainer.classList.add(`${metaData.symbol.toLowerCase()}-input`)
  newInputContainer.classList.remove(`hidden`)

  newInputContainer.querySelector(".available-info span")!.innerHTML = `Available to ${action}`
  newInputContainer.querySelector(".amount-available")?.classList.add(action)

  input!.addEventListener("focus", addFocusClass(inputRowContainer!))
  input!.addEventListener("blur", addFocusClass(inputRowContainer!))
  
  let inputLogoContainer = newInputContainer.querySelector(".input-container .token-logo") as HTMLElement
  let amountAvailableValue = newInputContainer.querySelector(".amount-available .value")
  let maxButton = infoRowContainer.querySelector(".max-button") as HTMLElement

  if (metaData.icon != null){
    // inputLogoContainer.innerHTML= `${metaData.icon}`
    if(metaData.icon.startsWith("data:image/svg+xml")) {
      let tokenLogoElement = newInputContainer.querySelector("img.token-logo")
      tokenLogoElement?.setAttribute("src", metaData.icon)
      inputLogoContainer?.classList.remove("hidden")
    } else if(metaData.icon.startsWith("<svg")) {
      let tokenLogoElement = newInputContainer.querySelector("div.token-logo-svg-container")
      tokenLogoElement!.innerHTML = metaData.icon
      tokenLogoElement!.classList.remove("hidden")
    }
  } else {
    inputLogoContainer.innerHTML= `${metaData.name}`
    inputLogoContainer?.classList.remove("hidden")
  }

  if(action == "stake") {
    amountAvailableValue!.innerHTML= convertToDecimals(contractData.balance, contractData.metaData.decimals, 7)
    maxButton.addEventListener("click", inputMaxButtonClicked(newInputContainer))
  } else if(action == "unstake") {
    amountAvailableValue!.innerHTML= convertToDecimals(stakedAmount!, contractData.metaData.decimals, 7)
    maxButton.addEventListener("click", inputMaxButtonClicked(newInputContainer))
  }
  
  showOrHideMaxButton(contractData.balance, maxButton)


  newPool.querySelector(`.main-${action}`)!.append(newInputContainer)
}

async function toggleExpandStakeUnstakeSection (newPool: HTMLElement, elemWithListener: HTMLElement){
  let expandPoolButton = newPool.querySelector(".expand-button")! as HTMLElement;
  let hidePoolButton = newPool.querySelector(".hide-button")! as HTMLElement;
  let stakingUnstakingContainer = newPool.querySelector("#activated")! as HTMLElement;
  elemWithListener.addEventListener("click", toggleActions(expandPoolButton));
  elemWithListener.addEventListener("click", toggleActions(hidePoolButton));
  elemWithListener.addEventListener("click", toggleActions(stakingUnstakingContainer));
}

function standardHoverToDisplayExtraInfo (elementWithListenner: HTMLElement, elementShown: HTMLElement) {
  elementWithListenner.addEventListener("mouseover", toggleElement(elementShown));
  elementWithListenner.addEventListener("mouseout", toggleElement(elementShown));
  elementShown.addEventListener("mouseover", showElement(elementShown));
  elementShown.addEventListener("mouseout", hideElement(elementShown));
}

async function addPool(poolParams: PoolParams | PoolParamsP3): Promise<void> {
  var genericPoolElement = qs("#generic-pool-container") as HTMLElement;
  var metaData = poolParams.stakingContractMetaData;
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
  // let poolContainer = newPool.querySelector("#pool-container")! as HTMLElement
  let showContractStart = newPool.querySelector("#contract-start")
  let showContractEnd = newPool.querySelector("#contract-end")
  // let showAndHideVisibilityTool = newPool.querySelector(".visual-tool-expanding-indication-hidden")! as HTMLElement;
  let infoIcon = newPool.querySelector("#new-pool-header .information-icon-container")! as HTMLElement;
  let poolStats = newPool.querySelector("#token-pool-stats")! as HTMLElement;
  // let hidePoolButton = newPool.querySelector(".hide-button")! as HTMLElement;
  // let stakeTabButton = newPool.querySelector(".staking")! as HTMLElement;
  // let unstakeTabButton = newPool.querySelector(".unstaking")! as HTMLElement;
  // let staking = newPool.querySelector(".main-stake")! as HTMLElement;
  // let unstaking = newPool.querySelector(".main-unstake")! as HTMLElement;
  // let stakeButton = newPool.querySelector("#stake-button")! as HTMLElement;
  // let unstakeButton = newPool.querySelector("#unstake-button")! as HTMLElement;
  var contractParams = poolParams.contractParams;
  let totalStakedValueUsd = newPool.querySelector(".total-staked-value-usd")! as HTMLElement;
  let totalStakedInfoContainer = newPool.querySelector(".total-staked-info-container")! as HTMLElement;
  let totalFarmedValueUsd = newPool.querySelector(".total-farmed-value-usd")! as HTMLElement;
  let totalFarmedInfoContainer = newPool.querySelector(".total-farmed-info-container")! as HTMLElement;
  let rewardTokensValue = newPool.querySelector(".reward-tokens-value")! as HTMLElement;
  let rewardTokensInfoContainer = newPool.querySelector(".reward-tokens-info-container")! as HTMLElement;
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

  // let activateButtonContainer = newPool.querySelector("#activate") as HTMLElement
  // let activateButton = newPool.querySelector(".activate") as HTMLElement
  // let activated = newPool.querySelector("#activated") as HTMLElement
  // let harvestButton = newPool.querySelector("#harvest-button") as HTMLElement
  // If is not registered, returns null
  // let isAccountRegistered = (await poolParams.stakingContract.storageBalance()) != null;


  // TODO Martin - add classes in html and not here (as default)
  // activated.classList.add("hidden")
  // activateButtonContainer.classList.add("hidden")
  // harvestButton.classList.add("hidden")
  const isUserFarming = newPool.classList.contains("your-farms")
  if(newPool.classList.contains("inactive-pool")) {
    // Completely ended contract. Don't put listeners regarding stake/unstake/harvest/activate
    displayInactivePool(newPool, isUserFarming)
  } else {
    await displayActivePool(poolParams, newPool, isUserFarming)
    // Shows or hides the "Staking/Unstaking" text
    // newPool.addEventListener("mouseover", paintOrUnPaintElement("visual-tool-expanding-indication-hidden", showAndHideVisibilityTool));
    // newPool.addEventListener("mouseout", paintOrUnPaintElement("visual-tool-expanding-indication-hidden",showAndHideVisibilityTool));
    // // Live and ended contracts.
    // expandPoolButton.classList.remove("hidden")
    

    // toggleExpandStakeUnstakeSection(newPool, poolContainer)
    // toggleExpandStakeUnstakeSection(newPool, expandPoolButton)
    // toggleExpandStakeUnstakeSection(newPool, hidePoolButton)

    // unstakeTabButton.addEventListener("click", showElementHideAnother(unstaking, staking));
    // unstakeTabButton.addEventListener("click", showElementHideAnother(unstakeButton, stakeButton));
    // unstakeTabButton.addEventListener("click", setActiveColor);
    // unstakeTabButton.addEventListener("click", cancelActiveColor(stakeTabButton));
    
    // if (newPool.classList.contains("active-pool")) {
    //   stakeTabButton.addEventListener("click", showElementHideAnother(staking, unstaking));
    //   stakeTabButton.addEventListener("click", showElementHideAnother(stakeButton, unstakeButton));
    //   stakeTabButton.addEventListener("click", setActiveColor);
    //   stakeTabButton.addEventListener("click", cancelActiveColor(unstakeTabButton));
      
    //   if (!newPool.classList.contains("your-farms")) {
    //     activateButtonContainer.classList.remove("hidden")
    //     activateButton.addEventListener("click", depositClicked(poolParams, newPool))
        
    //     if (poolParams.html.formId == "nearcon" || poolParams.html.formId == "cheddar") {
    //       let warningText = "ONLY ACTIVATE IF PREVIOUSLY STAKED<br>0.06 NEAR storage deposit, gets refunded."
    //       newPool.querySelector("#depositWarning")!.innerHTML = warningText
          
    //     }
    //   } else {
    //     activateButtonContainer.classList.add("hidden")
    //     activateButton.setAttribute("disabled", "disabled")
    //     harvestButton.classList.remove("hidden")
    //   }
      
    // } else {
    //   newPool.querySelector("#staking-unstaking-container .staking")!.setAttribute("disabled", "disabled")
    //   const event= new Event ("click")
    //   newPool.querySelector("#staking-unstaking-container .unstaking")!.dispatchEvent(event)
    // }
  }

  await addRewardTokenIcons(poolParams, newPool)
  await addRewardsTokenDetail(poolParams, newPool)
  await addUnclaimedRewardsDetail(poolParams, newPool)
  await addRewardsPerDayDetail(poolParams, newPool)
  await addTotalStakedDetail(poolParams, newPool)
  
  standardHoverToDisplayExtraInfo(totalStakedValueUsd, totalStakedInfoContainer)
  standardHoverToDisplayExtraInfo(totalFarmedValueUsd, totalFarmedInfoContainer)
  standardHoverToDisplayExtraInfo(rewardTokensValue, rewardTokensInfoContainer)
  standardHoverToDisplayExtraInfo(unclaimedRewardsDollarsValue, unclaimedRewardsInfoContainer)
  // await addUnclaimedRewards(poolParams, newPool)

  qs("#pool_list").append(newPool)

  newPool.querySelector(".deposit-fee-value")!.innerHTML = (contractParams.fee_rate) ? contractParams.fee_rate / 100 + "%" : "0%"
}

function displayInactivePool(newPool: HTMLElement, isUserFarming: boolean) {
  if(isUserFarming) {
    toggleStakeUnstakeSection(newPool)
    setUnstakeTabListeners(newPool)

    newPool.querySelector("#staking-unstaking-container .staking")!.setAttribute("disabled", "disabled")
    const event= new Event ("click")
    newPool.querySelector("#staking-unstaking-container .unstaking")!.dispatchEvent(event)
  }
}

function toggleStakeUnstakeSection(newPool: HTMLElement) {
  let showAndHideVisibilityTool = newPool.querySelector(".visual-tool-expanding-indication-hidden")! as HTMLElement;
  newPool.addEventListener("mouseover", paintOrUnPaintElement("visual-tool-expanding-indication-hidden", showAndHideVisibilityTool));
  newPool.addEventListener("mouseout", paintOrUnPaintElement("visual-tool-expanding-indication-hidden",showAndHideVisibilityTool));

  let expandPoolButton = newPool.querySelector(".expand-button")! as HTMLElement;
  let poolContainer = newPool.querySelector("#pool-container")! as HTMLElement
  let hidePoolButton = newPool.querySelector(".hide-button")! as HTMLElement;
  expandPoolButton.classList.remove("hidden")
  toggleExpandStakeUnstakeSection(newPool, poolContainer)
  toggleExpandStakeUnstakeSection(newPool, expandPoolButton)
  toggleExpandStakeUnstakeSection(newPool, hidePoolButton)
}

function setUnstakeTabListeners(newPool: HTMLElement) {
  let stakeTabButton = newPool.querySelector(".staking")! as HTMLElement;
  let unstakeTabButton = newPool.querySelector(".unstaking")! as HTMLElement;
  let staking = newPool.querySelector(".main-stake")! as HTMLElement;
  let unstaking = newPool.querySelector(".main-unstake")! as HTMLElement;
  let stakeButton = newPool.querySelector("#stake-button")! as HTMLElement;
  let unstakeButton = newPool.querySelector("#unstake-button")! as HTMLElement;

  unstakeTabButton.addEventListener("click", showElementHideAnother(unstaking, staking));
  unstakeTabButton.addEventListener("click", showElementHideAnother(unstakeButton, stakeButton));
  unstakeTabButton.addEventListener("click", setActiveColor);
  unstakeTabButton.addEventListener("click", cancelActiveColor(stakeTabButton));
}

async function displayActivePool(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement, isUserFarming: boolean) {
  let activateButtonContainer = newPool.querySelector("#activate") as HTMLElement
  let activateButton = newPool.querySelector(".activate") as HTMLElement
  // let activated = newPool.querySelector("#activated") as HTMLElement
  let harvestButton = newPool.querySelector("#harvest-button") as HTMLElement
  let isAccountRegistered = (await poolParams.stakingContract.storageBalance()) != null;

  if(isAccountRegistered) {
    toggleStakeUnstakeSection(newPool)

    let stakeTabButton = newPool.querySelector(".staking")! as HTMLElement;
    let unstakeTabButton = newPool.querySelector(".unstaking")! as HTMLElement;
    let staking = newPool.querySelector(".main-stake")! as HTMLElement;
    let unstaking = newPool.querySelector(".main-unstake")! as HTMLElement;
    let stakeButton = newPool.querySelector("#stake-button")! as HTMLElement;
    let unstakeButton = newPool.querySelector("#unstake-button")! as HTMLElement;

    setUnstakeTabListeners(newPool)
    // unstakeTabButton.addEventListener("click", showElementHideAnother(unstaking, staking));
    // unstakeTabButton.addEventListener("click", showElementHideAnother(unstakeButton, stakeButton));
    // unstakeTabButton.addEventListener("click", setActiveColor);
    // unstakeTabButton.addEventListener("click", cancelActiveColor(stakeTabButton));

    stakeTabButton.addEventListener("click", showElementHideAnother(staking, unstaking));
    stakeTabButton.addEventListener("click", showElementHideAnother(stakeButton, unstakeButton));
    stakeTabButton.addEventListener("click", setActiveColor);
    stakeTabButton.addEventListener("click", cancelActiveColor(unstakeTabButton));
  } else {
    activateButtonContainer.classList.remove("hidden")
    activateButton.addEventListener("click", depositClicked(poolParams, newPool))

    if (poolParams.html.formId == "nearcon" || poolParams.html.formId == "cheddar") {
      let warningText = "ONLY ACTIVATE IF PREVIOUSLY STAKED<br>0.06 NEAR storage deposit, gets refunded."
      newPool.querySelector("#depositWarning")!.innerHTML = warningText 
    }
  }

  if(isUserFarming) {
    activateButtonContainer.classList.add("hidden")
    activateButton.setAttribute("disabled", "disabled")
    harvestButton.classList.remove("hidden")
  }
}

//ACA
async function addStakedTokenBasicData(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement, contractData: ContractData) {
  const tokenIconDataArray: TokenIconData[] = await poolParams.getStakedTokenIconData()
  const container = newPool.querySelector(".token-logo-container") as HTMLElement
  const namesContainer = newPool.querySelector("#token-name-container") as HTMLElement
  const genericTokenNameTag = newPool.querySelector(".generic-token-name") as HTMLElement
  const tokenSvgLogoContainerLogoContainer = container.querySelector(".token-logo-svg-container")
  const metaData = contractData.metaData
  
  for(let i = 0; i < tokenIconDataArray.length; i++) {
    const tokenIconData = tokenIconDataArray[i]
    
    if (metaData.icon != null){
      // inputLogoContainer.innerHTML= `${metaData.icon}`
      if(metaData.icon.startsWith("data:image/svg+xml")) {
        let tokenLogoElement = container.querySelector("img")
        tokenLogoElement?.setAttribute("src", metaData.icon)
        tokenSvgLogoContainerLogoContainer?.classList.remove("hidden")
      } else if(metaData.icon.startsWith("<svg")) {
        let tokenLogoElement = container.querySelector("div.token-logo-svg-container")
        tokenLogoElement!.innerHTML = metaData.icon
        tokenLogoElement!.classList.remove("hidden")
      }
    } else {
      tokenSvgLogoContainerLogoContainer!.innerHTML= `${metaData.name}`
      tokenSvgLogoContainerLogoContainer?.classList.remove("hidden")
    }

    const newFarmedTokenName = genericTokenNameTag.cloneNode(true) as HTMLElement
    
    newFarmedTokenName.innerHTML = tokenIconData.tokenName
    toggleGenericClass(newFarmedTokenName, "token-name")
    
    namesContainer.append(newFarmedTokenName)
  }
}

async function addRewardTokenIcons(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  const tokenIconDataArray: TokenIconData[] = await poolParams.getRewardTokenIconData()
  const container = newPool.querySelector(".reward-tokens-value") as HTMLElement
  
  for(let i = 0; i < tokenIconDataArray.length; i++) {
    const tokenIconData = tokenIconDataArray[i]
    
    var newMiniIcon = importMiniIcon(tokenIconData) as HTMLElement
    container.append(newMiniIcon)
  }
}

async function addTotalStakedDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  const stakeTokenDataArray = poolParams.getStakeTokensDetail()
  let totalStakedRows: DetailRowElements = {
    parentClass: "total-staked-info-container",
    rows: []
  }

  for(let i = 0; i < stakeTokenDataArray.length; i++) {
    let stakeTokenData = stakeTokenDataArray[i]
    const row = {
      iconData: stakeTokenData.iconData,
	    content: stakeTokenData.content
    }

    totalStakedRows.rows.push(row)
  }

  addDetailRows(newPool, totalStakedRows) 
  // const totalStakedArray = poolParams.contractParams.total_staked
  // const stakeTokenContractList = poolParams.stakeTokenContractList
  // let totalStakedRows: DetailRowElements = {
  //   parentClass: "reward-tokens-info-container",
  //   rows: []
  // }
  // for(let i = 0; i < totalStakedArray.length; i++) {
  //   let totalStaked = totalStakedArray[i]
  //   let stakeTokenContractData = stakeTokenContractList[i]
  //   const row = {
  //     iconData: totalStaked,
	//     content: totalStaked.tokenName
  //   }

  //   rewardTokenIconElements.rows.push(row)
  // }
}

async function addRewardsPerDayDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  convertAndAddRewardDataRows(poolParams, newPool, "total-farmed-info-container", "rewardsPerDay")
}

// TODO MARTIN call method when below TODO is done
async function addTotalFarmedDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement, tokenContractList: ContractData[]) {
  // TODO MARTIN implement total farmed in html and put class. It's in info and should be down
  convertAndAddRewardDataRows(poolParams, newPool, "", "totalRewards")
}

async function convertAndAddRewardDataRows(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement, parentClass: string, key: string) {
  const rewardsTokenDataArray = poolParams.getRewardsTokenDetail()
  let rewardsPerDayRows: DetailRowElements = {
    parentClass,
    rows: []
  }
  for(let i = 0; i < rewardsTokenDataArray.length; i++) {
    let rewardsTokenData = rewardsTokenDataArray[i]
    const row = {
      iconData: rewardsTokenData.iconData,
      // @ts-ignore
	    content: rewardsTokenData[key]
    }

    rewardsPerDayRows.rows.push(row)
  }
  addDetailRows(newPool, rewardsPerDayRows)  
}

async function addRewardsTokenDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  convertAndAddRewardDataRows(poolParams, newPool, "reward-tokens-info-container", "tokenName")
}

function addDetailRows(newPool: HTMLElement, rowsData: DetailRowElements) {
  const parentElement = newPool.querySelector(`.${rowsData.parentClass}`) as HTMLElement
  const genericRow = qs(`.generic-detail-row`) as HTMLElement
  // const unclaimedRewardsDataArray = await poolParams.getUnclaimedRewardsData()
  const rows = rowsData.rows

  for(let i = 0; i < rows.length; i++) {
    const newRow = genericRow.cloneNode(true) as HTMLElement
    let row = rows[i]
    newRow.querySelector(".content")!.innerHTML = row.content

    const iconContainer = newRow.querySelector(".icon") as HTMLElement
    
    var newMiniIcon = importMiniIcon(row.iconData) as HTMLElement
    
    iconContainer.append(newMiniIcon)
    toggleGenericClass(newRow, "detail-row")
    console.log("Token name", row.iconData.tokenName)
    newRow.classList.add(row.iconData.tokenName.toLowerCase().replace(/ /g, "-"))
    parentElement.append(newRow)

  }
}

async function addUnclaimedRewardsDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  convertAndAddRewardDataRows(poolParams, newPool, "unclaimed-rewards-info-container", "userUnclaimedRewards")

  // const unclaimedRewardsInfoRowContainer = newPool.querySelector(".unclaimed-rewards-info-container") as HTMLElement
  // const genericUnclaimedRewardsRow = qs(".generic-unclaimed-rewards-row") as HTMLElement
  // const icon = qs(".generic-mini-icon")
  // const unclaimedRewardsDataArray = await poolParams.getUnclaimedRewardsData()
  
  // for(let i = 0; i < unclaimedRewardsDataArray.length; i++) {
  //   const newUnclaimedRewardsRow = genericUnclaimedRewardsRow.cloneNode(true) as HTMLElement
  //   let unclaimedRewardData = unclaimedRewardsDataArray[i]
  //   newUnclaimedRewardsRow.querySelector(".amount")!.innerHTML = unclaimedRewardData.amount

  //   const iconContainer = newUnclaimedRewardsRow.querySelector(".icon") as HTMLElement
    
  //   var newMiniIcon = importMiniIcon(unclaimedRewardData.iconData, icon) as HTMLElement
    
  //   iconContainer.append(newMiniIcon)
  //   toggleGenericClass(newUnclaimedRewardsRow, "unclaimed-rewards-row")
  //   unclaimedRewardsInfoRowContainer.append(newUnclaimedRewardsRow)

  // }
}

function importMiniIcon(iconData: TokenIconData){
  const iconNode: HTMLElement = qs(".generic-mini-icon")
  var parser = new DOMParser();
  var newMiniIcon: HTMLElement
    if(iconData.isSvg) {
      var doc = parser.parseFromString(iconData.src, "image/svg+xml");
      newMiniIcon = doc.documentElement
    } else {
      newMiniIcon = iconNode.cloneNode(true) as HTMLElement
      newMiniIcon.setAttribute("src", iconData.src)
      newMiniIcon.setAttribute("alt", iconData.tokenName)
    }
    toggleGenericClass(newMiniIcon, "mini-icon")
    return newMiniIcon
}

function toggleGenericClass(element: HTMLElement, className: string) {
  element.classList.remove(`generic-${className}`)
  element.classList.add(`${className}`)
  element.classList.remove("hidden")
}

function getRewardsPerDaySingle(poolParams: PoolParams) {
  return BigInt(poolParams.contractParams.farming_rate) * 60n * 24n
}

function inputMaxButtonClicked(newInputContainer: HTMLElement) {
  return function (event: Event) {
    event.preventDefault()

    let input = newInputContainer.querySelector("input") as HTMLInputElement
    const amount = newInputContainer.querySelector(".value")!.innerHTML
    const inputEvent= new Event ("input")

    
    input.value = amount.toString()
    input.dispatchEvent(inputEvent)
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

    //DUDA para que es esto? Esto era para el lanzamiento de la app.
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
      wallet = new NearWebWallet(nearWebWalletConnection);//DUDA esto vamos a tener que probar bien pero safa?
      
      accountName = wallet.getAccountId()
      qsInnerText("#account-id", accountName)
      await signedInFlow(wallet)
      const cheddarContractName = (ENV == 'mainnet') ? CHEDDAR_CONTRACT_NAME : TESTNET_CHEDDAR_CONTRACT_NAME
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
      //     if (poolList[i].stakingContract.contractId == receiver) {
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
      //         if (poolList[i].tokenContract.contractId == receiver) {
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
      //         if (poolList[i].tokenContract.contractId == receiver) {
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
      // await signedOutFlow() //show home-not-connected -> select wallet page
    }
  }
  catch (ex) {
    showErr(ex as Error)
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
function toggleActions(elementToShow: HTMLElement) {
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