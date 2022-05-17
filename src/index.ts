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
import { qs, qsa, qsi, showWait, showErr, showSuccess, showMessage, show, hide, hideOverlay, showError, showPopup, qsInnerText, qsaAttribute } from './util/document';
import { checkRedirectSearchParamsMultiple } from './wallet-api/near-web-wallet/checkRedirectSearchParams';
import { FungibleTokenMetadata, NEP141Trait } from './contracts/NEP141';
import { PoolParams } from './entities/poolParams';
import { getPoolList } from './entities/poolList';
import { ContractData, PoolParamsP3 } from './entities/poolParamsP3';
import { U128String } from './wallet-api/util';
import { DetailRowElements, HTMLTokenInputData, TokenIconData } from './entities/genericData';

import * as nearAPI from "near-api-js"
import { getPrice as getTokenData, getPrices as getTokenDataArray } from './util/oracle';
import { RefTokenData } from './entities/refResponse';
import { ContractParams } from './contracts/contract-structs';
import { P3ContractParams, Status } from './contracts/p3-structures';
import { nftBaseUrl } from './contracts/NFTContract';
import { newNFT, NFT } from './contracts/nft-structs';

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
qs('nav #my-account').onclick = navClickHandler_ConnectFirst

qs('nav #faq').onclick = () => { showSection("#faq") }

