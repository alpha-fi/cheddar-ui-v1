import { connect, keyStores, WalletConnection, ConnectedWalletAccount } from 'near-api-js'

import { ENV, CHEDDAR_CONTRACT_NAME, TESTNET_CHEDDAR_CONTRACT_NAME, getConfig } from './config'

import { WalletInterface } from './wallet-api/wallet-interface';
import { disconnectedWallet } from './wallet-api/disconnected-wallet';
import { NearWebWallet } from './wallet-api/near-web-wallet/near-web-wallet';
import { narwallets, addNarwalletsListeners } from './wallet-api/narwallets/narwallets';
import { yton, toStringDec, toStringDecMin, convertToDecimals, convertToBase } from './util/conversions';

//qs/qsa are shortcut for document.querySelector/All
import { qs, qsa, qsi, showWait, showErr, showSuccess, showMessage, show, hide, hideOverlay, showError, showPopup, qsInnerText, qsaAttribute } from './util/document';
import { checkRedirectSearchParamsMultiple } from './wallet-api/near-web-wallet/checkRedirectSearchParams';
import { FungibleTokenMetadata, NEP141Trait } from './contracts/NEP141';
import { PoolParams, UserStatusP2 } from './entities/poolParams';
import { getPoolList } from './entities/poolList';
import { PoolParamsP3 } from './entities/poolParamsP3';
import { U128String } from './wallet-api/util';
import {DetailRowElements, HTMLTokenInputData, TokenIconData, UnclaimedRewardsData, RewardsTokenData} from './entities/genericData';

import * as nearAPI from "near-api-js"
import { getTokenData, getTokenDataArray } from './util/oracle';
import { RefTokenData } from './entities/refResponse';
import { ContractParams, TransactionData } from './contracts/contract-structs';
import { P3ContractParams, PoolUserStatusP3, PoolUserStatusP3NFT } from './contracts/p3-structures';
import { NFTContract } from './contracts/NFTContract';
import { newNFT, NFT, NFTMetadata, NFTWithMetadata } from './contracts/nft-structs';
import { BN } from 'bn.js';
import { StakingPoolP3 } from './contracts/p3-staking';
import { StakingPoolP1 } from './contracts/p2-staking';
import { callMulipleTransactions } from './contracts/multipleCall';
import { TokenContractData } from './entities/PoolEntities';
import { PoolParamsNFT } from './entities/poolParamsNFT';
import { NFTContractData, StakingContractDataNFT } from './entities/PoolEntitiesNFT';
import { NFTStakingContractParams } from './contracts/nft-structures';
import { StakingPoolNFT } from './contracts/nft-staking';
import { initButton as initLiquidButton } from './util/animations/liquidityButton';
import { ConfettiButton } from './util/animations/new-confetti-button';

//get global config
//const nearConfig = getConfig(process.env.NODE_ENV || 'testnet')
export let nearConfig = getConfig(ENV); //default testnet, can change according to URL on window.onload
export let near: nearAPI.Near
// global variables used throughout
export let wallet: WalletInterface = disconnectedWallet;

let nearWebWalletConnection: WalletConnection;
let nearConnectedWalletAccount: ConnectedWalletAccount;
let accountName;
let isPaused = false;
let loggedWithNarwallets = false

//time in ms
const SECONDS = 1000
const MINUTES = 60 * SECONDS
const HOURS = 60 * MINUTES

let countDownIntervalId: number
const refreshTime = 60 * SECONDS

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

qs('#my-account').onclick =
  async function (event) {
    event.preventDefault()
    if (wallet.isConnected()) {
      console.log("Connected")
      signedInFlow(wallet)
    } else {
      console.log("Disconnected")
      loginNearWebWallet();
    }
  }


let moreGamesButton = qs(".games-dropdown") as HTMLElement
moreGamesButton.addEventListener("click", gamesDropdownHandler())

let noLivePoolsMsg = qs(".no-live-pools-msg") as HTMLElement
noLivePoolsMsg.addEventListener("click", gamesDropdownHandler())