function sayChoose() {
  showMessage("Please choose a wallet to connect", "Connect first");
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
  let boundary: string[]
  if(action == "stake") {
    boundary = await poolParams.getWalletAvailable()
  } else if(action == "unstake") {
    boundary = poolParams.resultParams.staked
  } else {
    throw Error(`Action ${action} not available`)
  }
  
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
    if(BigInt(boundary[i]) < stakeAmountBN) {
      const balanceDisplayable = convertToDecimals(boundary[i], metaData.decimals, 7)
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
  signedInFlow(disconnectedWallet)
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
  // await refreshAccountInfoGeneric(poolList)
  if(wallet == disconnectedWallet) {

  } else {
    qs(".user-info #account-id").innerText = poolList[0].resultParams.getDisplayableAccountName()
  }
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

function showOrHideMaxButton(walletBalance: number, elem: HTMLElement) {
  if (walletBalance > 0) {
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

let dateInRangeHack = false

function setDateInRangeVisualIndication(newPool: HTMLElement, isDateInRange: boolean) {
  let dateInRangeIndicator = newPool.querySelector(".date-in-range-indicator circle") as HTMLElement
  let elementsToAplyOpacity = [
    "#contract-period-container",
    ".new-pool-header",
    "#token-pool-stats .new-pool-header",
    "#token-pool-stats .first-token",
    "#token-pool-stats .token-stats",
    ".total-staked",
    ".total-staked-value-usd",
    ".total-farmed",
    ".total-farmed-value-usd",
    ".rewards-per-day",
    ".rewards-per-day-value-usd",
    ".reward-tokens",
    ".reward-tokens-value-usd"
  ]
  if(isDateInRange) {
    dateInRangeIndicator.classList.remove("offDate")
    dateInRangeIndicator.classList.add("onDate")
    elementsToAplyOpacity.forEach(element => {
      newPool.querySelector(element)?.classList.remove("poolOffDate")
    });
  } else {
    dateInRangeIndicator.classList.remove("onDate")
    dateInRangeIndicator.classList.add("offDate")
    elementsToAplyOpacity.forEach(element => {
      newPool.querySelector(element)?.classList.add("poolOffDate")
    });
  }
}

async function refreshPoolInfoSingle(poolParams: PoolParams, newPool: HTMLElement){
  await poolParams.refreshAllExtraData()

  updateDetail(newPool, poolParams.stakeTokenContractList, [poolParams.contractParams.total_staked], "total-staked")
  updateDetail(newPool, poolParams.farmTokenContractList, [poolParams.contractParams.total_farmed], "total-farmed")
  updateDetail(newPool, poolParams.farmTokenContractList, convertRewardsRates([poolParams.contractParams.farming_rate.toString()]), "rewards-per-day")
  updateDetail(newPool, poolParams.farmTokenContractList, [poolParams.resultParams.real.toString()], "unclaimed-rewards")

  const stakeBalances = poolParams.stakeTokenContractList.map(stakeCD => stakeCD.balance)
  refreshInputAmounts(poolParams, newPool, "main-stake", stakeBalances)
  refreshInputAmounts(poolParams, newPool, "main-unstake", [poolParams.resultParams.staked.toString()])

  if(poolParams.resultParams.staked == 0n) {
    newPool.classList.remove("your-farms")
    const isContractActivated = (await poolParams.stakingContract.storageBalance()) != null;
    if(isContractActivated) {
      newPool.querySelector("#activate")?.classList.add("hidden")
    } else {
      newPool.querySelector("#activate")?.classList.remove("hidden")
    }
  }

  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  if(!isDateInRange) {    
    resetSinglePoolListener(poolParams, newPool, refreshPoolInfoSingle, -1)
  }

  setDateInRangeVisualIndication(newPool, isDateInRange)
}

async function refreshPoolInfoMultiple(poolParams: PoolParamsP3, newPool: HTMLElement){
  await poolParams.refreshAllExtraData()

  updateDetail(newPool, poolParams.stakeTokenContractList, poolParams.contractParams.total_staked, "total-staked")
  updateDetail(newPool, poolParams.farmTokenContractList, poolParams.contractParams.total_farmed, "total-farmed")
  updateDetail(newPool, poolParams.farmTokenContractList, convertRewardsRates(poolParams.contractParams.farm_token_rates), "rewards-per-day")
  updateDetail(newPool, poolParams.farmTokenContractList, poolParams.resultParams.farmed, "unclaimed-rewards")

  const stakeBalances = poolParams.stakeTokenContractList.map(stakeCD => stakeCD.balance)
  refreshInputAmounts(poolParams, newPool, "main-stake", stakeBalances)
  refreshInputAmounts(poolParams, newPool, "main-unstake", poolParams.resultParams.staked)

  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  if(dateInRangeHack || !isDateInRange) {
    resetMultiplePoolListener(poolParams, newPool, refreshPoolInfoMultiple, -1)
  }

  setDateInRangeVisualIndication(newPool, isDateInRange)
}

function refreshInputAmounts(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement, className: string, amounts: U128String[]) {
  const inputArray = newPool.querySelectorAll(`.${className} .token-input-container`)
  for(let i = 0; i < inputArray.length; i++) {
    const input = inputArray[i]
    const tokenContractData: ContractData = poolParams.stakeTokenContractList[i]
    const balance = amounts[i]
    const balanceDisplayable = convertToDecimals(balance, tokenContractData.metaData.decimals, 7)
    input.querySelector(".value")!.innerHTML = balanceDisplayable

    const maxButton = input.querySelector(".max-button") as HTMLElement
    showOrHideMaxButton(Number(balanceDisplayable), maxButton)
  }
}

function convertRewardsRates(rates: string[]) {
  return rates.map(rate => (BigInt(rate) * 60n * 24n).toString())
}

async function updateDetail(newPool: HTMLElement, contractList: ContractData[], totals: string[], baseClass: string) {
  const totalFarmedInUsd: string = await convertToUSDMultiple(contractList, totals)
  newPool.querySelector(`.${baseClass}-row .${baseClass}-value-usd`)!.innerHTML = totalFarmedInUsd
  const totalFarmedDetailsElements: NodeListOf<HTMLElement> = newPool.querySelectorAll(`.${baseClass}-info-container .detail-row`)
  for(let i = 0; i < totalFarmedDetailsElements.length; i++) {
    const row = totalFarmedDetailsElements[i]
    const tokenMetadata = contractList[i].metaData
    const content = convertToDecimals(totals[i], tokenMetadata.decimals, 7)
    row.querySelector(".content")!.innerHTML = content
  }
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

  const stakeTokenContractData: ContractData = await poolParams.getStakeTokenContractData();
  const farmTokenContractData: ContractData = await poolParams.getFarmTokenContractData();

  addInput(newPool, stakeTokenContractData, "stake")
  addInput(newPool, stakeTokenContractData, "unstake", poolParams.resultParams.staked.toString())

  addHeader(poolParams, newPool)
  
  let unclaimedRewards = await getUnclaimedRewardsInUSDSingle(poolParams)

  newPool.querySelector(".unclaimed-rewards-value-usd")!.innerHTML = unclaimedRewards.toFixed(7).toString()

  const totalStakedInUsd = await convertToUSDMultiple([stakeTokenContractData], [poolParams.contractParams.total_staked])
  const totalFarmedInUsd = await convertToUSDMultiple([farmTokenContractData], [poolParams.contractParams.total_farmed])
  const rewardsPerDayInUsd = await convertToUSDMultiple([farmTokenContractData], [(BigInt(poolParams.contractParams.farming_rate) * 60n * 24n).toString()])
  newPool.querySelector(".total-staked-value-usd")!.innerHTML = totalStakedInUsd
  newPool.querySelector(".total-farmed-value-usd")!.innerHTML = totalFarmedInUsd
  newPool.querySelector(".rewards-per-day-value-usd")!.innerHTML = rewardsPerDayInUsd

  addSinglePoolListeners(poolParams, newPool)
}

function addAllLogos(poolParams: PoolParams|PoolParamsP3, header: HTMLElement) {
  const tokenContractDataArray: ContractData[] = poolParams.stakeTokenContractList
  const logoContainer = header.querySelector(".token-logo-container")! as HTMLElement
  logoContainer.innerHTML = ""

  for(let i = 0; i < tokenContractDataArray.length; i++) {
    const tokenIconData = tokenContractDataArray[i]
    const metaData = tokenIconData.metaData
    addLogo(metaData, logoContainer, i)
  }
}

function addHeader(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  const genericHeader = qs(".generic-new-pool-header")
  const newHeader = genericHeader.cloneNode(true) as HTMLElement

  addAllLogos(poolParams, newHeader)

  const poolContainer = newPool.querySelector("#pool-container") as HTMLElement
  const tokenPoolStatsContainer = newPool.querySelector("#token-pool-stats") as HTMLElement

  
  poolContainer.prepend(newHeader)
  
  toggleGenericClass(newHeader)
  const newTokenPoolStats = newHeader.cloneNode(true) as HTMLElement
  tokenPoolStatsContainer.prepend(newTokenPoolStats)
}

function addMultiplePoolListeners(poolParams: PoolParamsP3, newPool: HTMLElement) {
  addAllCommonListeners(poolParams, newPool)
  let tokenSymbols = []
  for(let i=0; i < poolParams.stakeTokenContractList.length; i++){ // Harvest button listener
    const contractData = poolParams.stakeTokenContractList[i]
    const metaData = contractData.metaData
    newPool.querySelector("#harvest-button")?.addEventListener("click", harvestMultiple(poolParams, newPool))
    tokenSymbols.push(`${metaData.symbol.toLowerCase()}`)
  }

  for (let i=0; i < tokenSymbols.length; i++){ // Autofill inputs with correct rates
    newPool.querySelector(`.main-stake .${tokenSymbols[i]}-input input`)!.addEventListener("input", autoFillStakeAmount(poolParams, newPool, `.main-stake`, i))
    newPool.querySelector(`.main-unstake .${tokenSymbols[i]}-input input`)!.addEventListener("input", autoFillStakeAmount(poolParams, newPool, `.main-unstake`, i))
  }

  // Stake/unstake buttons
  newPool.querySelector("#stake-button")?.addEventListener("click", stakeMultiple(poolParams, newPool))
  newPool.querySelector("#unstake-button")?.addEventListener("click", unstakeMultiple(poolParams, newPool))
  
  setAllInputMaxButtonListeners(newPool)
  // Refresh every 5 seconds if it's live
  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  let refreshIntervalId = -1
  if(isDateInRange) {
    refreshIntervalId = window.setInterval(refreshPoolInfoMultiple.bind(null, poolParams, newPool), 5000)
  }
  newPool.querySelector("#deleteme")?.addEventListener("click", function() {
    dateInRangeHack = true
  })

  //Info to transfer so we can check what pool is loading the NFTs
  let boostButton = newPool.querySelector(".boost-button")! as HTMLElement;
  boostButton.addEventListener("click", showNFTGrid(poolParams))

  // Hover events
  standardHoverToDisplayExtraInfo(newPool, "total-staked")
  standardHoverToDisplayExtraInfo(newPool, "total-farmed")
  standardHoverToDisplayExtraInfo(newPool, "rewards-per-day")
  standardHoverToDisplayExtraInfo(newPool, "reward-tokens")
  standardHoverToDisplayExtraInfo(newPool, "unclaimed-rewards")
}

async function addPoolMultiple(poolParams: PoolParamsP3, newPool: HTMLElement): Promise<void> {
  addHeader(poolParams, newPool)
  let tokenSymbols = []
  await poolParams.getWalletAvailable()
  for(let i=0; i < poolParams.stakeTokenContractList.length; i++){
    const contractData = poolParams.stakeTokenContractList[i]
    const metaData = contractData.metaData

    addInput(newPool, contractData, "stake")
    addInput(newPool, contractData, "unstake", poolParams.resultParams.staked[i])
    
    tokenSymbols.push(`${metaData.symbol.toLowerCase()}`)
  }

  //Show boost button patch (since simple pools will disapear and they have problems with the boost button)
  newPool.querySelector(".boost-button")!.classList.remove("hidden")
  newPool.querySelector(".structural-in-simple-pools")!.classList.add("hidden")

  const unclaimedRewards = await convertToUSDMultiple(poolParams.farmTokenContractList, poolParams.resultParams.farmed)

  newPool.querySelector(".unclaimed-rewards-value-usd")!.innerHTML = unclaimedRewards
  
  const totalStakedInUsd: string = await convertToUSDMultiple(poolParams.stakeTokenContractList, poolParams.contractParams.total_staked)
  const totalFarmedInUsd: string = await convertToUSDMultiple(poolParams.farmTokenContractList, poolParams.contractParams.total_farmed)
  const rewardsPerDay = poolParams.contractParams.farm_token_rates.map(rate => (BigInt(rate) * 60n * 24n).toString())
  const rewardsPerDayInUsd = await convertToUSDMultiple(poolParams.farmTokenContractList, rewardsPerDay)
  newPool.querySelector(".total-staked-row .total-staked-value-usd")!.innerHTML = totalStakedInUsd
  newPool.querySelector(".total-farmed-row .total-farmed-value-usd")!.innerHTML = totalFarmedInUsd
  newPool.querySelector(".rewards-per-day-value-usd")!.innerHTML = rewardsPerDayInUsd

  addMultiplePoolListeners(poolParams, newPool)
}

function addFocusClass(input:HTMLElement) {
  return function (event:Event) {
    event?.preventDefault
    input.classList.toggle("focused")
  }
}

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
  } else if(action == "unstake") {
    amountAvailableValue!.innerHTML= convertToDecimals(stakedAmount!, contractData.metaData.decimals, 7)
  }
  const balanceDisplayable = convertToDecimals(contractData.balance, contractData.metaData.decimals, 7)
  showOrHideMaxButton(Number(balanceDisplayable), maxButton)


  newPool.querySelector(`.main-${action}`)!.append(newInputContainer)
}

async function toggleExpandStakeUnstakeSection (newPool: HTMLElement, elemWithListener: HTMLElement){
  let expandPoolButton = newPool.querySelector(".expand-button")! as HTMLElement;
  // let hidePoolButton = newPool.querySelector(".hide-button")! as HTMLElement;
  let stakingUnstakingContainer = newPool.querySelector("#activated")! as HTMLElement;
  elemWithListener.addEventListener("click", flipElement(expandPoolButton));
  elemWithListener.addEventListener("click", toggleActions(stakingUnstakingContainer));
}

function standardHoverToDisplayExtraInfo (newPool: HTMLElement, className: string) {
  const elementWithListenner = newPool.querySelector(`.${className}-value-usd`) as HTMLElement
  const elementShown = newPool.querySelector(`.${className}-info-container`) as HTMLElement
  elementWithListenner.addEventListener("mouseover", toggleElement(elementShown));
  elementWithListenner.addEventListener("mouseout", toggleElement(elementShown));
  elementShown.addEventListener("mouseover", showElement(elementShown));
  elementShown.addEventListener("mouseout", hideElement(elementShown));
}

function hideAllDynamicElements(newPool: HTMLElement) {
  newPool.querySelectorAll(".dynamic-display-element").forEach((elem) => {
    elem.classList.add("hidden")
  })
}

function addAllCommonListeners(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  let infoIcon = newPool.querySelector(".new-pool-header .information-icon-container")! as HTMLElement;
  let poolStats = newPool.querySelector("#token-pool-stats")! as HTMLElement;
  
  infoIcon.addEventListener("mouseover", showElement(poolStats));
  poolStats.addEventListener("mouseover", showElement(poolStats));
  poolStats.addEventListener("mouseout", hideElement(poolStats));

  const isUserFarming = newPool.classList.contains("your-farms")
  if(isUserFarming) { // Displays staking/unstaking when hovering on the pool
    let vanishingIndicator = newPool.querySelector("#vanishing-indicator") as HTMLElement
    vanishingIndicator?.classList.remove("transparent")
    vanishingIndicator?.classList.add("visual-tool-expanding-indication-hidden")
    newPool.addEventListener("mouseover", paintOrUnPaintElement("visual-tool-expanding-indication-hidden", vanishingIndicator));
    newPool.addEventListener("mouseout", paintOrUnPaintElement("visual-tool-expanding-indication-hidden",vanishingIndicator));
  }
}

function addSinglePoolListeners(poolParams: PoolParams, newPool: HTMLElement) {
  addAllCommonListeners(poolParams, newPool)
  // Harvest button listener
  const contractData = poolParams.stakeTokenContractList[0]
  const metaData = contractData.metaData
  newPool.querySelector("#harvest-button")?.addEventListener("click", harvestSingle(poolParams, newPool))
  // Token symbols is done this way to emulate multiple case. Single case will be removed shortly
  let tokenSymbols = []
  tokenSymbols.push(`${metaData.symbol.toLowerCase()}`)

  // Stake/unstake buttons
  newPool.querySelector("#stake-button")?.addEventListener("click", stakeSingle(poolParams, newPool))
  newPool.querySelector("#unstake-button")?.addEventListener("click", unstakeSingle(poolParams, newPool))
  
  setAllInputMaxButtonListeners(newPool)
  // Refresh every 5 seconds if it's live
  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  let refreshIntervalId = -1
  if(isDateInRange) {
    refreshIntervalId = window.setInterval(refreshPoolInfoSingle.bind(null, poolParams, newPool), 5000)
  }
  newPool.querySelector("#deleteme")?.addEventListener("click", function() {
    dateInRangeHack = true
  })

  // Hover events
  standardHoverToDisplayExtraInfo(newPool, "total-staked")
  standardHoverToDisplayExtraInfo(newPool, "total-farmed")
  standardHoverToDisplayExtraInfo(newPool, "rewards-per-day")
  standardHoverToDisplayExtraInfo(newPool, "reward-tokens")
  standardHoverToDisplayExtraInfo(newPool, "unclaimed-rewards")
}

function resetSinglePoolListener(poolParams: PoolParams, pool: HTMLElement, refreshFunction: (pp: PoolParams, np: HTMLElement) => void, refreshIntervalId: number) {
  let newPool = pool.cloneNode(true) as HTMLElement
  hideAllDynamicElements(newPool)
  addFilterClasses(poolParams, newPool)
  
  addSinglePoolListeners(poolParams, newPool)
  if(newPool.classList.contains("inactive-pool")) {
    displayInactivePool(newPool)
  } else {
    displayActivePool(poolParams, newPool)
  }
  if(refreshIntervalId != -1) {
    clearInterval(refreshIntervalId)
    const now = Date.now() / 1000
    const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
    refreshIntervalId = -1
    if(isDateInRange) {
      refreshIntervalId = window.setInterval(refreshFunction.bind(null, poolParams, newPool), 5000)
    }
    pool.querySelector("#deleteme")?.addEventListener("click", function() {
      dateInRangeHack = true
    })
  }

  pool.replaceWith(newPool)

  const event = new Event('click')
  qs(".activeFilterButton").dispatchEvent(event)
}

function resetMultiplePoolListener(poolParams: PoolParamsP3, pool: HTMLElement, refreshFunction: (pp: PoolParamsP3, np: HTMLElement) => void, refreshIntervalId: number) {
  let newPool = pool.cloneNode(true) as HTMLElement
  hideAllDynamicElements(newPool)
  addFilterClasses(poolParams, newPool)
  addMultiplePoolListeners(poolParams, newPool)
  
  if(newPool.classList.contains("inactive-pool")) {
    displayInactivePool(newPool)
  } else {
    displayActivePool(poolParams, newPool)
  }
  if(refreshIntervalId != -1) {
    clearInterval(refreshIntervalId)
    const now = Date.now() / 1000
    const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
    refreshIntervalId = -1
    if(!dateInRangeHack && isDateInRange) {
      refreshIntervalId = window.setInterval(refreshFunction.bind(null, poolParams, newPool), 5000)
    }
    pool.querySelector("#deleteme")?.addEventListener("click", function() {
      dateInRangeHack = true
    })
  }

  pool.replaceWith(newPool)

  const event = new Event('click')
  qs(".activeFilterButton").dispatchEvent(event)
}

function addFilterClasses(poolParams: PoolParams | PoolParamsP3, newPool: HTMLElement) {
  // Cleaning classes in case of reset
  const classes = ["your-farms", "active-pool", "inactive-pool"]
  classes.forEach(className => newPool.classList.remove(className))
  
  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  
  if(poolParams.resultParams.hasStakedTokens()){
    newPool.classList.add("your-farms")
  }
  if(!dateInRangeHack && isDateInRange) {
    newPool.classList.add("active-pool")
  } else {
    newPool.classList.add("inactive-pool")
  }
}

async function addPool(poolParams: PoolParams | PoolParamsP3): Promise<void> {
  var genericPoolElement = qs("#generic-pool-container") as HTMLElement;
  var metaData = poolParams.stakingContractMetaData;
  let singlePoolParams: PoolParams
  let multiplePoolParams: PoolParamsP3

  var newPool = genericPoolElement.cloneNode(true) as HTMLElement;

  
  
  newPool.setAttribute("id", poolParams.html.id)
  newPool.classList.remove("hidden")
  newPool.classList.add("pool-container")
  
  
  let iconElem = newPool.querySelectorAll("#token-logo-container img")
  
  iconElem.forEach(icon => {
    icon!.setAttribute("src", metaData.icon || "");
  });

  addFilterClasses(poolParams, newPool)
  if (poolParams instanceof PoolParams) {
    singlePoolParams = poolParams
    await addPoolSingle(singlePoolParams, newPool)
  } else {
    multiplePoolParams = poolParams
    await addPoolMultiple(multiplePoolParams, newPool)
  }
  
  
  // New code
  let showContractStart = newPool.querySelector("#contract-start")
  let showContractEnd = newPool.querySelector("#contract-end")
  var contractParams = poolParams.contractParams;
  
  showContractStart!.innerHTML = new Date(contractParams.farming_start * 1000).toLocaleString()
  showContractEnd!.innerHTML = new Date(contractParams.farming_end * 1000).toLocaleString()


  newPool.querySelectorAll(".token-name").forEach(element => {
    element.innerHTML = poolParams.getPoolName()
  })

  if(newPool.classList.contains("inactive-pool")) {
    displayInactivePool(newPool)
  } else {
    await displayActivePool(poolParams, newPool)
  }
  await addRewardTokenIcons(poolParams, newPool)
  
  await addTotalStakedDetail(poolParams, newPool)
  await addTotalFarmedDetail(poolParams, newPool)
  await addRewardsPerDayDetail(poolParams, newPool)
  await addRewardsTokenDetail(poolParams, newPool)
  await addUnclaimedRewardsDetail(poolParams, newPool)
  
  let unixTimestamp = new Date().getTime() / 1000;
  const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
  setDateInRangeVisualIndication(newPool, isDateInRange)
  
  qs("#pool_list").append(newPool)

  newPool.querySelector(".deposit-fee-value")!.innerHTML = (contractParams.fee_rate) ? contractParams.fee_rate / 100 + "%" : "0%"
}

function displayInactivePool(newPool: HTMLElement) {
  const isUserFarming = newPool.classList.contains("your-farms")
  if(isUserFarming) {
    toggleStakeUnstakeSection(newPool)
    setUnstakeTabListeners(newPool)

    newPool.querySelector("#staking-unstaking-container .staking")!.setAttribute("disabled", "disabled")
    const event= new Event ("click")
    newPool.querySelector("#staking-unstaking-container .unstaking")!.dispatchEvent(event)
  }
}

function toggleStakeUnstakeSection(newPool: HTMLElement) {
  let expandPoolButton = newPool.querySelector(".expand-button")! as HTMLElement;
  let poolContainer = newPool.querySelector("#pool-container")! as HTMLElement
  expandPoolButton.classList.remove("hidden")
  toggleExpandStakeUnstakeSection(newPool, poolContainer)
  toggleExpandStakeUnstakeSection(newPool, expandPoolButton)
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

async function displayActivePool(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  let activateButtonContainer = newPool.querySelector("#activate") as HTMLElement
  let activateButton = newPool.querySelector(".activate") as HTMLElement
  let harvestSection = newPool.querySelector(".harvest-section") as HTMLElement
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

  const isUserFarming = newPool.classList.contains("your-farms")
  if(isUserFarming) {
    activateButtonContainer.classList.add("hidden")
    activateButton.setAttribute("disabled", "disabled")
    harvestSection.classList.remove("hidden")
  }
}

function addLogo(metaData: FungibleTokenMetadata, container: HTMLElement, index: number = 0) {
  let newTokenLogoElement: HTMLElement
  if (metaData.icon != null){
    // inputLogoContainer.innerHTML= `${metaData.icon}`
    if(metaData.icon.startsWith("data:image/svg+xml")) { // icon is img
      const tokenLogoElement = qs(".generic-token-logo-img")
      newTokenLogoElement = tokenLogoElement.cloneNode(true) as HTMLElement
      newTokenLogoElement?.setAttribute("src", metaData.icon)
    } else if(metaData.icon.startsWith("<svg")) { // icon is svg tag
      const tokenLogoElement = qs(".generic-token-logo-svg-container")
      newTokenLogoElement = tokenLogoElement.cloneNode(true) as HTMLElement
      newTokenLogoElement!.innerHTML = metaData.icon
    } else { // Should never happen
      const tokenLogoElement = qs(".generic-token-logo-text")
      newTokenLogoElement = tokenLogoElement.cloneNode(true) as HTMLElement
      newTokenLogoElement!.innerHTML= `${metaData.name}`
    }
  } else { // Logo is not loaded (for afi-tt)
    const tokenLogoElement = qs(".generic-token-logo-text")
    newTokenLogoElement = tokenLogoElement.cloneNode(true) as HTMLElement
    newTokenLogoElement!.innerHTML= `${metaData.name}`
  }
  toggleGenericClass(newTokenLogoElement)
  newTokenLogoElement.classList.add(`logo-${index+1}`)
  container.append(newTokenLogoElement)
}

async function addRewardTokenIcons(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  const tokenIconDataArray: TokenIconData[] = await poolParams.getRewardTokenIconData()
  const container = newPool.querySelector(".reward-tokens-value-usd") as HTMLElement
  
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
}

async function addRewardsPerDayDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  convertAndAddRewardDataRows(poolParams, newPool, "rewards-per-day-info-container", "rewardsPerDay")
}

async function addTotalFarmedDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  convertAndAddRewardDataRows(poolParams, newPool, "total-farmed-info-container", "totalRewards")
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
  const rows = rowsData.rows

  for(let i = 0; i < rows.length; i++) {
    const newRow = genericRow.cloneNode(true) as HTMLElement
    let row = rows[i]
    newRow.querySelector(".content")!.innerHTML = row.content

    const iconContainer = newRow.querySelector(".icon") as HTMLElement
    
    var newMiniIcon = importMiniIcon(row.iconData) as HTMLElement
    
    iconContainer.append(newMiniIcon)
    toggleGenericClass(newRow)
    newRow.classList.add(row.iconData.tokenName.toLowerCase().replace(/ /g, "-"))
    parentElement.append(newRow)

  }
}

async function addUnclaimedRewardsDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
  convertAndAddRewardDataRows(poolParams, newPool, "unclaimed-rewards-info-container", "userUnclaimedRewards")
}

function importMiniIcon(iconData: TokenIconData){
  const iconNode: HTMLElement = qs(".generic-mini-icon")
  var parser = new DOMParser();
  var newMiniIcon: HTMLElement
    if(iconData.isSvg) {
      var doc = parser.parseFromString(iconData.src, "image/svg+xml");
      newMiniIcon = doc.documentElement
      newMiniIcon.classList.add("generic-mini-icon")
    } else {
      newMiniIcon = iconNode.cloneNode(true) as HTMLElement
      newMiniIcon.setAttribute("src", iconData.src)
      newMiniIcon.setAttribute("alt", iconData.tokenName)
    }
    // toggleGenericClass(newMiniIcon, "mini-icon")
    toggleGenericClass(newMiniIcon)
    return newMiniIcon
}

// function toggleGenericClass(element: HTMLElement, className: string) {
//   element.classList.remove(`generic-${className}`)
//   element.classList.add(`${className}`)
//   element.classList.remove("hidden")
// }

function toggleGenericClass(element: HTMLElement) {
  for(let i = 0; i < element.classList.length; i++) {
    let className = element.classList[i]
    if(className.includes("generic-")) {
      const newClass = className.substring("generic-".length)
      element.classList.remove(`${className}`)
      element.classList.add(`${newClass}`)
    }
  }
  
  element.classList.remove("hidden")
}