function gamesDropdownHandler() {
  return function(){
    let gamesDropdownContainer = qs(".games-dropdown-items") as HTMLElement
    gamesDropdownContainer.classList.toggle("down")

    let gamesLinksContainer = qs(".games-links-container") as HTMLElement
  
    gamesLinksContainer.classList.toggle("games-dropdown-hidden-position")
    moreGamesButton.querySelector("svg")!.classList.toggle("flipped")  
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
    loginNearWebWallet()
    // sayChoose()
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
    event.preventDefault();
    
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
    // let livePools = qsa("test-no-live-pools-msg")
    showSelectedPools(livePools, className)
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

function showSelectedPools(selectedPools: NodeListOf<Element>, className: string) {
  if(selectedPools.length > 0){
    qs(".no-live-pools-msg").classList.add("hidden")

    selectedPools.forEach(pool => {
      pool.classList.remove("hidden")
    });

  } else if (className == "active-pool") {
    qs(".no-live-pools-msg").classList.remove("hidden")
  }
}


//Events on filter buttons
qs("#live-filter").onclick=filterPools("active-pool")
qs("#ended-filter").onclick=filterPools("inactive-pool")
qs('#your-farms-filter').onclick= filterPools("your-farms")


function activateClicked(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, pool: HTMLElement) {
  return async function (event: Event) {
    event.preventDefault()
    let TXs: TransactionData[] = []

    const stakeTokenList = await poolParams.stakingContractData.getStakeTokenContractList()
    for(let i = 0; i < stakeTokenList.length; i++) {
      const tokenContract = stakeTokenList[i].contract!
      const doesNeedStorageDeposit = await needsStorageDeposit(tokenContract)
      if (doesNeedStorageDeposit) {
        TXs.push({
          promise: tokenContract.storageDepositWithoutSend(),
          contractName: tokenContract.contractId
        })
      }
    }

    const doesNeedStorageDeposit = await needsStorageDeposit(poolParams.stakingContractData.contract)
    if (doesNeedStorageDeposit) {
      TXs.push({
        promise: poolParams.stakingContractData.contract.storageDepositWithoutSend(),
        contractName: poolParams.stakingContractData.contract.contractId
      })
    }
    await callMulipleTransactions(TXs, poolParams.stakingContractData.contract)

    pool.querySelector("#deposit")!.classList.remove("hidden")
    pool.querySelector("#activated")!.classList.add("hidden")
  }
}

async function needsStorageDeposit(contract: NEP141Trait|StakingPoolP1|StakingPoolP3|StakingPoolNFT): Promise<boolean> {
  if(!wallet.isConnected()) return false
  const contractStorageBalanceData = await contract.storageBalance()
  if(contractStorageBalanceData == null) return true
  const contractStorageBalanceBN = new BN(contractStorageBalanceData.total)
  return !contractStorageBalanceBN.gten(0)
}

async function getUnclaimedRewardsInUSDSingle(poolParams: PoolParams): Promise<number> {
  const rewardToken = "cheddar"
  const rewardTokenData: RefTokenData = await getTokenData(rewardToken)
  const metaData = await poolParams.cheddarContract.ft_metadata()
  const userPoolParams = await poolParams.stakingContractData.getUserStatus()
  const currentRewards: bigint = userPoolParams.real
  const currentRewardsDisplayable = convertToDecimals(currentRewards, metaData.decimals, 5)
  return parseFloat(rewardTokenData.price) * parseFloat(currentRewardsDisplayable)
}

/**
 * 
 * @param tokenContractList 
 * @param amountList array containing the amounts to be converted with the metadata decimals included
 * @returns 
 */
async function convertToUSDMultiple(tokenContractList: TokenContractData[], amountList: U128String[]): Promise<string> {
  // const stakeTokenContractList = poolParams.stakeTokenContractList
  //TODO DANI make better. Avoid calling the promise
  await Promise.all(
    tokenContractList.map(
      (tokenContract: TokenContractData) => tokenContract.getMetadata()
    )
  )
  const rewardTokenArray = tokenContractList.map(tokenContract => tokenContract.getMetadataSync().symbol)
  const rewardTokenDataMap: Map<string, RefTokenData> = await getTokenDataArray(rewardTokenArray)
  let amountInUsd: number = 0
  tokenContractList.forEach((tokenContract: TokenContractData, index: number) => {
    const metaData = tokenContract.getMetadataSync()
    const symbol = metaData.symbol
    const amount = amountList[index]
    
    // console.log(unclaimedRewards)
    const currentRewardsDisplayable = convertToDecimals(amount, metaData.decimals, 5)
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
      const contractParams = await poolParams.stakingContractData.getContractParams()
      // const contractParams = poolParams.contractParams
      // const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
      const isDateInRange = unixTimestamp < contractParams.farming_end
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
        
        // const poolUserStatus = await poolParams.stakingContractData.getUserStatus()
        // poolUserStatus.addStaked(amountValues)
        poolParams.stakingContractData.refreshData()

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
      const contractParams = await poolParams.stakingContractData.getContractParams()
      // const contractParams = poolParams.contractParams
      // const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
      // const isDateInRange = unixTimestamp > contractParams.farming_start
      // if (!isDateInRange) throw Error("Pools is not open yet.")
      
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
        
        // poolParams.poolUserStatus.addStaked(amountValues.map(value => -value))
        poolParams.stakingContractData.refreshData()
  
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
  const stakeTokenContractList = await poolParams.stakingContractData.getStakeTokenContractList()
  let boundary: string[]
  if(action == "stake") {
    boundary = await poolParams.getWalletAvailable()
  } else if(action == "unstake") {
    const poolUserStatus = await poolParams.stakingContractData.getUserStatus()
    boundary = poolUserStatus.stake_tokens
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
    // const metaData = stakeTokenContractList[i].metaData
    const currentStakeTokenMetadata = await stakeTokenContractList[i].getMetadata()

    const stakeAmountBN: bigint = BigInt(convertToBase(amount.toString(), currentStakeTokenMetadata.decimals.toString()))
    console.log(i, boundary[i])
    if(BigInt(boundary[i]) < stakeAmountBN) {
      const balanceDisplayable = convertToDecimals(boundary[i], currentStakeTokenMetadata.decimals, 5)
      throw Error(`Only ${balanceDisplayable} ${currentStakeTokenMetadata.symbol} Available to ${action}.`)
    }
    
    amountValuesArray.push(stakeAmountBN)
    stakedAmountWithSymbolArray.push(`${amount} ${currentStakeTokenMetadata.symbol}`)
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
      // let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
      // const contractParams = await poolParams.stakingContractData.getContractParams()
      // const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
      // if (!isDateInRange) throw Error("Pools is Closed.")
      
      stakeInput.setAttribute("disabled", "disabled")
      let stakeAmount = parseFloat(stakeInput.value)
      //get amount
      const min_deposit_amount = 1;
      if (isNaN(stakeAmount)) {
        throw Error("Please Input a Number.")
      }

      const walletAvailable = await poolParams.getWalletAvailable()
      if (stakeAmount > parseFloat(walletAvailable)) throw Error(`Only ${walletAvailable} ${poolParams.stakeTokenMetaData.symbol} Available to Stake.`);
      const stakeTokenContract = (await poolParams.stakingContractData.getStakeTokenContractList())[0]
      const stakeTokenMetadata = await stakeTokenContract.getMetadata()
      await poolParams.stakeTokenContract.ft_transfer_call(
        poolParams.stakingContractData.contract.contractId, 
        convertToBase(
          stakeAmount.toString(), 
          stakeTokenMetadata.decimals.toString()
        ), 
        "to farm"
      )

      // if (loggedWithNarwallets) {
      //   //clear form
      //   stakeInput.value = ""
      //   poolParams.resultParams.addStaked(ntoy(stakeAmount))
      //   refreshPoolInfo(poolParams, newPool)//Question: shouldnt this be in refreshPoolInfo?
  
      //   showSuccess("Staked " + toStringDecMin(stakeAmount) + poolParams.stakeTokenMetaData.symbol)
      // }

    }
    catch (ex) {
      showErr(ex as Error)
    }

    // re-enable the form, whether the call succeeded or failed
    stakeInput.removeAttribute("disabled")
  }
}

// TODO DANI - implement
function harvestMultipleOrNFT(poolParams: PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
  return async function (event: Event) {
    event?.preventDefault()

    let poolID = poolParams.html.id
    poolParams.confettiButton?.clickButtonWithRedirection(poolID)

    showWait("Harvesting...")
    await poolParams.stakingContractData.contract.withdraw_crop()

    showSuccess("Harvested successfully")
  }
}

function harvestSingle(poolParams: PoolParams, newPool: HTMLElement){
  return async function (event: Event) {
    event?.preventDefault()    
    showWait("Harvesting...")
    let poolID = poolParams.html.id
    poolParams.confettiButton?.clickButtonWithRedirection(poolID)

    const poolUserStatus: UserStatusP2 = await poolParams.stakingContractData.getUserStatus()
    
    let amount = poolUserStatus.getCurrentCheddarRewards()

    await poolParams.stakingContractData.contract.withdraw_crop()

    poolUserStatus.computed = 0n
    poolUserStatus.real = 0n
    // newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = "0"

    showSuccess("Harvested" + toStringDecMin(parseFloat(amount)) + " CHEDDAR")
  }
}

function unstakeSingle(poolParams: PoolParams, newPool: HTMLElement){
  return async function (event: Event){
    event?.preventDefault()
    showWait("Unstaking...")

    const poolUserStatus = await poolParams.stakingContractData.getUserStatus()
    const stakeTokenContract = (await poolParams.stakingContractData.getStakeTokenContractList())[0]
    const stakeTokenMetadata = await stakeTokenContract.getMetadata()

    let unstakeInput = newPool.querySelector(".main-unstake input") as HTMLInputElement

    try {      
      unstakeInput.setAttribute("disabled", "disabled")
      let unstakeAmount = parseFloat(unstakeInput.value)
      const staked = poolUserStatus.staked
      const stakedDisplayable = Number(convertToDecimals(staked.toString(), stakeTokenMetadata.decimals, 5))
      if (isNaN(unstakeAmount)) {
        throw Error("Please Input a Number.")
      }
      
      
      if (unstakeAmount > stakedDisplayable) throw Error(`Only ${stakedDisplayable} ${stakeTokenMetadata.symbol} Available to Unstake.`);
      await poolParams.stakingContractData.contract.unstake(
        convertToBase(
          unstakeAmount.toString(), 
          stakeTokenMetadata.decimals.toString()
        )
      )
      
      // if (loggedWithNarwallets) {
      //   //clear form
      //   unstakeInput.value = ""
  
      //   //refresh acc info
      //   refreshPoolInfo(poolParams, newPool)

      //   poolUserStatus.addStaked(ntoy(unstakeAmount))
      //   // refreshPoolInfoSingle(poolParams, newPool) //Esta línea la agregué porque pensé que corresponde pero realmente estoy confundido.
      //   showSuccess("Unstaked " + toStringDecMin(unstakeAmount) + poolParams.stakeTokenMetaData.symbol)
      // }
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

  //hide burger button
  qs(".burger-button").classList.remove("burger-button--toggle")
  qs(".navbar-links").classList.remove("show-right__nav")
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
  // showSection("#home")
  // await refreshAccountInfo();
}

// Displaying the signed in flow container and fill in account-specific data
async function signedInFlow(wallet: WalletInterface) {
  showSection("#home-connected")
  selectNav("#home")
  takeUserAmountFromHome()
  // await refreshAccountInfoGeneric(poolList)
  if(wallet.isConnected()) {
    // const poolList = await getPoolList(wallet);    
    // qs(".user-info #account-id").innerText = poolList[0].wallet.getAccountId()
    let walletID = wallet.getDisplayableAccountId();
    let walletDisplayableID: string
    if(walletID.length < 15){
      walletDisplayableID = walletID
    } else {
      walletDisplayableID = walletID.slice(0, 12) + "..."
    }

    let accountIdElement = qs(".user-info #account-id") as HTMLSpanElement
    accountIdElement.innerText = walletDisplayableID

    accountIdElement.title = walletID

    // qs(".not-connected-msg").classList.add("hidden")

  } else {
    qs(".not-connected-msg").classList.remove("hidden")
    // initButton()
    // If user is disconnected it, account Id is the default disconnected message
    qs(".user-info #account-id").innerText = wallet.getAccountId()

  }
}

function setDefaultFilter (didJustActivate: boolean = false){
  let allYourFarmsPools = qsa(".your-farms")
  let allLivePools = qsa(".active-pool")

  const event= new Event ("click")

  //If you don´t have farms show live pools as default. If you just activate a pool show live pools as default.
  if(didJustActivate){
    qs("#live-filter")!.dispatchEvent(event)

  } else if (allYourFarmsPools.length > 0){    /*console.log("Your farms")*/
    qs("#your-farms-filter").dispatchEvent(event)

  } else if (allLivePools.length > 0){
    // console.log("Live")
    qs("#live-filter")!.dispatchEvent(event)

  } else {
    // console.log("Ended")
    qs("#ended-filter")!.dispatchEvent(event)
  }
}

// Initialize contract & set global variables
async function initNearWebWalletConnection() {

  // Initialize connection to the NEAR network
  const near = await connect(Object.assign({ deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } }, nearConfig))
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
  // localStorage.setItem("amount", qsi("#stake-form-not-connected input.near").value)
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

function setDateInRangeVisualIndication(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT,newPool: HTMLElement, isDateInRange: boolean) {
  let dateInRangeIndicator = newPool.querySelector(".date-in-range-indicator circle") as HTMLElement

  if(isDateInRange) {
    dateInRangeIndicator.classList.remove("offDate")
    dateInRangeIndicator.classList.add("onDate")
  } else {
    dateInRangeIndicator.classList.remove("onDate")
    dateInRangeIndicator.classList.add("offDate")
  }
  
  let allUnclaimedRewardsTotalAmount = 0
  let allUnclaimedRewardsDetails = newPool.querySelectorAll(".unclaimed-rewards-info-container .detail-row") as NodeListOf<Element>
  allUnclaimedRewardsDetails.forEach(unclaimedRewardDetail => {
    let amountContainer = unclaimedRewardDetail.querySelector(".content")! as HTMLElement
    let amount = Number(amountContainer.innerHTML)
    allUnclaimedRewardsTotalAmount += amount
  });

  
  let unclaimedRewards = newPool.querySelector(".unclaimed-rewards")
  let unclaimedRewardsValue = newPool.querySelector(".unclaimed-rewards-value-usd")
  if(allUnclaimedRewardsTotalAmount == 0){
    unclaimedRewards!.classList.remove("no-opacity")
    unclaimedRewardsValue!.classList.remove("no-opacity")
    allUnclaimedRewardsDetails.forEach(unclaimedRewardDetail => {
      unclaimedRewardDetail.classList.remove("no-opacity")
    });
  } else {
    unclaimedRewards!.classList.add("no-opacity")
    unclaimedRewardsValue!.classList.add("no-opacity")
    allUnclaimedRewardsDetails.forEach(unclaimedRewardDetail => {
      unclaimedRewardDetail.classList.add("no-opacity")
    });
  }
}

async function refreshPoolInfoSingle(poolParams: PoolParams, newPool: HTMLElement){
  await poolParams.refreshAllExtraData()

  const contractParams = await poolParams.stakingContractData.getContractParams()
  const userPoolParams = await poolParams.stakingContractData.getUserStatus()
  await updateDetail(newPool, poolParams.stakeTokenContractList, [contractParams.total_staked], "total-staked")
  // updateDetail(newPool, poolParams.farmTokenContractList, [poolParams.contractParams.total_farmed], "apr")
  await updateDetail(newPool, poolParams.farmTokenContractList, convertRewardsRates([contractParams.farming_rate.toString()]), "rewards-per-day")
  await uptadeDetailIfNecesary(poolParams, newPool, [await poolParams.getFarmTokenContractData()], [userPoolParams.real.toString()], "unclaimed-rewards")

  const stakeBalances = await Promise.all(poolParams.stakeTokenContractList.map(stakeCD => stakeCD.getBalance()))
  // const stakeBalances = poolParams.stakeTokenContractList.map(stakeCD => stakeCD.getBalanceSync())
  await refreshInputAmounts(poolParams, newPool, "main-stake", stakeBalances)
  await refreshInputAmounts(poolParams, newPool, "main-unstake", [userPoolParams.staked.toString()])

  if(userPoolParams.staked == 0n) {
    newPool.classList.remove("your-farms")
    let doesPoolNeedDeposit = await needsStorageDeposit(poolParams.stakeTokenContract)
    
    const stakeTokenList = poolParams.stakeTokenContractList
    for(let i = 0; i < stakeTokenList.length && !doesPoolNeedDeposit; i++) {
      const tokenContract = stakeTokenList[i].contract!
      const doesTokenNeedStorageDeposit = await needsStorageDeposit(tokenContract)
      if (doesTokenNeedStorageDeposit) {
        doesPoolNeedDeposit = true
      }
    }

    if(!doesPoolNeedDeposit && newPool.classList.contains("inactive-pool")) {
      newPool.querySelector("#activate")?.classList.add("hidden")
    } else {
      newPool.querySelector("#activate")?.classList.remove("hidden")
    }
  }

  const now = Date.now() / 1000
  const isDateInRange = contractParams.farming_start < now && now < contractParams.farming_end
  if(!isDateInRange) {    
    resetSinglePoolListener(poolParams, newPool, refreshPoolInfoSingle, -1)
  }

  setDateInRangeVisualIndication(poolParams, newPool, isDateInRange)
}

async function refreshNFTOrMultiplePoolInfo(poolParams: PoolParamsP3|PoolParamsNFT, newPool: HTMLElement){
  await poolParams.refreshAllExtraData()
  const contractParams = await poolParams.stakingContractData.getContractParams()
  const poolUserStatus = await poolParams.stakingContractData.getUserStatus()
  const stakeTokenContractList = await poolParams.stakingContractData.getStakeTokenContractList()
  const farmTokenContractList = await poolParams.stakingContractData.getFarmTokenContractList()

  if(poolParams instanceof PoolParamsP3) {
    await updateDetail(newPool, await stakeTokenContractList, contractParams.total_staked, "total-staked")
  } else if(poolParams instanceof PoolParamsNFT) {
    newPool.querySelector(".total-staked-value-usd")!.innerHTML = `${contractParams.total_staked} NFT's`
  }
  // updateDetail(newPool, poolParams.farmTokenContractList, poolParams.contractParams.total_farmed, "apr")
  const rewardsTokenDataArray = await poolParams.getRewardsTokenDetail()
  const rewardsPerDay = rewardsTokenDataArray.map(data => data.rewardsPerDayBN!.toString())
  await updateDetail(newPool, farmTokenContractList, rewardsPerDay, "rewards-per-day")
  await updateDetail(newPool, farmTokenContractList, poolUserStatus.farmed_tokens, "unclaimed-rewards")

  const now = Date.now() / 1000
  const isDateInRange = contractParams.farming_start < now && now < contractParams.farming_end

  if(poolParams instanceof PoolParamsP3) {
    const stakeBalances = await Promise.all(stakeTokenContractList.map(stakeCD => stakeCD.getBalance()))
    await refreshInputAmounts(poolParams, newPool, "main-stake", stakeBalances)
    // On PoolParamsP3 the poolUserStatus.stake_tokens is always a string[]
    await refreshInputAmounts(poolParams, newPool, "main-unstake", poolUserStatus.stake_tokens as string[])

    if(!isDateInRange) {
      resetMultiplePoolListener(poolParams, newPool, refreshNFTOrMultiplePoolInfo, -1)
    }
  } else if(poolParams instanceof PoolParamsNFT) {
    if(!isDateInRange) {
      resetNFTPoolListener(poolParams, newPool, refreshNFTOrMultiplePoolInfo, -1)
    }
  }

  setBoostDisplay(poolParams, newPool)

  setDateInRangeVisualIndication(poolParams, newPool, isDateInRange)
}

async function refreshInputAmounts(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement, className: string, amounts: U128String[]) {
  const inputArray = newPool.querySelectorAll(`.${className} .token-input-container`)
  const stakeTokenContractList = await poolParams.stakingContractData.getStakeTokenContractList()
  for(let i = 0; i < inputArray.length; i++) {
    const input = inputArray[i]
    const tokenContractData: TokenContractData = stakeTokenContractList[i]
    const balance = amounts[i]
    const metadata = await tokenContractData.getMetadata()
    const balanceDisplayable = convertToDecimals(balance, metadata.decimals, 5)
    input.querySelector(".value")!.innerHTML = balanceDisplayable

    const maxButton = input.querySelector(".max-button") as HTMLElement
    showOrHideMaxButton(Number(balanceDisplayable), maxButton)
  }
}

function convertRewardsRates(rates: string[]) {
  return rates.map(rate => (BigInt(rate) * 60n * 24n).toString())
}

async function updateDetail(newPool: HTMLElement, contractList: TokenContractData[], totals: string[], baseClass: string) {
  // CHECK 2
  const totalInUsd: string = await convertToUSDMultiple(contractList, totals)
  newPool.querySelector(`.${baseClass}-row .${baseClass}-value-usd`)!.innerHTML = `$ ${totalInUsd}`
  const totalDetailsElements: NodeListOf<HTMLElement> = newPool.querySelectorAll(`.${baseClass}-info-container .detail-row`)
  for(let i = 0; i < totalDetailsElements.length; i++) {
    const row = totalDetailsElements[i]
    const tokenMetadata = await contractList[i].getMetadata()
    const content = convertToDecimals(totals[i], tokenMetadata.decimals, 5)
    row.querySelector(".content")!.innerHTML = content
  }
}

async function uptadeDetailIfNecesary(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement, contractList: TokenContractData[], totals: string[], baseClass: string) {
  let doesPoolNeedDeposit = await needsStorageDeposit(poolParams.stakingContractData.contract)
    
  const stakeTokenList = poolParams.stakeTokenContractList
  for(let i = 0; i < stakeTokenList.length && !doesPoolNeedDeposit; i++) {
    const tokenContract = stakeTokenList[i].contract!
    const doesTokenNeedStorageDeposit = await needsStorageDeposit(tokenContract)
    if (doesTokenNeedStorageDeposit) {
      doesPoolNeedDeposit = true
    }
  }

  if (!doesPoolNeedDeposit) {
    await updateDetail(newPool, contractList, totals, baseClass)
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

function calculateAmountToStake(stakeRates: bigint[], totalStaked: bigint[], amount: bigint, inputIndex: number, outputIndex: number): bigint {
	const totalAmountStakedWithThisStake = totalStaked[inputIndex] + amount
  const amountToStake: bigint = totalAmountStakedWithThisStake * stakeRates[inputIndex] / stakeRates[outputIndex] - totalStaked[outputIndex]
  return amountToStake > 0n ? amountToStake : 0n
}


function calculateAmountToUnstake(stakeRates: bigint[], totalStaked: bigint[], amount: bigint, alreadySetIndex: number, newIndex: number) {
	const totalAmountStakedWithThisUnstake = totalStaked[alreadySetIndex] - amount
  const output = totalStaked[newIndex] - totalAmountStakedWithThisUnstake * stakeRates[alreadySetIndex] / stakeRates[newIndex]
  return output > 0n ? output : 0n
}

function autoFillStakeAmount(poolParams: PoolParamsP3, pool: HTMLElement, inputRoute: string, indexInputToken: number) {
  return async function (event: Event) {
    event.preventDefault()
    const value1 = (event.target as HTMLInputElement).value
    // const amountToStake = BigInt(value1)
    const stakeTokenContractList = await poolParams.stakingContractData.getStakeTokenContractList()
    const inputTokenMetadata = await stakeTokenContractList[indexInputToken].getMetadata()
    const amountToStakingOrUnstaking = BigInt(convertToBase(value1, inputTokenMetadata.decimals.toString()))
    const contractParams = await poolParams.stakingContractData.getContractParams()
    const poolUserStatus = await poolParams.stakingContractData.getUserStatus()

    let inputs: NodeListOf<HTMLInputElement> = pool.querySelectorAll(`${inputRoute} input`)! as NodeListOf<HTMLInputElement>
    const stakeRates = contractParams.stake_rates.map((rate: U128String) => BigInt(rate)) 
    const totalStakedByUser = poolUserStatus.stake_tokens.map(total => BigInt(total))
    for(let indexOutputToken = 0; indexOutputToken < inputs.length; indexOutputToken++) {
      if(indexOutputToken != indexInputToken) {
        let amountToTransferSecondaryBN
        if(inputRoute.includes("unstake")) {
          amountToTransferSecondaryBN = calculateAmountToUnstake(stakeRates, totalStakedByUser, amountToStakingOrUnstaking, indexInputToken, indexOutputToken)
        } else {
          amountToTransferSecondaryBN = calculateAmountToStake(stakeRates, totalStakedByUser, amountToStakingOrUnstaking, indexInputToken, indexOutputToken)
          
        }
        const currentStakeTokenMetadata = await stakeTokenContractList[indexOutputToken].getMetadata()
        const amountToStakeSecondary = convertToDecimals(amountToTransferSecondaryBN, currentStakeTokenMetadata.decimals, 5)
        // const amountToStakeSecondary
        inputs.item(indexOutputToken).value = amountToStakeSecondary
      }
    }
  }
}

async function addPoolSingle(poolParams: PoolParams, newPool: HTMLElement): Promise<void> {
  const contractParams: ContractParams = await poolParams.stakingContractData.getContractParams()
  const userStatus = await poolParams.stakingContractData.getUserStatus()
  const stakeTokenContractData: TokenContractData = await poolParams.getStakeTokenContractData();
  const farmTokenContractData: TokenContractData = await poolParams.getFarmTokenContractData();


  var metaData = await poolParams.stakeTokenContractList[0].getMetadata()
  let iconElem = newPool.querySelectorAll("#token-logo-container img")
  iconElem.forEach(icon => {
    icon!.setAttribute("src", metaData.icon || "");
  });
  
  await addInput(newPool, stakeTokenContractData, "stake")
  await addInput(newPool, stakeTokenContractData, "unstake", userStatus.staked.toString())

  await addHeader(poolParams, newPool)
  
  let unclaimedRewards = await getUnclaimedRewardsInUSDSingle(poolParams)

  const now = Date.now() / 1000
  const isDateInRange = now < contractParams.farming_end

  if (Number(unclaimedRewards.toFixed(7)) != 0) {
    newPool.querySelector(".unclaimed-rewards-value-usd")!.innerHTML = `$ ${unclaimedRewards.toFixed(7).toString()}`
  } else if ((Number(unclaimedRewards.toFixed(7)) != 0) && isDateInRange) {
    newPool.querySelector(".unclaimed-rewards-value-usd")!.innerHTML = `$ 0`
  } else {
    newPool.querySelector(".unclaimed-rewards-value-usd")!.innerHTML = `$ -`
  }


  const totalStakedInUsd = await convertToUSDMultiple([stakeTokenContractData], [contractParams.total_staked])
  const rewardsPerDayInUsd = await convertToUSDMultiple([farmTokenContractData], [(BigInt(contractParams.farming_rate) * 60n * 24n).toString()])

  newPool.querySelector(".total-staked-value-usd")!.innerHTML = `$ ${totalStakedInUsd}`
  newPool.querySelector(".rewards-per-day-value-usd")!.innerHTML = `$ ${rewardsPerDayInUsd}`
  
  const apr = calculateAPR(totalStakedInUsd, rewardsPerDayInUsd, isDateInRange)
  newPool.querySelector(".apr-value")!.innerHTML = `${apr}%`

  addSinglePoolListeners(poolParams, newPool)
}

function calculateAPR(totalStakedInUsd: string, rewardsPerDayInUsd: string, isDateInRange: boolean): string {
  if(!isDateInRange) {
    return "-"
  } else {
    return (365 * Number(rewardsPerDayInUsd) / Number(totalStakedInUsd) * 100).toFixed(2)
  }

}

async function addTokenFarmLogos(poolParams: PoolParams|PoolParamsP3, header: HTMLElement) {
  let tokenContractDataArray: TokenContractData[]
  if(poolParams instanceof PoolParams) {
    tokenContractDataArray = poolParams.stakeTokenContractList
  } else {
    tokenContractDataArray = await poolParams.stakingContractData.getStakeTokenContractList()
  } 
  // tokenContractDataArray: TokenContractData[] = poolParams.stakingContractData
  const logoContainer = header.querySelector(".token-logo-container")! as HTMLElement
  logoContainer.innerHTML = ""

  let i = 0
  for(; i < tokenContractDataArray.length; i++) {
    const tokenIconData = tokenContractDataArray[i]
    let metaData    
    metaData = await tokenIconData.getMetadata()
    
    addLogo(metaData, logoContainer, i)
  }
  logoContainer.classList.add(`have-${tokenContractDataArray.length}-elements`)
}

async function addNFTFarmLogo(poolParams: PoolParamsNFT, header: HTMLElement) {  
  // NFTContractData: TokenContractData[] = poolParams.stakingContractData
  const logoContainer = header.querySelector(".token-logo-container")! as HTMLElement
  logoContainer.innerHTML = ""

  const tokenLogoElement = qs(".generic-token-logo-img")
  let newTokenLogoElement = tokenLogoElement.cloneNode(true) as HTMLElement

  // For the time being there is only one token
  // const baseUrl = poolParams.stakingContractData.nftBaseUrl[0]
  const stakeNFTContractList = await poolParams.stakingContractData.getStakeNFTContractList()
  const metadata: NFTMetadata = await stakeNFTContractList[0].getMetadata()
  
  let imgUrl = metadata.icon
  if(!imgUrl) {
    imgUrl = poolParams.config.logo
  }
  newTokenLogoElement?.setAttribute("src", imgUrl)
  newTokenLogoElement?.setAttribute("alt", metadata.name)

  toggleGenericClass(newTokenLogoElement)
  newTokenLogoElement.classList.add(`farmed-token-logo`)
  logoContainer.append(newTokenLogoElement)
  
  logoContainer.classList.add(`have-1-elements`)
}

async function addAllLogos(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, header: HTMLElement) {
  if(poolParams instanceof PoolParams || poolParams instanceof PoolParamsP3) {
    addTokenFarmLogos(poolParams, header)
  } else if(poolParams instanceof PoolParamsNFT) {
    addNFTFarmLogo(poolParams, header)
  }
}

async function addHeader(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
  const genericHeader = qs(".generic-new-pool-header")
  const newHeader = genericHeader.cloneNode(true) as HTMLElement

  await addAllLogos(poolParams, newHeader)

  const poolContainer = newPool.querySelector("#pool-container") as HTMLElement
  const tokenPoolStatsContainer = newPool.querySelector("#token-pool-stats") as HTMLElement

  
  poolContainer.prepend(newHeader)
  
  toggleGenericClass(newHeader)
  const newTokenPoolStats = newHeader.cloneNode(true) as HTMLElement
  tokenPoolStatsContainer.prepend(newTokenPoolStats)
}

async function addMultiplePoolListeners(poolParams: PoolParamsP3, newPool: HTMLElement) {
  addAllCommonListeners(poolParams, newPool)
  let tokenSymbols = []
  const stakeTokenContractList = await poolParams.stakingContractData.getStakeTokenContractList()
  for(let i=0; i < stakeTokenContractList.length; i++){ // Harvest button listener
    const contractData = stakeTokenContractList[i]
    const currentStakeTokenMetadata = await contractData.getMetadata()
    tokenSymbols.push(`${currentStakeTokenMetadata.symbolForHtml.toLowerCase()}`)
  }

  newPool.querySelector(".confetti-button")?.addEventListener("click", harvestMultipleOrNFT(poolParams, newPool))


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
  const contractParams = await poolParams.stakingContractData.getContractParams()
  const isDateInRange = contractParams.farming_start < now && now < contractParams.farming_end
  let refreshIntervalId = -1
  if(isDateInRange) {
    refreshIntervalId = window.setInterval(refreshNFTOrMultiplePoolInfo.bind(null, poolParams, newPool), refreshTime)
  }  
  
  //Info to transfer so we can check what pool is loading the NFTs
  let boostButton = newPool.querySelector(".boost-button")! as HTMLElement;
  let boostButtonId = boostButton.id
  boostButton.addEventListener("click", showNFTGrid(poolParams, boostButtonId))

  // Hover events
  standardHoverToDisplayExtraInfo(newPool, "total-staked")
  // standardHoverToDisplayExtraInfo(newPool, "apr")
  standardHoverToDisplayExtraInfo(newPool, "rewards-per-day")
  standardHoverToDisplayExtraInfo(newPool, "reward-tokens")
  standardHoverToDisplayExtraInfo(newPool, "unclaimed-rewards")
}

async function addNFTPoolListeners(poolParams: PoolParamsNFT, newPool: HTMLElement) {
  addAllCommonListeners(poolParams, newPool)
  let tokenSymbols = []
  const stakeTokenContractList = await poolParams.stakingContractData.getStakeTokenContractList()
  for(let i=0; i < stakeTokenContractList.length; i++){ // Harvest button listener
    const contractData = stakeTokenContractList[i]
    const currentStakeTokenMetadata = await contractData.getMetadata()
    tokenSymbols.push(`${currentStakeTokenMetadata.symbolForHtml.toLowerCase()}`)
  }
  newPool.querySelector(".confetti-button")?.addEventListener("click", harvestMultipleOrNFT(poolParams, newPool))

  let stakeUnstakeNftButton = newPool.querySelector("#stake-unstake-nft")! as HTMLButtonElement
  let stakeUnstakeNftButtonId = stakeUnstakeNftButton.id
  stakeUnstakeNftButton.addEventListener("click", async function() {
    stakeUnstakeNftButton.disabled = true;
    stakeUnstakeNftButton.innerHTML = "Loading...";
    await showStakeUnstakeNFTGrid(poolParams, stakeUnstakeNftButtonId);
    stakeUnstakeNftButton.disabled = false;
    stakeUnstakeNftButton.innerHTML = "STAKE/UNSTAKE";
  });

  // Refresh every 60 seconds if it's live
  const now = Date.now() / 1000
  const contractParams = await poolParams.stakingContractData.getContractParams()
  const isDateInRange = contractParams.farming_start < now && now < contractParams.farming_end
  let refreshIntervalId = -1
  if(isDateInRange) {
    refreshIntervalId = window.setInterval(refreshNFTOrMultiplePoolInfo.bind(null, poolParams, newPool), refreshTime)
  }  
  
  //Info to transfer so we can check what pool is loading the NFTs
  let boostButton = newPool.querySelector(".boost-button")! as HTMLElement;
  let boostButtonId = boostButton.id
  boostButton.addEventListener("click", showNFTGrid(poolParams, boostButtonId))

  // Hover events
  standardHoverToDisplayExtraInfo(newPool, "total-staked")
  // standardHoverToDisplayExtraInfo(newPool, "apr")
  standardHoverToDisplayExtraInfo(newPool, "rewards-per-day")
  standardHoverToDisplayExtraInfo(newPool, "reward-tokens")
  standardHoverToDisplayExtraInfo(newPool, "unclaimed-rewards")
}

function addPoolTokensDescription (newPool: HTMLElement, poolParams: PoolParams|PoolParamsP3|PoolParamsNFT) {
  const legendContainer = newPool.querySelector(".pool-legend") as HTMLElement
  let poolLegends = poolParams.poolDescription;
  if(poolLegends != undefined){
    for(let i=0; i < poolLegends.length; i++){
      const descriptionLinks = poolParams.descriptionLink;
      
      if(descriptionLinks != undefined){
        poolLegends[i] += `<a href="${descriptionLinks[i]}" target="_blank"> here.</a></br>`
      }

      legendContainer.innerHTML += poolLegends[i]
      legendContainer.classList.remove("hidden")
    }
  }
}

async function addNFTPool(poolParams: PoolParamsNFT, newPool: HTMLElement): Promise<void> {
  const farmTokenContractList: TokenContractData[] = await poolParams.stakingContractData.getFarmTokenContractList()
  let contractParams: NFTStakingContractParams = await poolParams.stakingContractData.getContractParams()

  await addHeader(poolParams, newPool)

  const rewardsTokenDataArray = await poolParams.getRewardsTokenDetail()
  const rewardsPerDay = rewardsTokenDataArray.map(data => data.rewardsPerDayBN!.toString())
  const rewardsPerDayInUsd = await convertToUSDMultiple(farmTokenContractList, rewardsPerDay)
  newPool.querySelector(".rewards-per-day-value-usd")!.innerHTML = `$ ${rewardsPerDayInUsd}`

  if(!poolParams.config.noBoost) {
    newPool.querySelector(".boost-button")!.classList.remove("hidden")
  } else {
    newPool.querySelector(".equal-width-than-boost-button")!.classList.add("hidden")
    let harvestSection: HTMLElement = newPool.querySelector(".harvest-section")!
    harvestSection.style.justifyContent = "center"
  }
  newPool.querySelector(".structural-in-simple-pools")!.classList.add("hidden")

  //TODO DANI check apr and staked value
  // let farmTokenContractList = await poolParams.stakingContractData.getFarmTokenContractList()
  
  const now = Date.now() / 1000
  const isDateInRange = now < contractParams.farming_end
  
  let farmTokenRateInUSD = await convertToUSDMultiple(farmTokenContractList, contractParams.farm_token_rates)
  let NFTDepositedx100 = Number(contractParams.total_staked[0]) * 100
  // const apr =  rewards. emission_rate * minutes * hours * 365 / <number of NFT's deposited> * 100
  let apr = calculateAPR(farmTokenRateInUSD, NFTDepositedx100.toString(), isDateInRange)
  newPool.querySelector(".apr-value")!.innerHTML = `${apr}%`

  setBoostDisplay(poolParams, newPool)

  addNFTPoolListeners(poolParams, newPool)  

  refreshNFTOrMultiplePoolInfo(poolParams, newPool)
}

async function addPoolMultiple(poolParams: PoolParamsP3, newPool: HTMLElement): Promise<void> {
  const contractParams = await poolParams.stakingContractData.getContractParams()
  const poolUserStatus = await poolParams.stakingContractData.getUserStatus()
  const stakeTokenContractList = await poolParams.stakingContractData.getStakeTokenContractList()
  const farmTokenContractList = await poolParams.stakingContractData.getFarmTokenContractList()
  await addHeader(poolParams, newPool)
  let tokenSymbols = []
  await poolParams.getWalletAvailable()
  for(let i=0; i < stakeTokenContractList.length; i++){
    const contractData = stakeTokenContractList[i]
    const metaData = await contractData.getMetadata()

    await addInput(newPool, contractData, "stake")
    await addInput(newPool, contractData, "unstake", poolUserStatus.stake_tokens[i])
    
    tokenSymbols.push(`${metaData.symbolForHtml.toLowerCase()}`)
  }

  //Show boost button patch (since simple pools will disapear and they have problems with the boost button)
  newPool.querySelector(".boost-button")!.classList.remove("hidden")
  newPool.querySelector(".structural-in-simple-pools")!.classList.add("hidden")

  
  const unclaimedRewards = Number(await convertToUSDMultiple(farmTokenContractList, poolUserStatus.farmed_tokens))
  // const unclaimedRewards = Number(await convertToUSDMultiple(poolParams.farmTokenContractList, poolParams.resultParams.farmed))

  const now = Date.now() / 1000
  const isDateInRange = now < contractParams.farming_end

  if (Number(unclaimedRewards.toFixed(7)) != 0) {
    newPool.querySelector(".unclaimed-rewards-value-usd")!.innerHTML = `$ ${unclaimedRewards.toFixed(7).toString()}`
  } else if ((Number(unclaimedRewards.toFixed(7)) != 0) && isDateInRange) {
    newPool.querySelector(".unclaimed-rewards-value-usd")!.innerHTML = `$ 0`
  } else {
    newPool.querySelector(".unclaimed-rewards-value-usd")!.innerHTML = `$ -`
  }
  
  const totalStakedInUsd: string = await convertToUSDMultiple(stakeTokenContractList, contractParams.total_staked)
  
  // CHECK!
  const legendContainer = newPool.querySelector(".pool-legend") as HTMLElement
  let poolLegends = poolParams.poolDescription;
  if(poolLegends != undefined){
    for(let i=0; i < poolLegends.length; i++){
      const descriptionLinks = poolParams.descriptionLink;
      
      if(descriptionLinks != undefined){
        poolLegends[i] += `<a href="${descriptionLinks[i]}" target="_blank"> here.</a>`
      }

      legendContainer.innerHTML += poolLegends[i] + "</br>"
      legendContainer.classList.remove("hidden")
    }
  }


  const rewardsTokenDataArray = await poolParams.getRewardsTokenDetail()
  const rewardsPerDay = rewardsTokenDataArray.map(data => data.rewardsPerDayBN!.toString())
  const rewardsPerDayInUsd = await convertToUSDMultiple(farmTokenContractList, rewardsPerDay)
  newPool.querySelector(".total-staked-row .total-staked-value-usd")!.innerHTML = `$ ${totalStakedInUsd}`
  // newPool.querySelector(".apr-row .apr-value")!.innerHTML = `$ ${totalFarmedInUsd}`
  newPool.querySelector(".rewards-per-day-value-usd")!.innerHTML = `$ ${rewardsPerDayInUsd}`

  const apr = calculateAPR(totalStakedInUsd, rewardsPerDayInUsd, isDateInRange)
  newPool.querySelector(".apr-value")!.innerHTML = `${apr}%`

  setBoostDisplay(poolParams, newPool)

  addMultiplePoolListeners(poolParams, newPool)
}

async function setBoostDisplay(poolParams: PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
  const poolUserStatus: PoolUserStatusP3|PoolUserStatusP3NFT = await poolParams.stakingContractData.getUserStatus()
  let hasNFTStaked
  if("boost_nfts" in poolUserStatus) {
    hasNFTStaked = poolUserStatus.boost_nfts != ''
  } else {
    hasNFTStaked = poolUserStatus.cheddy_nft != ''
  }
  // hasNFTStaked = poolUserStatus.cheddy_nft != ''
  if(hasNFTStaked) {
    newPool.querySelector(".boost-button svg")!.setAttribute("class", "full")
    newPool.querySelector(".boost-button span")!.innerHTML = "BOOSTED"
  } else {
    newPool.querySelector(".boost-button svg")!.setAttribute("class", "empty")
    newPool.querySelector(".boost-button span")!.innerHTML = "BOOST"
  }
}

function addFocusClass(input:HTMLElement) {
  return function (event:Event) {
    event?.preventDefault
    input.classList.toggle("focused")
  }
}

async function addInput(newPool: HTMLElement, contractData: TokenContractData, action: string, stakedAmount?: U128String) {
  let inputContainer = qs(".generic-token-input-container")
  var newInputContainer = inputContainer.cloneNode(true) as HTMLElement
  let inputRowContainer = newInputContainer.querySelector(".input-container") as HTMLElement
  let infoRowContainer = newInputContainer.querySelector(".available-info") as HTMLElement
  let input = newInputContainer.querySelector("input") as HTMLElement
  
  const metaData = await contractData.getMetadata()
  newInputContainer.classList.remove("generic-token-input-container")
  newInputContainer.classList.add("token-input-container")
  newInputContainer.classList.add(`${metaData.symbolForHtml.toLowerCase()}-input`)
  newInputContainer.classList.remove(`hidden`)

  newInputContainer.querySelector(".available-info span")!.innerHTML = `Available to ${action}`
  newInputContainer.querySelector(".amount-available")?.classList.add(action)

  input!.addEventListener("focus", addFocusClass(inputRowContainer!))
  input!.addEventListener("blur", addFocusClass(inputRowContainer!))
  
  let inputLogoContainer = newInputContainer.querySelector(".input-container .token-logo") as HTMLElement
  let amountAvailableValue = newInputContainer.querySelector(".amount-available .value")
  let maxButton = infoRowContainer.querySelector(".max-button") as HTMLElement

  if (metaData.icon != null){
    if(metaData.icon.startsWith("data:image")) {
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

  const balance = await contractData.getBalance()
  if(action == "stake") {
    amountAvailableValue!.innerHTML= convertToDecimals(balance, metaData.decimals, 5)
  } else if(action == "unstake") {
    amountAvailableValue!.innerHTML= convertToDecimals(stakedAmount!, metaData.decimals, 5)
  }
  const balanceDisplayable = convertToDecimals(balance, metaData.decimals, 5)
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

async function addAllCommonListeners(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
  let infoIcon = newPool.querySelector(".new-pool-header .information-icon-container")! as HTMLElement;
  let poolStats = newPool.querySelector("#token-pool-stats")! as HTMLElement;
  
  infoIcon.addEventListener("mouseover", showElement(poolStats));
  poolStats.addEventListener("mouseover", showElement(poolStats));
  poolStats.addEventListener("mouseout", hideElement(poolStats));

  // let harvestButton = newPool.querySelector(".confetti-button") as HTMLButtonElement

  // //You can check how to configure it in https://party.js.org/
  // let confettiConfiguration = {
  //   count: party.variation.range(25,30),
  //   spread: party.variation.range(20,25)
  // }

  // harvestButton.addEventListener("click", function () {
  //   party.confetti(harvestButton, confettiConfiguration);
  // });

  let doesNeedStorageDeposit : boolean
  if(poolParams instanceof PoolParams) {
    doesNeedStorageDeposit = false
  } else {
    doesNeedStorageDeposit = await needsStorageDeposit(poolParams.stakingContractData.contract)
  }
  // Displays staking/unstaking when hovering on the pool(only in Live and Your Farms)
  
  if(!(poolParams instanceof PoolParamsNFT) && !doesNeedStorageDeposit && !newPool.classList.contains("inactive-pool")) {
    let vanishingIndicator = newPool.querySelector("#vanishing-indicator") as HTMLElement
    vanishingIndicator?.classList.remove("transparent")
    vanishingIndicator?.classList.add("visual-tool-expanding-indication-hidden")
    newPool.addEventListener("mouseover", paintOrUnPaintElement("visual-tool-expanding-indication-hidden", vanishingIndicator));
    newPool.addEventListener("mouseout", paintOrUnPaintElement("visual-tool-expanding-indication-hidden",vanishingIndicator));    

    let expandButtonStakingUnstaking = newPool.querySelector(".expand-button") as HTMLElement
    newPool.addEventListener("mouseover", makeBlinkElement(expandButtonStakingUnstaking));
    newPool.addEventListener("mouseout", makeBlinkElement(expandButtonStakingUnstaking));
  }
}

async function addSinglePoolListeners(poolParams: PoolParams, newPool: HTMLElement) {
  addAllCommonListeners(poolParams, newPool)
  // Harvest button listener
  const contractData = await poolParams.getStakeTokenContractData()
  const metaData = await contractData.getMetadata()
  newPool.querySelector(".confetti-button")?.addEventListener("click", harvestSingle(poolParams, newPool))
  // Token symbols is done this way to emulate multiple case. Single case will be removed shortly
  let tokenSymbols = []
  tokenSymbols.push(`${metaData.symbol.toLowerCase()}`)
  newPool.querySelector(".confetti-button")?.addEventListener("click", harvestSingle(poolParams, newPool))

  // Stake/unstake buttons
  newPool.querySelector("#stake-button")?.addEventListener("click", stakeSingle(poolParams, newPool))
  newPool.querySelector("#unstake-button")?.addEventListener("click", unstakeSingle(poolParams, newPool))
  
  setAllInputMaxButtonListeners(newPool)
  // Refresh every 5 seconds if it's live
  const now = Date.now() / 1000
  const contractParams = await poolParams.stakingContractData.getContractParams()
  const isDateInRange = contractParams.farming_start < now && now < contractParams.farming_end
  let refreshIntervalId = -1
  if(isDateInRange) {
    refreshIntervalId = window.setInterval(refreshPoolInfoSingle.bind(null, poolParams, newPool), refreshTime)
  }
  

  // Hover events
  standardHoverToDisplayExtraInfo(newPool, "total-staked")
  // standardHoverToDisplayExtraInfo(newPool, "apr")
  standardHoverToDisplayExtraInfo(newPool, "rewards-per-day")
  standardHoverToDisplayExtraInfo(newPool, "reward-tokens")
  standardHoverToDisplayExtraInfo(newPool, "unclaimed-rewards")
}

async function resetSinglePoolListener(poolParams: PoolParams, pool: HTMLElement, refreshFunction: (pp: PoolParams, np: HTMLElement) => void, refreshIntervalId: number) {
  const contractParams = await poolParams.stakingContractData.getContractParams()
  let newPool = pool.cloneNode(true) as HTMLElement
  hideAllDynamicElements(newPool)
  addFilterClasses(poolParams, newPool)
  
  addSinglePoolListeners(poolParams, newPool)
  if(newPool.classList.contains("inactive-pool")) {
    displayInactiveP2P3Pool(newPool)
  } else {
    displayActivePool(poolParams, newPool)
  }
  if(refreshIntervalId != -1) {
    clearInterval(refreshIntervalId)
    const now = Date.now() / 1000
    const isDateInRange = contractParams.farming_start < now && now < contractParams.farming_end
    refreshIntervalId = -1
    if(isDateInRange) {
      refreshIntervalId = window.setInterval(refreshFunction.bind(null, poolParams, newPool), 5000)
    }
    
  }

  pool.replaceWith(newPool)

  const event = new Event('click')
  qs(".activeFilterButton").dispatchEvent(event)
}

async function resetMultiplePoolListener(poolParams: PoolParamsP3, pool: HTMLElement, refreshFunction: (pp: PoolParamsP3, np: HTMLElement) => void, refreshIntervalId: number) {
  let newPool = pool.cloneNode(true) as HTMLElement
  hideAllDynamicElements(newPool)
  addFilterClasses(poolParams, newPool)
  addMultiplePoolListeners(poolParams, newPool)
  
  if(newPool.classList.contains("inactive-pool")) {
    displayInactiveP2P3Pool(newPool)
  } else {
    displayActivePool(poolParams, newPool)
  }
  if(refreshIntervalId != -1) {
    clearInterval(refreshIntervalId)
    const now = Date.now() / 1000
    const contractParams = await poolParams.stakingContractData.getContractParams()
    const isDateInRange = contractParams.farming_start < now && now < contractParams.farming_end
    refreshIntervalId = -1
    if(isDateInRange) {
      refreshIntervalId = window.setInterval(refreshFunction.bind(null, poolParams, newPool), 5000)
    }
    
  }

  pool.replaceWith(newPool)

  const event = new Event('click')
  qs(".activeFilterButton").dispatchEvent(event)
}

async function resetNFTPoolListener(poolParams: PoolParamsNFT, pool: HTMLElement, refreshFunction: (pp: PoolParamsNFT, np: HTMLElement) => void, refreshIntervalId: number) {
  let newPool = pool.cloneNode(true) as HTMLElement
  hideAllDynamicElements(newPool)
  addFilterClasses(poolParams, newPool)
  addNFTPoolListeners(poolParams, newPool)
  
  // For some reason, newPool.classList.contains("inactive-pool") returns false when it has that class from time to time
  // So we're putting just pool. This should make the refresh to be bad on a first scenario, but good on a second one.
  if(pool.classList.contains("inactive-pool")) {
    displayInactiveNFTPool(newPool, pool)
  } else {
    displayActivePool(poolParams, newPool)
  }
  if(refreshIntervalId != -1) {
    clearInterval(refreshIntervalId)
    const now = Date.now() / 1000
    const contractParams = await poolParams.stakingContractData.getContractParams()
    const isDateInRange = contractParams.farming_start < now && now < contractParams.farming_end
    refreshIntervalId = -1
    if(isDateInRange) {
      refreshIntervalId = window.setInterval(refreshFunction.bind(null, poolParams, newPool), 5000)
    }
    
  }

  pool.replaceWith(newPool)

  // const event = new Event('click')
  // qs(".activeFilterButton").dispatchEvent(event)
}

async function addFilterClasses(poolParams: PoolParams | PoolParamsP3 | PoolParamsNFT, newPool: HTMLElement) {
  // Cleaning classes in case of reset
  const classes = ["your-farms", "active-pool", "inactive-pool"]
  classes.forEach(className => newPool.classList.remove(className))
  
  const now = Date.now() / 1000
  const contractParams = await poolParams.stakingContractData.getContractParams()
  // const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  const isDateInRange = now < contractParams.farming_end
  
  // const poolUserStatus: PoolUserStatus|[string, string, string] = await poolParams.stakingContractData.getUserStatus()
  if(await poolParams.userHasStakedTokens()){
    newPool.classList.add("your-farms")
  }
  if(isDateInRange) {
    newPool.classList.add("active-pool")
  } else {
    newPool.classList.add("inactive-pool")
  }
}

async function addPool(poolParams: PoolParams | PoolParamsP3 | PoolParamsNFT): Promise<void> {
  var genericPoolElement = qs("#generic-pool-container") as HTMLElement;
  let singlePoolParams: PoolParams
  let multiplePoolParams: PoolParamsP3
  
  var newPool = genericPoolElement.cloneNode(true) as HTMLElement;
  
  newPool.setAttribute("id", poolParams.html.id.toLowerCase().replace(" ", "_"))
  newPool.classList.remove("hidden")
  newPool.classList.add("pool-container")

  addFilterClasses(poolParams, newPool)
  await addRewardTokenIcons(poolParams, newPool)
  await addTotalStakedDetail(poolParams, newPool)
  await addRewardsPerDayDetail(poolParams, newPool)
  await addRewardsTokenDetail(poolParams, newPool)
  await addUnclaimedRewardsDetail(poolParams, newPool)
  if (poolParams instanceof PoolParams && poolParams.type == "single") {
    singlePoolParams = poolParams
    await addPoolSingle(singlePoolParams, newPool)
  } else if (poolParams instanceof PoolParamsP3 && poolParams.type == "multiple"){
    multiplePoolParams = poolParams
    await addPoolMultiple(multiplePoolParams, newPool)
  } else if(poolParams instanceof PoolParamsNFT && poolParams.type == "nft") {
    await addNFTPool(poolParams, newPool)
  }

  addPoolTokensDescription(newPool, poolParams)
  
  
  // New code
  let showContractStart = newPool.querySelector("#contract-start")
  let showContractEnd = newPool.querySelector("#contract-end")
  const contractParams = await poolParams.stakingContractData.getContractParams()

  const accountRegistered = contractParams.accounts_registered
  newPool.querySelector(".accounts-registered-value-usd")!.innerHTML = `${accountRegistered} accounts`
  
  showContractStart!.innerHTML = new Date(contractParams.farming_start * 1000).toLocaleString()
  showContractEnd!.innerHTML = new Date(contractParams.farming_end * 1000).toLocaleString()

  const poolName = await poolParams.getPoolName()
  newPool.querySelectorAll(".token-name").forEach(element => {
    element.innerHTML = poolName
  })

  if(newPool.classList.contains("inactive-pool")) {
    displayInactiveP2P3Pool(newPool)
  } else {
    await displayActivePool(poolParams, newPool)
  }
 
  
  // await addTotalFarmedDetail(poolParams, newPool)
  
  let unixTimestamp = new Date().getTime() / 1000;
  // const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
  const isDateInRange = unixTimestamp < contractParams.farming_end
  setDateInRangeVisualIndication(poolParams, newPool, isDateInRange)
  
  qs("#pool_list").append(newPool)

  newPool.querySelector(".deposit-fee-value")!.innerHTML = (contractParams.fee_rate) ? contractParams.fee_rate / 100 + "%" : "0%"

  poolParams.confettiButton = new ConfettiButton(newPool)
  poolParams.confettiButton.render(
    poolParams.confettiButton.confettiButton,
    poolParams.confettiButton.canvas,
    poolParams.confettiButton.confetti,
    poolParams.confettiButton.sequins
  )

  let harvestedSuccesfully = sessionStorage.getItem("cheddarFarmHarvestedSuccesfully")
  
  if(harvestedSuccesfully != null){
    let isUserFarming = newPool.classList.contains("your-farms")
    // console.log("isUserFarming", isUserFarming)
    isUserFarming && showSuccessOnHarvestAnimation(newPool, poolParams)
  }
}

function showSuccessOnHarvestAnimation(newPool: HTMLElement, poolParams: PoolParams|PoolParamsP3|PoolParamsNFT) {
  let poolID = newPool.id
  let harvestedPoolID = sessionStorage.getItem("cheddarFarmJustHarvested")
  // console.log("poolID", poolID)
  // console.log("harvestedPoolID", harvestedPoolID)
  
  if(poolID == harvestedPoolID) {
    while(document.readyState != "complete"){
      setTimeout(() => {
      }, 1000);
    }
    poolParams.confettiButton?.successAnimation()
    sessionStorage.removeItem("cheddarFarmJustHarvested")
    sessionStorage.removeItem("cheddarFarmHarvestedSuccesfully")    
  }
}

function displayInactiveP2P3Pool(newPool: HTMLElement) {
  const isUserFarming = newPool.classList.contains("your-farms")
  if(isUserFarming) {
    toggleStakeUnstakeSection(newPool)
    setUnstakeTabListeners(newPool)

    newPool.querySelector(".harvest-section")!.classList.remove("hidden")
    newPool.querySelector("#staking-unstaking-container .staking")!.setAttribute("disabled", "disabled")
    const event= new Event ("click")
    newPool.querySelector("#staking-unstaking-container .unstaking")!.dispatchEvent(event)
  }
}

function displayInactiveNFTPool(newPool: HTMLElement, pool: HTMLElement) {
  const isUserFarming = pool.classList.contains(`your-farms`)
  if(isUserFarming) {
    newPool.querySelector("#stake-unstake-nft")!.classList.remove("hidden")
    newPool.querySelector(".harvest-section")!.classList.remove("hidden")
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

function displayIfNftPool(newPool: HTMLElement, isAccountRegistered: boolean,hasUserStaked:boolean) {
  if(isAccountRegistered) {
    // if the pool has ended and user doesn't has any NFT staked don't show the stake/unstake btn
    if(newPool.classList.contains("inactive-pool") && !hasUserStaked){
      return;
    } 
    let stakeUnstakeNftButton = newPool.querySelector("#stake-unstake-nft")! as HTMLButtonElement;
    stakeUnstakeNftButton.classList.remove("hidden")
  }
}

function displayIfTokenPool(newPool: HTMLElement, isAccountRegistered: boolean){

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
  }
}

async function displayActivePool(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
  let activateButtonContainer = newPool.querySelector("#activate") as HTMLElement
  let activateButton = newPool.querySelector(".activate") as HTMLElement
  let harvestSection = newPool.querySelector(".harvest-section") as HTMLElement

  if(wallet != disconnectedWallet) {
    let isAccountRegistered = (await poolParams.stakingContractData.contract.storageBalance()) != null;

    if(!isAccountRegistered) {
      activateButtonContainer.classList.remove("hidden")
      activateButton.addEventListener("click", activateClicked(poolParams, newPool))

      if (poolParams.html.formId == "nearcon" || poolParams.html.formId == "cheddar") {
        let warningText = "ONLY ACTIVATE IF PREVIOUSLY STAKED<br>0.06 NEAR storage deposit, gets refunded."
        newPool.querySelector("#depositWarning")!.innerHTML = warningText 
      }
    }
    
    if(poolParams instanceof PoolParams || poolParams instanceof PoolParamsP3){

      displayIfTokenPool(newPool, isAccountRegistered)

    } else if(poolParams instanceof PoolParamsNFT) {
      const poolUserStatus = await poolParams.stakingContractData.getUserStatus()
      // check for user stake 
      const hasUserStakedNFT = poolUserStatus.stake_tokens.some(total => total.length > 0) && poolUserStatus.stake != "0"
      displayIfNftPool(newPool, isAccountRegistered,hasUserStakedNFT)

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

  if (metaData.icon != null && metaData.icon != ''){
    // inputLogoContainer.innerHTML= `${metaData.icon}`
    if(metaData.icon.startsWith("data:image")) { // icon is img
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
  newTokenLogoElement.classList.add(`farmed-token-logo`)
  container.append(newTokenLogoElement)
}

async function addRewardTokenIcons(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
  const tokenIconDataArray: TokenIconData[] = await poolParams.getRewardTokenIconData()
  const container = newPool.querySelector(".reward-tokens-value-usd") as HTMLElement
  
  for(let i = 0; i < tokenIconDataArray.length; i++) {
    const tokenIconData = tokenIconDataArray[i]
    
    var newMiniIcon = importMiniIcon(tokenIconData) as HTMLElement
    container.append(newMiniIcon)
  }
}

async function addTotalStakedDetail(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
  const stakeTokenDataArray = await poolParams.getStakeTokensDetail()
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

async function addRewardsPerDayDetail(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
  convertAndAddRewardDataRows(poolParams, newPool, "rewards-per-day-info-container", "rewardsPerDay")
}

// async function addTotalFarmedDetail(poolParams: PoolParams|PoolParamsP3, newPool: HTMLElement) {
//   convertAndAddRewardDataRows(poolParams, newPool, "apr-info-container", "totalRewards")
// }

async function convertAndAddRewardDataRows(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement, parentClass: string, key: string) {
  const rewardsTokenDataArray = await poolParams.getRewardsTokenDetail()
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

async function addRewardsTokenDetail(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
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

async function addUnclaimedRewardsDetail(poolParams: PoolParams|PoolParamsP3|PoolParamsNFT, newPool: HTMLElement) {
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


async function addPoolList(poolList: Array<PoolParams|PoolParamsP3|PoolParamsNFT>) {
  qs("#pool_list").innerHTML = ""
  for (let i = 0; i < poolList.length; i++) {
    await addPool(poolList[i]);
  }

  qs("#pool_list").style.display = "grid"

  if (qs("#pool_list").childElementCount == 0) {
    qs("#pool_list").innerHTML = `<h2 class="no-pools">New Pools SoonTM...⚙️ Try our games!🕹️</h2>`
  }

  // qs(".loader").style.display = "none"

  isPaused = false;
}

let closePublicityButton = qs(".close-publicity") as HTMLElement

function closePublicityButtonHandler() {
  return function () {
    closePublicityButton.classList.add("hidden")

    let publicityContainer = qs(".publicity-container") as HTMLElement
    publicityContainer.classList.add("hidden")

    let publicityDecoration = qs(".publicity-decoration") as HTMLElement
    publicityDecoration.classList.add("no-publicity-position")

    let header = qs("header") as HTMLElement
    header.classList.add("no-publicity-position")

    let burguer = qs("#burguer") as HTMLElement
    burguer.classList.add("no-publicity-position")
  }
}

function setCountdown() {
  var countDownDate = new Date("Aug 22, 2022 12:00:00 UTC");
  var countDownDate = new Date(countDownDate.getTime() - countDownDate.getTimezoneOffset() * 60000)
  // Time calculations for days, hours, minutes and seconds
  var d = new Date();
  var d = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  var distance = countDownDate.getTime() - d.getTime();

  if(distance < 0) {
    clearInterval(countDownIntervalId)
    document.getElementById("timer")!.innerHTML = "";
  }
  var days = Math.floor(distance / (1000 * 60 * 60 * 24));
  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((distance % (1000 * 60)) / 1000);
  document.getElementById("timer")!.innerHTML = `<h2><span style='color:#222'>New Pools Start In: </span><span style='color:rgba(80,41,254,0.88)'>${days} d : ${hours} h :  
  ${minutes} m : ${seconds} s</span></h2>`;
}

window.onload = async function () {
  try {
    let env = ENV //default

    if (env != nearConfig.networkId)
      nearConfig = getConfig(ENV);

    near = await nearAPI.connect(
      Object.assign(
          {
              deps: {
                  keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore()
              }
          },
          nearConfig
      )
    )

    
    closePublicityButton.addEventListener("click", closePublicityButtonHandler())
    //Path tag is part of the svg tag and also need the event
    closePublicityButton.querySelector("path")!.addEventListener("click", closePublicityButtonHandler())

    let headerCheddarValueDisplayerContainer = qs(".header-extension_cheddar-value") as HTMLElement
    let cheddarValue = Number((await getTokenData("cheddar")).price).toFixed(7)
    headerCheddarValueDisplayerContainer.innerHTML = `$ ${cheddarValue}`


    // initButton()
    // countDownIntervalId = window.setInterval(function(){
    //   setCountdown()
    // }, 1000);
    


    //init narwallets listeners
    narwallets.setNetwork(nearConfig.networkId); //tell the wallet which network we want to operate on
    addNarwalletsListeners(narwalletConnected, narwalletDisconnected) //listen to narwallets events

    //set-up auto-refresh loop (10 min)
    setInterval(autoRefresh, 10 * MINUTES)

    //check if signed-in with NEAR Web Wallet
    await initNearWebWalletConnection()
    let didJustActivate = false
    initLiquidButton()

    const cheddarContractName = (ENV == 'mainnet') ? CHEDDAR_CONTRACT_NAME : TESTNET_CHEDDAR_CONTRACT_NAME
    const cheddarContract = new NEP141Trait(cheddarContractName);

    let circulatingSupply = await cheddarContract.ft_total_supply()
    let allSuplyTextContainersToFill = document.querySelector(".circulatingSupply.supply") as HTMLElement

    allSuplyTextContainersToFill.innerHTML = toStringDec(yton(circulatingSupply)).split('.')[0];

    if (nearWebWalletConnection.isSignedIn()) {
      //already signed-in with NEAR Web Wallet
      //make the contract use NEAR Web Wallet
      wallet = new NearWebWallet(nearWebWalletConnection);
      
      // const poolList = await getPoolList(wallet)
      // await addPoolList(poolList)

      accountName = wallet.getAccountId()
      qsInnerText("#account-id", accountName)      
      
      await signedInFlow(wallet)
      cheddarContract.wallet = wallet;
      const cheddarBalance = await cheddarContract.ft_balance_of(accountName)
      const amountAvailable = toStringDec(yton(await wallet.getAccountBalance()))
      qsInnerText("#my-account #wallet-available", amountAvailable)
      qsInnerText("#my-account #cheddar-balance", convertToDecimals(cheddarBalance, 24, 5))
      qsInnerText("#nft-pools-section .cheddar-balance-container .cheddar-balance", convertToDecimals(cheddarBalance, 24, 5))


      //check if we're re-spawning after a wallet-redirect
      //show transaction result depending on method called
      const searchParamsResultArray = await checkRedirectSearchParamsMultiple(nearWebWalletConnection, nearConfig.explorerUrl || "explorer");
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
          let arg = JSON.parse(atob(finalExecutionOutcome.transaction.actions[0].FunctionCall.args))
          if(arg.token == undefined) {
            const stakeContract = finalExecutionOutcome.transaction.receiver_id
            for(let i = 0; i < nearConfig.farms.length; i++) {
              const farmData = nearConfig.farms[i]
              if(farmData.contractName == stakeContract) {
                arg.token = farmData.tokenContractName
                break
              }
            }
          }
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
      } else if(method == "storage_deposit"){
        didJustActivate = true
        showSuccess("Successfully activated", "Activate")
      } else if(method == "withdraw_crop") {
        window.sessionStorage.setItem("cheddarFarmHarvestedSuccesfully", "yes")
        showSuccess("Tokens harvested successfully")
      } else {
        console.log("Method", method)
        console.log("Args", args.join("\n"))
      }
      
    }
    else {
      //not signed-in 
      await signedOutFlow() //show home-not-connected -> select wallet page
    }
    const poolList = await getPoolList(wallet)
    await addPoolList(poolList)
    setDefaultFilter(didJustActivate)
  }
  catch (ex) {
    showErr(ex as Error)
  } finally {
    qs(".loader").style.display = "none"
  }
}

async function stakeResult(argsArray: [{amount: string, msg: string, receiver_id: string}]) {
  let message = "Staked: "
  let tokensStakedMessage: string[] = []
  const poolList = await getPoolList(wallet)
  let pool: PoolParams | PoolParamsP3 | undefined
  for(let i = 0; i < poolList.length; i++) {
    if(argsArray[0].receiver_id == poolList[i].stakingContractData.contract.contractId) {
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
      const stakeTokenContractList = await pool.stakingContractData.getStakeTokenContractList()
      metadata = await stakeTokenContractList[index].contract!.ft_metadata()
    }
    if(!metadata) {
      // This if should never be true
      throw new Error("Error obtaining metadata on stake result")
    }
    const amount = convertToDecimals(args.amount, metadata.decimals, 5)
    tokensStakedMessage.push(
      `${amount} ${metadata.symbol}`
    )
  }))
  message += tokensStakedMessage.join(" - ")
  showSuccess(message, "Stake")
}

interface NFTUnstakeResult {
  nft_contract_id: string
  token: string
  token_id: string
}

async function unstakeResult(argsArray: [{amount: string, token: string}] | NFTUnstakeResult[]) {
  let message = "Unstaked: "
  if("nft_contract_id" in argsArray[0]) {
    message += `deposited cheddar and ${argsArray.length} NFTs have been refunded`
  } else if("token" in argsArray[0]){
    let tokensUnstakedMessage: string[] = []
    
    for(let i = 0; i < argsArray.length; i++) {
      const args = argsArray[i]
      let contract = new NEP141Trait(args.token)
      contract.wallet = wallet

      const metaData = await contract.ft_metadata()
      // @ts-ignore
      const amount = convertToDecimals(args.amount, metaData.decimals, 5)
      tokensUnstakedMessage.push(
        `${amount} ${metaData.symbol}`
      )
    }
    message += tokensUnstakedMessage.join(" - ")
  }
  showSuccess(message, "Unstake")
}

// NEW CODE
function toggleActions(elementToShow: HTMLElement) {
  return function (event: Event) {
    let element = event.target as HTMLElement

    element.tagName.toLowerCase() != "a" && event.preventDefault();
    
    const tagName = element.tagName.toLowerCase()
    const tagsToIgnore = ["button", "input", "span", "img", "svg", "path", "a"]

    if (!tagsToIgnore.includes(tagName) || element.classList.contains("toggle-display")) {
      elementToShow.classList.toggle("hidden")
    }    
  }
}

function flipElement(elementToFlip: HTMLElement) {
  return function (event: Event){
    let element = event.target as HTMLElement

    element.tagName.toLowerCase() != "a" && event.preventDefault();
    
    const tagName = element.tagName.toLowerCase()
    const tagsToIgnore = ["button", "input", "span", "img", "svg", "path", "polygon", "a"]

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

function makeBlinkElement(elementToMakeBlink: HTMLElement){
  return function (event: Event){
    event.preventDefault()
    elementToMakeBlink.classList.toggle("blink")
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

async function loadAndShowNfts(poolParams: PoolParamsP3|PoolParamsNFT, buttonId: string) {
  await loadNFTs(poolParams, buttonId)
  qs("#nft-pools-section").classList.remove("hidden")

  if(poolParams instanceof PoolParamsNFT) {
    let confirmStakeUnstakeNFTButton = NFTPoolSection.querySelector("#confirm-stake-unstake")
    let cancelStakeUnstakeNFTButton = NFTPoolSection.querySelector("#cancel-stake-unstake")

    confirmStakeUnstakeNFTButton!.addEventListener("click", confirmStakeUnstakeNFTButtonHandler(poolParams))
    cancelStakeUnstakeNFTButton!.addEventListener("click", quitNFTFlex())
  }

  
}


function displayCheddarNeededToStakeNFTs(stakeRate: number) {
  const nftPoolSection = qs("#nft-pools-section") as HTMLElement

  let countSelectedToStakeNfts = (nftPoolSection.querySelectorAll(".nft-card.selected.unstaked")).length as number

  const amountNeededToStakeAllNfts = nftPoolSection.querySelector(".cheddar-needed-to-stake-all-nfts") as HTMLElement
  amountNeededToStakeAllNfts.innerHTML = (countSelectedToStakeNfts * stakeRate).toString()
}

function selectAllActionNftButtons(action: string, stakeRate: number){
  return function(event: Event) {
    event.preventDefault()

    const nftPoolsSection = qs("#nft-pools-section")
    const allSelectedPreviously = nftPoolsSection.querySelectorAll(".selected")

    allSelectedPreviously.forEach(element => {
      element.classList.remove("selected")
    });

    const clickedElement = event.target! as HTMLElement
    clickedElement.classList.add("selected")

    let allNFTCardsByAction: NodeListOf<Element>

    if(action == "stake"){

      allNFTCardsByAction = nftPoolsSection.querySelectorAll(".nft-card.unstaked")

    } else {

      allNFTCardsByAction = nftPoolsSection.querySelectorAll(".nft-card.staked")
    }

    allNFTCardsByAction.forEach(card => {
      card.classList.add("selected")      
    })

    displayCheddarNeededToStakeNFTs(stakeRate)
  }
}

async function showStakeUnstakeNFTGrid(poolParams: PoolParamsNFT, buttonId: string) {
  const contractParams: NFTStakingContractParams = await poolParams.stakingContractData.getContractParams()
  // const stakeRateStr: string = contractParams.stake_rates[0]    
  const stakeRate: number = yton(contractParams.cheddar_rate)

  qs(".needed-to-stake-each-nft .amount")!.innerHTML = stakeRate.toString()

  const multipleNftSelectionButtons = qs(".multiple-nft-selection") as HTMLElement
  multipleNftSelectionButtons.classList.remove("hidden")

  const confirmButton = qs("#confirm-stake-unstake") as HTMLButtonElement
  confirmButton.classList.remove("hidden")

  const cancelButton = qs("#cancel-stake-unstake") as HTMLButtonElement
  cancelButton.classList.remove("hidden")

  const unstakeAllNftsButton = qs(".unstake-all-nft-button") as HTMLButtonElement
  unstakeAllNftsButton.addEventListener("click", selectAllActionNftButtons("unstake", stakeRate))

  const stakeAllNftsButton = qs(".stake-all-nft-button") as HTMLButtonElement
  stakeAllNftsButton.addEventListener("click", selectAllActionNftButtons("stake", stakeRate))

  displayCheddarNeededToStakeNFTs(stakeRate)

  await loadAndShowNfts(poolParams, buttonId)
}

function showNFTGrid(poolParams: PoolParamsP3|PoolParamsNFT, buttonId: string) {
  return async function () {
    loadAndShowNfts(poolParams,buttonId)
  }
}

async function loadNFTs(poolParams: PoolParamsP3|PoolParamsNFT, buttonId: string) {
  const NFTContainer = qs(".nft-flex") as HTMLElement
  NFTContainer.innerHTML = ""
  
  const accountId = poolParams.wallet.getAccountId()
  let nftContract: NFTContract
  let stakedOrBoostingNFTsToAdd: NFTWithMetadata[] = []
  //Use conditional to check if the pressed button was boost or stake/unstake so the correct nft are loaded
  let userUnstakedNFTsWithMetadata: NFTWithMetadata[] = []
  let userStatus: PoolUserStatusP3|PoolUserStatusP3NFT = await poolParams.stakingContractData.getUserStatus()
  let poolHasStaked: boolean = false
  if(buttonId === "boost-button"){
    nftContract = poolParams.nftContractForBoosting
    const userUnstakedNFTs: NFT[] = await nftContract.nft_tokens_for_owner(accountId)
    const mapped: NFTWithMetadata[] = userUnstakedNFTs.map((nft: NFT) => {
      return {
        ...nft,
        contract_id: nftContract.contractId,
        base_url: nftContract.baseUrl
      }
    })
    console.log(1, mapped.length)
    userUnstakedNFTsWithMetadata = userUnstakedNFTsWithMetadata.concat(mapped)
    let tokenId: string
    if("boost_nfts" in userStatus) {
      poolHasStaked = userStatus.boost_nfts != ''
      tokenId = userStatus.boost_nfts
    } else {
      poolHasStaked = userStatus.cheddy_nft != ''
      tokenId = userStatus.cheddy_nft
    }
    // poolHasStaked = userStatus.cheddy_nft != '' || userStatus.boost_nfts != ''
    if(poolHasStaked) stakedOrBoostingNFTsToAdd.push(newNFT(tokenId, nftContract.baseUrl, nftContract.contractId))
    
  } else if (buttonId === "stake-unstake-nft" && poolParams instanceof PoolParamsNFT) {
    const nftContractList = await poolParams.stakingContractData.getStakeNFTContractList()
    for(let i = 0; i < nftContractList.length; i++) {
      const contract = nftContractList[i].contract
      const nftMetadata: Promise<NFTMetadata> = contract.nft_metadata()
      const userUnstakedNFTs: NFT[] = await contract.nft_tokens_for_owner(accountId)
      let baseUrl = (await nftMetadata).base_uri
      if(!baseUrl) baseUrl = contract.baseUrl
      userUnstakedNFTsWithMetadata = userUnstakedNFTsWithMetadata.concat(userUnstakedNFTs.map((nft: NFT) => {
        return {
          ...nft,
          contract_id: contract.contractId,
          base_url: baseUrl
        }
      }))
      
    }
    poolHasStaked = userStatus.stake_tokens.some(a => a.length > 0)
    for(let index = 0; index < userStatus.stake_tokens.length; index++) {
      const contract: NFTContract = nftContractList[index].contract
      let contractTokens = userStatus.stake_tokens[index]

      let thisUserStakedNFTsPromises: Promise<NFT>[] = []
      for(let tokenId of contractTokens) {
        thisUserStakedNFTsPromises.push(contract.nft_token(tokenId))
      }
      const thisUserStakedNFTs: NFT[] = await Promise.all(thisUserStakedNFTsPromises)
      thisUserStakedNFTs.forEach(nft => {
        stakedOrBoostingNFTsToAdd.push({
          ...nft,
          contract_id: contract.contractId,
          base_url: contract.baseUrl
        })
      })

    }
  } else {
    throw new Error(`Object ${typeof poolParams} is not implemented for loading NFT's`)
  }
  
  if(userUnstakedNFTsWithMetadata.length == 0 && !poolHasStaked) {
    let tokenName = ""
    if(poolParams instanceof PoolParamsP3) {
      tokenName = "cheddar"
    } else {
      const nftContractList = await poolParams.stakingContractData.getStakeNFTContractList()
      // It will be assumed there is only one NFT for staking
      const nftContractMetadata = await nftContractList[0].getMetadata()
      tokenName = nftContractMetadata.name.toLowerCase()
    }   
    NFTContainer.innerHTML = `You don't have any ${tokenName} NFT`
    return
  }
  if(stakedOrBoostingNFTsToAdd.length > 0) {
    stakedOrBoostingNFTsToAdd.forEach((nft: NFTWithMetadata) => {
      addNFT(poolParams, NFTContainer, nft, poolHasStaked, "", buttonId, "", true)
    })
    
  }
  userUnstakedNFTsWithMetadata.forEach(nft => {
    console.log(4, nft)
    addNFT(poolParams, NFTContainer, nft, poolHasStaked, "", buttonId, "", false)
  });
}


function checkIfMultipleSelectionButtonsMustBeSelected() {
  const nftPoolsSection = document.querySelector("#nft-pools-section") as HTMLElement

  let unstakedAmount = nftPoolsSection.querySelectorAll(".unstaked").length
  let stakedAmount = nftPoolsSection.querySelectorAll(".staked").length

  let unstakedSelectedAmount = nftPoolsSection.querySelectorAll(".unstaked.selected").length
  let stakedSelectedAmount = nftPoolsSection.querySelectorAll(".staked.selected").length
  
  let stakeAllButton = qs(".stake-all-nft-button") as HTMLElement
  
  if(unstakedAmount == unstakedSelectedAmount && unstakedAmount != 0) {
    stakeAllButton.classList.add("selected")
  } else {
    stakeAllButton.classList.remove("selected")
  }

  let unstakeAllButton = qs(".unstake-all-nft-button") as HTMLElement

  if(stakedAmount == stakedSelectedAmount && stakedAmount != 0) {
    unstakeAllButton.classList.add("selected")
  } else {
    unstakeAllButton.classList.remove("selected")
  }
}

function stakeAndUstakeNFTButtonHandler (newNFTCard: HTMLElement, stakeRate: number) {
  return function () {    
    newNFTCard.classList.toggle("selected")

    checkIfMultipleSelectionButtonsMustBeSelected()

    displayCheddarNeededToStakeNFTs(stakeRate)
  }
}

function confirmStakeUnstakeNFTButtonHandler(poolParams: PoolParamsNFT) {
  return async function (event: Event) {
    event.preventDefault()
    let isAnyNFTSelected = qsa(".nft-flex .selected").length > 0
    if(!isAnyNFTSelected) {
      showError("Select NFT's to stake or unstake")
      return
    }
    try {

      const contractParams = await poolParams.stakingContractData.getContractParams()
      //If used don´t have enough cheddar to stake all the selected NFTs show error msg and return
      let cheddarBalanceContainer = document.querySelector(".cheddar-balance") as HTMLElement
      let cheddarBalance = parseInt(cheddarBalanceContainer.innerHTML) as number

      let cheddarNeededToStakeNFTsContainer = document.querySelector(".cheddar-needed-to-stake-all-nfts") as HTMLElement
      let cheddarNeededToStakeNFTs = parseInt(cheddarNeededToStakeNFTsContainer.innerHTML) as number

      if(cheddarBalance < cheddarNeededToStakeNFTs) {
        showError("Not enough cheddar to stake selected NFTs")
      }

      const stakeUnstakeNFTsMap = await getNFTsToStakeAndUnstake(poolParams)
      const haveNftsToStake = Array.from(stakeUnstakeNFTsMap.values()).some((entry: NFTStakeUnstakeData) => entry.nftsToStake.length > 0)
      
      let unixTimestamp = new Date().getTime() / 1000; 
      const isDateInRange = unixTimestamp < contractParams.farming_end
      if (!isDateInRange && haveNftsToStake) throw Error("Pools is Closed.")

      poolParams.stakeUnstakeNFTs(stakeUnstakeNFTsMap)
      
    } catch(err) {
      showErr(err as Error)
    }
    
  }
}

export interface NFTStakeUnstakeData {
  nftsToStake: string[]
  nftsToUnstake: string[]
}

async function getNFTsToStakeAndUnstake(poolParams: PoolParamsNFT): Promise<Map<string, NFTStakeUnstakeData>> {
  // let nftsToStake = [] as string[]
  // let nftsToUnstake = [] as string[]
  const stakeNFTContractList: NFTContractData[] = await poolParams.stakingContractData.getStakeNFTContractList()
  let output: Map<string, NFTStakeUnstakeData> = new Map<string, NFTStakeUnstakeData>()
  stakeNFTContractList.forEach((nftContractData: NFTContractData) => {
    const contractId: string = nftContractData.contract.contractId
    output.set(contractId, {
        nftsToStake: [],
        nftsToUnstake: []
      }
    )
  })

  let allSelectedNfts = NFTPoolSection.querySelectorAll(".nft-card.selected")
  allSelectedNfts.forEach(nft => {
    let nftNameContainer = nft.querySelector(".nft-name") as HTMLElement
    let nftName = nftNameContainer!.innerHTML

    let thisNFTStakeButton = nft.querySelector(".stake-nft-button")
    let contractId: string = nft.getAttribute("contract_id")!
    let contractStakeUnstakeData: NFTStakeUnstakeData = output.get(contractId)!

    // TODO: For some reason, this function is being called multiple times on confirm, and on some run this object is undefined
    // The next line is set to avoid an error message, but it should be reviewed why this is happening.
    // There is also some react involved for some reason. It is uncertained wheter it is called from NEAR, since this project
    // doesn't have any react code involved, and it doesn't seem to be malicious
    if(!contractStakeUnstakeData) return
    //If the stake button is hidden the pool needs to be unstaked
    //If not it needs to be staked
    if(thisNFTStakeButton?.classList.contains("hidden")) {
      contractStakeUnstakeData.nftsToUnstake.push(nftName)
    } else {
      contractStakeUnstakeData.nftsToStake.push(nftName)
    }
  });
  return output
}

function displayNFTPoolSectionForStakeUnstakeNFT(newNFTCard: HTMLElement, stakeButton: HTMLElement, unstakeButton: HTMLElement, stakeRate: number) {

  const NFTStakeTitle = NFTPoolSection.querySelector(".stake-nfts-title") as HTMLElement
  const cheddarBalanceContainer = NFTPoolSection.querySelector(".cheddar-balance-container") as HTMLElement

  NFTStakeTitle.classList.remove("hidden")
  cheddarBalanceContainer.classList.remove("hidden")

  stakeButton.addEventListener("click", stakeAndUstakeNFTButtonHandler(newNFTCard, stakeRate))
  unstakeButton.addEventListener("click", stakeAndUstakeNFTButtonHandler(newNFTCard, stakeRate))
}

function displayNFTPoolSectionForNFTBoost(poolParams: PoolParamsP3|PoolParamsNFT, poolHasStaked: boolean, staked:boolean, newNFTCard: HTMLElement,i: number, stakeButton: HTMLElement, unstakeButton: HTMLElement) {

  const NFTPoolSectionInfoRow = NFTPoolSection.querySelector(".nft-farm-info") as HTMLElement

  //Only if user have more than 1 NFT the legend "You can only boost one NFT is shown"
  if (i > 1) {
    NFTPoolSectionInfoRow.classList.remove("hidden")
  }

  stakeButton?.addEventListener("click", stakeNFT(poolParams, newNFTCard))
  if(staked){
    unstakeButton!.addEventListener("click", unstakeNFT(poolParams, newNFTCard))
  }

  if(poolHasStaked) {
    stakeButton!.setAttribute("disabled", "disabled")
  } else {
    stakeButton!.removeAttribute("disabled")
  }
}

async function addNFT(poolParams: PoolParamsP3|PoolParamsNFT, container: HTMLElement, nft: NFTWithMetadata, poolHasStaked: boolean, nftBaseUrl: string, buttonId: string, contractId: string, staked: boolean = false) {
  const genericNFTCard = qs(".generic-nft-card")
  const newNFTCard = genericNFTCard.cloneNode(true) as HTMLElement
  
  newNFTCard.setAttribute("contract_id", nft.contract_id)

  let i = 0
  const nftName: string = nft.token_id.indexOf("@") != -1 ? nft.token_id.split("@")[1] : nft.token_id
  for (; i < newNFTCard.querySelectorAll(".nft-name").length; i++){
    newNFTCard.querySelectorAll(".nft-name")[i].innerHTML = nftName
  }

  const NFTPoolSectionInfoRow = NFTPoolSection.querySelector(".nft-farm-info") as HTMLElement

  NFTPoolSectionInfoRow.classList.add("hidden")

  let imgElement = newNFTCard.querySelector(".nft-img-container img")
  // imgElement?.setAttribute("src", new URL(nft.metadata.media, nftBaseUrl).href)
  
  const nftMedia: string = nft.metadata.media.indexOf("@") != -1 ? nft.metadata.media.split("@")[1] : nft.metadata.media
  let src
  console.log(3, nftMedia, nft.base_url)
  if(nftMedia.startsWith("https://")) {
    src = nftMedia
  } else {
    src = nft.base_url + "/" + nftMedia
  }
  imgElement?.setAttribute("src", src)
  imgElement!.setAttribute("alt", nft.metadata.media)

  
  let stakeButton = newNFTCard.querySelector(".stake-nft-button") as HTMLElement
  let unstakeButton = newNFTCard.querySelector(".unstake-nft-button") as HTMLElement
  if(staked) {
    unstakeButton!.classList.remove("hidden")    
    stakeButton!.classList.add("hidden")

    if(buttonId == "stake-unstake-nft"){
      newNFTCard.classList.add("staked") 
      newNFTCard.classList.remove("unstaked")
    }
    
  } else {
    unstakeButton!.classList.add("hidden")    
    stakeButton!.classList.remove("hidden")

    if(buttonId == "stake-unstake-nft"){
      newNFTCard.classList.add("unstaked")
      newNFTCard.classList.remove("staked")
    }
  }
  
  
  if(buttonId === "boost-button") {
    displayNFTPoolSectionForNFTBoost(poolParams, poolHasStaked, staked, newNFTCard, i, stakeButton, unstakeButton)
  } else if(buttonId === "stake-unstake-nft" && poolParams instanceof PoolParamsNFT){
    const contractParams = await poolParams.stakingContractData.getContractParams()
    const stakeRate = yton(contractParams.cheddar_rate)
    displayNFTPoolSectionForStakeUnstakeNFT(newNFTCard, stakeButton, unstakeButton, stakeRate)
  }

  container.append(newNFTCard)    
  toggleGenericClass(newNFTCard)
}

function stakeNFT(poolParams: PoolParamsP3|PoolParamsNFT, card: HTMLElement){
  return async function(event: Event) {
    try {
      event.preventDefault()
      showWait("Staking NFT...")
      
      const tokenId = card.querySelector(".nft-name")!.innerHTML
      await poolParams.nftContractForBoosting.nft_transfer_call(poolParams.stakingContractData.contract.contractId, tokenId)
      showSuccess("NFT staked successfully")
      
      let allNFTCards = qsa(".nft-card")
      allNFTCards.forEach(NFTCard => {
        NFTCard.querySelector(".stake-nft-button")!.setAttribute("disabled", "disabled")
      });

      card.querySelector(".stake-nft-button")!.classList.add("hidden")

      let unstakeButton = card.querySelector(".unstake-nft-button")!
      unstakeButton.removeAttribute("disabled")
      unstakeButton.addEventListener("click", unstakeNFT(poolParams, card))
    } catch(err) {
      showErr(err as Error)
    }
  }
}

function unstakeNFT(poolParams: PoolParamsP3|PoolParamsNFT, card: HTMLElement) {
  return async function (event: Event) {
    try {
      event.preventDefault()
      showWait("Unstaking NFT...")

      if(poolParams instanceof PoolParamsP3) {
        await poolParams.stakingContractData.contract.withdraw_nft(poolParams.wallet.getAccountId())
      } else if(poolParams instanceof PoolParamsNFT) {
        await poolParams.withdrawBoost()
      }
      showSuccess("NFT unstaked successfully")
      card.querySelector(".unstake-nft-button")!.classList.add("hidden")

      qsa(".stake-nft-button").forEach(elem => {
        elem.removeAttribute("disabled")
        elem.classList.remove("hidden")
    })
      // let stakeButton = card.querySelector(".stake-nft-button")!
      // stakeButton.removeAttribute("disabled")
      // stakeButton.addEventListener("click", stakeNFT(poolParams, card))
    } catch(err) {
      showErr(err as Error)
    }
    

  }
}

function hideNFTFlexComponents() {
  const hideNFTFlexComponents = NFTPoolSection.querySelectorAll(".hiddenByDefault") as NodeListOf<Element>

  for(let i = 0; i < hideNFTFlexComponents.length; i++){
    hideNFTFlexComponents[i].classList.add("hidden")
  }
}

function showNFTFlexComponents() {
  const showNFTFlexComponents = NFTPoolSection.querySelectorAll(".shownUnselectedByDefault") as NodeListOf<Element>
      
  for(let i = 0; i < showNFTFlexComponents.length; i++){
    showNFTFlexComponents[i].classList.remove("selected")
  }
}

function quitNFTFlex() {  
  return function (event: Event){
    event.preventDefault();
    
    let element = event.target as HTMLElement
    
    if (element.getAttribute("id") == "nft-pools-section" || element.getAttribute("id") == "cancel-stake-unstake") {
      qs(".nft-flex").innerHTML = ""
      qs("#nft-pools-section").classList.add("hidden")

      hideNFTFlexComponents()
      showNFTFlexComponents()
    }
  }
}

const NFTPoolSection = qs("#nft-pools-section") as HTMLElement 
NFTPoolSection.addEventListener("click", quitNFTFlex())

//Burger button
const burgerTogglers = qsa(".toggleBurguer") as NodeListOf<HTMLElement>
burgerTogglers.forEach(toggler => {
  toggler.addEventListener('click', () => {
    toggleBurgerNav();
  });
});

const toggleBurgerNav = () => {
  const burgerButton = qs(".burger-button") as HTMLElement
  const rightNav = qs('.burguer-content') as HTMLElement

  rightNav.classList.toggle('show-right__nav')
  burgerButton.classList.toggle('burger-button--toggle')
};