function setAllInputMaxButtonListeners(newPool: HTMLElement) {
  const inputContainerArray = newPool.querySelectorAll(".token-input-container")
  for(let i = 0; i < inputContainerArray.length; i++) {
    let inputContainer = inputContainerArray[i] as HTMLElement
    const maxButton = inputContainer.querySelector(".max-button")
    maxButton?.addEventListener("click", inputMaxButtonClicked(inputContainer))
  }
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
      } else if(method == "nft_transfer_call"){
        showSuccess("NFT staked successfully", "Stake NFT")
        // @ts-ignore
        // await nftStakeResult(args)
      }
    }
    else {
      //not signed-in 
      await signedOutFlow() //show home-not-connected -> select wallet page
    }
  }
  catch (ex) {
    showErr(ex as Error)
  }
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
    console.log("UNSTAKE RESULT TOKEN: ", args.token)
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

function flipElement(elementToFlip: HTMLElement) {
  return function (event: Event){
    event.preventDefault();
    let element = event.target as HTMLElement
    const tagName = element.tagName.toLowerCase()
    const tagsToIgnore = ["button", "input", "span", "img"]

    if (!tagsToIgnore.includes(tagName) || element.classList.contains("toggle-display")) {
      elementToFlip.classList.toggle("flipped")
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

function showNFTGrid(poolParams: PoolParamsP3) {
  return function () {
    loadNFTs(poolParams) //DUDA esto debería ser async, ¿no?
    qs("#nft-pools-section").classList.remove("hidden")
  }
}

async function loadNFTs(poolParams: PoolParamsP3) {
  const NFTContainer = qs(".nft-grid") as HTMLElement
  NFTContainer.innerHTML = ""
  
  const accountId = poolParams.wallet.getAccountId()
  const nftContract = poolParams.nftContract
  let nftCollection = await nftContract.nft_tokens_for_owner(accountId)

  let userStatus: Status = await poolParams.stakingContract.status(accountId)
  if(userStatus.cheddy_nft != '') {
    const stakedNft = newNFT(userStatus.cheddy_nft)
    addNFT(poolParams, NFTContainer, stakedNft, true)
  }

  nftCollection.forEach(nft => {
    addNFT(poolParams, NFTContainer, nft)
  });
}

function addNFT(poolParams: PoolParamsP3, container: HTMLElement, nft: NFT, staked: boolean = false) {
  const genericNFTCard = qs(".generic-nft-card")
  const newNFTCard = genericNFTCard.cloneNode(true) as HTMLElement    
    
    //TODO Dani. Here is where you should load the NFTs cards info (I think)
    newNFTCard.querySelectorAll(".nft-name").forEach(elem => {
      elem.innerHTML = nft.token_id
    })

    let imgElement = newNFTCard.querySelector(".nft-img-container img")
    imgElement?.setAttribute("src", nftBaseUrl + nft.metadata.media)
    imgElement!.setAttribute("alt", nft.metadata.media)

    if(staked) {
      let unstakeButton = newNFTCard.querySelector(".unstake-nft-button")
      unstakeButton!.removeAttribute("disabled")
      unstakeButton?.addEventListener("click", unstakeNFT(poolParams, newNFTCard))
    } else {
      let stakeButton = newNFTCard.querySelector(".stake-nft-button")
      stakeButton!.removeAttribute("disabled")
      stakeButton?.addEventListener("click", stakeNFT(poolParams, newNFTCard))
    }

    container.append(newNFTCard)    
    toggleGenericClass(newNFTCard)
}

// event?.preventDefault()
//     showWait("Staking...")
    
//     // let stakeContainerList = newPool.querySelectorAll(".main-stake .input-container")  
//     let inputArray: HTMLInputElement[] = []

//     try {
//       let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
//       const contractParams = poolParams.contractParams
//       const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
//       if (!isDateInRange) throw Error("Pools is Closed.")
      
//       const { htmlInputArray, amountValuesArray: amountValues, transferedAmountWithSymbolArray: stakedAmountWithSymbol } = await getInputDataMultiple(poolParams, newPool, "stake")
//       inputArray = htmlInputArray
      
//       qsaAttribute("input", "disabled", "disabled")

//       //get amount
//       const min_deposit_amount = 1;
            
//       await poolParams.stake(amountValues)
//       if (loggedWithNarwallets) {
//         //clear form
//         for(let i = 0; i < inputArray.length; i++) {
//           inputArray[i].value = ""  
//         }
        
//         poolParams.resultParams.addStaked(amountValues)

//         showSuccess(`Staked ${stakedAmountWithSymbol.join(" - ")}`)
//       }

//     }
//     catch (ex) {
//       showErr(ex as Error)
//     }
//     // re-enable the form, whether the call succeeded or failed
//     inputArray.forEach(input => {
//       input.removeAttribute("disabled")
//     });
//   }

function stakeNFT(poolParams: PoolParamsP3, card: HTMLElement){
  return async function(event: Event) {
    try {
      event.preventDefault()
      showWait("Staking NFT...")

      const tokenId = card.querySelector(".nft-name")!.innerHTML
      const response = await poolParams.nftContract.nft_transfer_call(poolParams.stakingContract.contractId, tokenId)
      showSuccess("NFT staked successfully")
      card.querySelector(".stake-nft-button")!.setAttribute("disabled", "disabled")

      let unstakeButton = card.querySelector(".unstake-nft-button")!
      unstakeButton.removeAttribute("disabled")
      unstakeButton.addEventListener("click", unstakeNFT(poolParams, card))
    } catch(err) {
      showErr(err as Error)
    }
  }
}

function unstakeNFT(poolParams: PoolParamsP3, card: HTMLElement) {
  return async function (event: Event) {
    try {
      event.preventDefault()
      showWait("Unstaking NFT...")

      const response = await poolParams.stakingContract.withdraw_nft(poolParams.wallet.getAccountId())
      showSuccess("NFT unstaked successfully")
      card.querySelector(".unstake-nft-button")!.setAttribute("disabled", "disabled")

      let stakeButton = card.querySelector(".stake-nft-button")!
      stakeButton.removeAttribute("disabled")
      stakeButton.addEventListener("click", stakeNFT(poolParams, card))
    } catch(err) {
      showErr(err as Error)
    }
    

  }
}

function quitNFTGrid() {  
  return function (event: Event){
    event.preventDefault();
    let element = event.target as HTMLElement

    //DUDA está bien este filtro? (Igual ahora lo voy a probar pero dejo anotado por las dudas). La idea es que se dispare si clickeo fuera de las cards.
    console.log("Id", element.getAttribute("id"))
    console.log("Classes", element.classList.toString())
    if (element.getAttribute("id") == "nft-pools-section" || element.classList.contains("nft-grid")) {
      qs(".nft-grid").innerHTML = ""
      qs("#nft-pools-section").classList.add("hidden")
    }
  }
}

qs("#nft-pools-section").addEventListener("click", quitNFTGrid())