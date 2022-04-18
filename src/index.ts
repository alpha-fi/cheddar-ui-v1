import { baseDecode } from 'borsh';
import BN from 'bn.js';
import { connect, Contract, keyStores, Near, WalletConnection, ConnectedWalletAccount, RequestSignTransactionsOptions, utils } from 'near-api-js'
import { Action, createTransaction, functionCall } from 'near-api-js/lib/transaction';
import { PublicKey } from 'near-api-js/lib/utils'

import { ENV, CHEDDAR_CONTRACT_NAME, TESTNET_CHEDDAR_CONTRACT_NAME, getConfig } from './config'

import { WalletInterface } from './wallet-api/wallet-interface';
import { disconnectedWallet } from './wallet-api/disconnected-wallet';
import { NearWebWallet } from './wallet-api/near-web-wallet/near-web-wallet';
import { narwallets, addNarwalletsListeners } from './wallet-api/narwallets/narwallets';
import { toNumber, ntoy, yton, ytonLong, toStringDec, toStringDecSimple, toStringDecLong, toStringDecMin, ytonFull, addCommas, convertToDecimals, removeDecZeroes, convertToBase } from './util/conversions';

import { StakingPoolP1 } from './contracts/p2-staking';
import { ContractParams, TokenParams } from './contracts/contract-structs';

//qs/qsa are shortcut for document.querySelector/All
import { qs, qsa, qsi, showWait, hideWaitKeepOverlay, showErr, showSuccess, showMessage, show, hide, hidePopup, hideOverlay, qsaInnerText, showError, showPopup, qsInnerText } from './util/document';
import { checkRedirectSearchParams } from './wallet-api/near-web-wallet/checkRedirectSearchParams';
import { computeCurrentEpoch, EpochInfo } from './util/near-epoch';
import { NEP141Trait } from './contracts/NEP141';
import { InvalidSignature } from 'near-api-js/lib/generated/rpc_error_types';
import { PoolParams } from './entities/poolParams';
import { getPoolList } from './entities/poolList';
import { stake } from 'near-api-js/lib/transaction';
import { PoolParamsP3 } from './entities/poolParamsP3';
import { P3ContractParams } from './contracts/p3-structures';

//get global config
//const nearConfig = getConfig(process.env.NODE_ENV || 'testnet')
export let nearConfig = getConfig(ENV); //default testnet, can change according to URL on window.onload

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

// //Only Staked old
//   async function (event) {

//     if (window.localStorage.getItem("onlyStaked")) {
//       isPaused = true;
//       window.localStorage.onlyStaked = event.target.checked
//       //console.log(window.localStorage.getItem("onlyStaked"))
//       const poolList = await getPoolList(wallet);
//       //await refreshAccountInfoGeneric(poolList);
//       qs("#pool_list").replaceChildren();
//       qs("#pool_list").style.display = "none";
//       qs(".loader").style.display = "block";
//       await addPoolList(poolList);

//     }
//     else {
//       isPaused = true;
//       window.localStorage.setItem("onlyStaked", event.target.checked)
//       //console.log(window.localStorage.getItem("onlyStaked"))
//       const poolList = await getPoolList(wallet);
//       //await refreshAccountInfoGeneric(poolList);
//       qs("#pool_list").replaceChildren();
//       qs("#pool_list").style.display = "none";
//       qs(".loader").style.display = "block";
//       await addPoolList(poolList);

//     }
//   }

function stakeClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function (event: Event) {
    event.preventDefault()

    submitForm("stake", poolParams, pool.getElementsByTagName("form")[0])
  }
}

function unstakeClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function (event: Event) {
    event.preventDefault()

    submitForm("unstake", poolParams, pool.getElementsByTagName("form")[0])
  }
}

function harvestClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function (event: Event) {
    event.preventDefault()
    //console.log("PoolParmas: ", poolParams)
    submitForm("harvest", poolParams, pool.getElementsByTagName("form")[0])
  }
}

function depositClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function (event) {
    event.preventDefault()

    if (poolParams.html.formId == 'nearcon') {
      let storageDeposit = await poolParams.tokenContract.storageDeposit();
    }
    else {
      let storageDeposit = await poolParams.contract.storageDeposit();
    }

    pool.querySelector("#deposit")!.style.display = "block"
    pool.querySelector("#activated")!.style.display = "none"
  }
}

function stakeSingle(poolParams: PoolParams, newPool: HTMLElement) {
  return async function (event: Event){
    event?.preventDefault()
    showWait("Staking...")
    
    let stakeInput = newPool.querySelector(".main-staking input") as HTMLInputElement
    

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

      
      // console.log(poolParams.metaData.decimals.toString())
      //if (amount < min_deposit_amount) throw Error(`Stake at least ${min_deposit_amount} ${poolParams.metaData.symbol}`);
      const walletAvailable = await poolParams.getWalletAvailable()
      if (stakeAmount > walletAvailable) throw Error(`Only ${walletAvailable} ${poolParams.metaData.symbol} Available to Stake.`);
      await poolParams.tokenContract.ft_transfer_call(poolParams.contract.contractId, convertToBase(stakeAmount.toString(), poolParams.metaData.decimals.toString()), "to farm")
      

      //clear form
      stakeInput.value = ""

      //refresh acc info
      // const poolList = await getPoolList(wallet);


      //TODO refactor refreshPoolInfo
      // await refreshPoolInfo(poolParams)
      //console.log("Amount: ", amount)
      showSuccess("Staked " + toStringDecMin(stakeAmount) + poolParams.metaData.symbol)

      poolParams.resultParams.addStaked(ntoy(stakeAmount))
    }
    catch (ex) {
      showErr(ex as Error)
    }

    // re-enable the form, whether the call succeeded or failed
    stakeInput.removeAttribute("disabled")
  }
}

function harvestSingle (poolParams: PoolParams, newPool: HTMLElement){
  return async function (event: Event) {
    event?.preventDefault()
    showWait("Harvesting...")
    

    let amount: number
    amount = poolParams.resultParams.getCurrentCheddarRewards()

    await poolParams.contract.withdraw_crop()

    poolParams.resultParams.computed = 0n
    poolParams.resultParams.real = 0n
    newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = "0"

    showSuccess("Harvested" + toStringDecMin(amount) + " CHEDDAR")
  }
}

function unstakeSingle(poolParams: PoolParams, newPool: HTMLElement){
  return async function (event: Event){
    event?.preventDefault()
    showWait("Unstaking...")

    let unstakeInput = newPool.querySelector(".main-unstaking input") as HTMLInputElement

    try {
      let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
      const contractParams = poolParams.contractParams
      // const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
      // if (!isDateInRange) throw Error("Pools is Closed.")
      
      unstakeInput.setAttribute("disabled", "disabled")
      let unstakeAmount = parseFloat(unstakeInput.value)
      const staked = poolParams.resultParams.staked
      const stakedDisplayable = Number(convertToDecimals(staked.toString(), poolParams.metaData.decimals, 5))
      //get amount
      const min_deposit_amount = 1;//DUDA esto al final nunca lo llamamos. Xq no me hiciste borrarlo?
      if (isNaN(unstakeAmount)) {
        throw Error("Please Input a Number.")
      }

      
      //if (amount < min_deposit_amount) throw Error(`Stake at least ${min_deposit_amount} ${poolParams.metaData.symbol}`);
      if (unstakeAmount > stakedDisplayable) throw Error(`Only ${stakedDisplayable} ${poolParams.metaData.symbol} Available to Unstake.`);
      await poolParams.contract.unstake(convertToBase(unstakeAmount.toString(), poolParams.metaData.decimals.toString()))
      

      //clear form
      unstakeInput.value = ""

      //refresh acc info
      // const poolList = await getPoolList(wallet);
      await refreshPoolInfo(poolParams)
      //console.log("Amount: ", amount)
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

//Form submission
async function submitForm(action: string, poolParams: PoolParams, form: HTMLFormElement) {
  event?.preventDefault()
  
  //const form = event.target as HTMLFormElement
  // get elements from the form using their id attribute
  const { fieldset, stakeAmount1 } = form
  //console.log("Stake amount: " , stakeAmount1)
  //const fieldset = form.querySelector("#fieldset") as HTMLFormElement

  // disable the form while the call is made
  fieldset.disabled = true
  const isStaking = (action == "stake")
  const isHarvest = (action == "harvest")
  showWait(isStaking ? "Staking..." : isHarvest ? "Harvesting..." : "Unstaking...")

  try {
    const contractParams = poolParams.contractParams
    let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
    const isDateInRange = (contractParams.farming_start < unixTimestamp || contractParams.farming_start > unixTimestamp) && unixTimestamp < contractParams.farming_end
    //get amount
    const min_deposit_amount = 1;
    if (isNaN(stakeAmount1.value)) {
      throw Error("Please Input a Number.")
    }
    let amount: number = stakeAmount1.value;

    if (isStaking) {
      if (!isDateInRange) throw Error("Pools is Closed.")
      //if (amount < min_deposit_amount) throw Error(`Stake at least ${min_deposit_amount} ${poolParams.metaData.symbol}`);
      const walletAvailable = await poolParams.getWalletAvailable()
      if (amount > walletAvailable) throw Error(`Only ${walletAvailable} ${poolParams.metaData.symbol} Available to Stake.`);
      await poolParams.tokenContract.ft_transfer_call(poolParams.contract.contractId, convertToBase(stakeAmount1.value, poolParams.metaData.decimals.toString()), "to farm")
    }
    else if (isHarvest) {

      amount = poolParams.resultParams.getCurrentCheddarRewards()
      //if (BigInt(convertToBase(amount.toString(), poolParams.metaData.decimals.toString())) <= BigInt(0)) throw Error("No Cheddar to Harvest. 😞")
      await poolParams.contract.withdraw_crop()
    }
    else {
      //console.log(amount.toString())
      //console.log("Decimal: ", poolParams.metaData.decimals)
      if (amount <= 0) throw Error(`Unstake a Positive Amount.`);
      const staked = poolParams.resultParams.staked
      const stakedDisplayable = Number(convertToDecimals(staked.toString(), poolParams.metaData.decimals, 5))
      //if(amount > stakedDisplayable) throw Error(`Stake at most ${stakedDisplayable} ${poolParams.metaData.symbol}`);
      if (amount > stakedDisplayable) throw Error(`No ${poolParams.metaData.symbol} Staked.`);
      // amount = 1000000000000000000000000
      await poolParams.contract.unstake(convertToBase(amount.toString(), poolParams.metaData.decimals.toString()))
    }

    //clear form
    form.reset()

    //refresh acc info
    // const poolList = await getPoolList(wallet);
    await refreshPoolInfo(poolParams)
    //console.log("Amount: ", amount)
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

//Form submission
// async function submitForm(action: string, poolParams: PoolParams|PoolParamsP3, form: HTMLFormElement) {
//   event?.preventDefault()

//   const ONE_YOCTO_NEAR = '0.000000000000000000000001';

//   //const form = event.target as HTMLFormElement
//   // get elements from the form using their id attribute
//   const { fieldset, stakeAmount1, stakeAmount2 } = form
//   //console.log("Stake amount: " , stakeAmount1)
//   //const fieldset = form.querySelector("#fieldset") as HTMLFormElement

//   // disable the form while the call is made
//   fieldset.disabled = true
//   const isStaking = (action == "stake")
//   const isHarvest = (action == "harvest")
//   showWait(isStaking ? "Staking..." : isHarvest ? "Harvesting..." : "Unstaking...")

//   try {
//     const contractParams = poolParams.contractParams
//     let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
//     const isDateInRange = (contractParams.farming_start < unixTimestamp || contractParams.farming_start > unixTimestamp) && unixTimestamp < contractParams.farming_end
//     //get amount
//     const min_deposit_amount = 1;

//     /** TODO - make dynamic **/
//     let amount1: number = stakeAmount1.value;
//     let amount2: number = stakeAmount2.value;

//     /** TODO - make dynamic **/
//     let stakedSymbols = [poolParams.metaData, poolParams.metaData2]

//     const walletBalances = await poolParams.getWalletAvailable()

//     if (isStaking) {

//       if (!isDateInRange) throw Error("Pools is Closed.")

//       if(walletBalances) {

//         if(Array.isArray(walletBalances)){

//           // if(isNaN(parseFloat(amount1))) {
//           //   throw Error("Please Input a Number.")
//           // } else if(poolParams.type == "multiple" && isNaN(parseFloat(amount2))) {
//           //   throw Error("Please Input a Number.")
//           // }

//           //**TODO - Make Dynamic **/
//           if(amount1 > walletBalances[0]) throw Error(`Only ${walletBalances[0]} ${stakedSymbols[0].symbol} Available to Stake.`)
//           if(amount2 > walletBalances[1]) throw Error(`Only ${walletBalances[1]} ${stakedSymbols[1].symbol} Available to Stake.`)


//           /** TODO - make dynamic **/
//           if(!isNaN(parseFloat(amount1.toString())) && !isNaN(parseFloat(amount2.toString()))) {

//             const transactions: Transaction[] = [];

//             transactions.unshift({
//               receiverId: poolParams.cheddarContract.contractId,
//               functionCalls: [
//                 {
//                   methodName: 'ft_transfer_call',
//                   args: {
//                     receiver_id: poolParams.contract.contractId,
//                     amount: convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()),
//                     msg: 'to farm',
//                   },
//                   amount: new BN(utils.format.parseNearAmount('0.000000000000000000000001')),
//                   gas: new BN('100000000000000'),
//                 },
//               ],
//             });

//             transactions.unshift({
//                 receiverId: poolParams.tokenContract.contractId,
//                 functionCalls: [
//                   {
//                     methodName: 'ft_transfer_call',
//                     args: {
//                       receiver_id: poolParams.contract.contractId,
//                       amount: convertToBase(amount2.toString(), poolParams.metaData2.decimals.toString()),
//                       msg: 'to farm',
//                     },
//                     amount: new BN(utils.format.parseNearAmount('0.000000000000000000000001')),
//                     gas: new BN('100000000000000'),
//                   },
//                 ],
//             });

//             const currentTransactions = await Promise.all(
//               transactions.map((t, i) => {
//                 return setupTransaction({
//                     receiverId: t.receiverId,
//                     nonceOffset: i + 1,
//                     actions: t.functionCalls.map((fc) =>
//                       functionCall(
//                         fc.methodName,
//                         fc.args,
//                         fc.gas,
//                         fc.amount
//                       )
//                     ),
//                   });
//                 })
//               );

//             requestSignTransOptions = currentTransactions

//             nearWebWalletConnection.requestSignTransactions(requestSignTransOptions);

//           } else {

//             /** TODO - make dynamic **/
//             if(!isNaN(parseFloat(amount1.toString()))) {

//               if(isNaN(parseFloat(amount1.toString())))
//                 throw Error("Please Input a Number.")

//               await poolParams.tokenContract.ft_transfer_call(poolParams.contract.contractId,convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()), "to farm")

//             } else if(!isNaN(parseFloat(amount2.toString()))) {

//               if(isNaN(parseFloat(amount2.toString())))
//               throw Error("Please Input a Number.")

//               await poolParams.cheddarContract.ft_transfer_call(poolParams.contract.contractId,convertToBase(amount2.toString(), poolParams.metaData2.decimals.toString()), "to farm")

//             }
//           }

//         } else {

//         const stakedDisplayable = Number(convertToDecimals(poolParams.contractParams.total_staked , poolParams.metaData.decimals, 5))

//         if(isNaN(parseFloat(amount1.toString()))) throw Error("Please Input a Number.")

//         if(amount1 > stakedDisplayable) throw Error(`Unstake at most ${stakedDisplayable} ${poolParams.metaData.symbol}`);

//         // amount = 1000000000000000000000000
//         await poolParams.contract.unstake(convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()))
//         }
//       }

//     } else if (isHarvest) {

//       amount = poolParams.resultParams.getCurrentCheddarRewards()
//       //if (BigInt(convertToBase(amount1.toString(), poolParams.metaData.decimals.toString())) <= BigInt(0)) throw Error("No Cheddar to Harvest. 😞")
//       await poolParams.contract.withdraw_crop()

//     } else /** UNSTAKING **/ {

//       const staked = poolParams.resultParams.staked

//       /** TODO - make dynamic **/
//       if(Array.isArray(staked)){

//         /** TODO - make dynamic **/
//         if(amount1 > staked[0]) throw Error(`Only ${staked[0]} ${stakedSymbols[0].symbol} Available to UnStake.`)
//         if(amount2 > staked[1]) throw Error(`Only ${staked[1]} ${stakedSymbols[1].symbol} Available to UnStake.`)

//         /** TODO - make dynamic **/
//         if(!isNaN(parseFloat(amount1)) && !isNaN(parseFloat(amount2))) {

//           const transactions: Transaction[] = [];

//           transactions.unshift({
//             receiverId: poolParams.contract.contractId,
//             functionCalls: [
//               {
//                 methodName: 'unstake',
//                 args: {
//                   token: poolParams.tokenContract.contractId,
//                   amount: convertToBase(amount1, poolParams.metaData.decimals.toString()),
//                   msg: 'unstake from farm',
//                 },
//                 amount: new BN(utils.format.parseNearAmount('0.000000000000000000000001')),
//                 gas: new BN('100000000000000'),
//               },
//             ],
//           });

//           transactions.unshift({
//               receiverId: poolParams.contract.contractId,
//               functionCalls: [
//                 {
//                   methodName: 'unstake',
//                   args: {
//                     token: poolParams.cheddarContract.contractId,
//                     amount: convertToBase(amount2, poolParams.metaData2.decimals.toString()),
//                     msg: 'unstake from farm',
//                   },
//                   amount: new BN(utils.format.parseNearAmount('0.000000000000000000000001')),
//                   gas: new BN('100000000000000'),
//                 },
//               ],
//           });

//           const currentTransactions = await Promise.all(
//             transactions.map((t, i) => {
//               return setupTransaction({
//                   receiverId: t.receiverId,
//                   nonceOffset: i + 1,
//                   actions: t.functionCalls.map((fc) =>
//                     functionCall(
//                       fc.methodName,
//                       fc.args,
//                       fc.gas,
//                       fc.amount
//                     )
//                   ),
//                 });
//               })
//             );

//           requestSignTransOptions = currentTransactions

//           nearWebWalletConnection.requestSignTransactions(requestSignTransOptions);

//         } else {

//           /** TODO - make dynamic **/
//           if(!isNaN(parseFloat(amount1))) {

//             if(isNaN(parseFloat(amount1))) throw Error("Please Input a Number.")

//             await poolParams.contract.unstake(poolParams.tokenContract.contractId, convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()))

//           } else if(!isNaN(parseFloat(amount2))) {

//             if(isNaN(parseFloat(amount2))) throw Error("Please Input a Number.")

//             await poolParams.contract.unstake(poolParams.cheddarContract.contractId, convertToBase(amount2.toString(), poolParams.metaData2.decimals.toString()))
//           }
//         }

//       } else {
//         const stakedDisplayable = Number(convertToDecimals(staked.toString(), poolParams.metaData.decimals, 5))

//         //if(amount > stakedDisplayable) throw Error(`Stake at most ${stakedDisplayable} ${poolParams.metaData.symbol}`);

//         if(amount1 > stakedDisplayable) throw Error(`No ${poolParams.metaData.symbol} Staked.`);

//         if(isNaN(parseFloat(amount1)))
//                 throw Error("Please Input a Number.")

//         // amount = 1000000000000000000000000
//         await poolParams.contract.unstake(convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()))

//       }

//     }

//     //clear form
//     form.reset()

//     //refresh acc info
//     await refreshPoolInfo(poolParams)

//     //**TODO - Make Dynamic **/
//     showSuccess((isStaking ? "Staked " : isHarvest ? "Harvested " : "Unstaked ") + toStringDecMin(amount1) + (isHarvest ? " CHEDDAR" : " " + poolParams.metaData.symbol))

//     if (isHarvest) {
//       poolParams.resultParams.computed = 1n
//       poolParams.resultParams.real = 1n
//       qsInnerText("#" + poolParams.html.id + " #cheddar-balance", "0")

//     }
//     else if (isStaking) {
//       poolParams.resultParams.addStaked(ntoy(amount1));
//     }
//     else {
//       poolParams.resultParams.addStaked(ntoy(-amount1));
//     }

//   }
//   catch (ex) {
//     showErr(ex)
//   }

//   // re-enable the form, whether the call succeeded or failed
//   fieldset.disabled = false
// }

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
  await refreshAccountInfoGeneric(poolList)
  await addPoolList(poolList)
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

  let circulatingSupply = await poolParams.cheddarContract.ft_total_supply()
  document.querySelector("#circulatingSupply span")!.innerHTML = "Circulating Supply:&nbsp;" + toStringDec(yton(circulatingSupply)).split('.')[0];

  try {

    if (isOpened && wallet.isConnected()) {

      let accountInfo = await poolParams.contract.status(accName)
      poolParams.setStatus(accountInfo)

      if (poolParams.type == "multiple") {

        qsa(".pool-meta.staked").forEach((element, index) => {
          element!.style.display = 'flex';
        })

        qsa(".pool-meta.staked.amount").forEach((element, index) => {

          console.log(index)
          element!.style.display = 'flex';
          element!.innerText = convertToDecimals(poolParams.resultParams.stake_tokens[index].toString(), poolParams.metaData.decimals, 7)

        })

      } else {
        let stakedWithDecimals = convertToDecimals(poolParams.resultParams.staked.toString(), poolParams.metaData.decimals, 7)
        qsInnerText("#" + poolParams.html.id + " #near-balance span.near.balance", stakedWithDecimals)
      }

      //const walletAvailable = await poolParams.getWalletAvailable()

      const walletBalances = await poolParams.getWalletAvailable()

      if (Array.isArray(walletBalances)) {

        //console.log(walletBalances)

        qsa("#wallet-available span.near.balance").forEach((element, index) => {

          //console.log(index)
          //console.log(walletBalances[index].toString())

          if (walletBalances[index]) {

            element!.innerHTML = removeDecZeroes(walletBalances[index].toString());
            //console.log(element!.innerHTML)

            if (Number(walletBalances[index].toString().replace(".", "")) > 1) {
              let elems = qsa("#wallet-available a .max")
              let elem = elems[index] as HTMLElement
              //console.log(elem)
              elem.style.display = "block";
            }
          }

        })

      } else {

        qs("#wallet-available span.near.balance")!.innerHTML = removeDecZeroes(walletBalances.toString());

        if (Number(walletBalances.toString().replace(".", "")) > 1) {
          let elem = qs("#wallet-available a .max") as HTMLElement
          elem.style.display = "block";
        }
      }

      let real = poolParams.resultParams.real
      let computed = poolParams.resultParams.computed

      /** TODO - make dynamic **/
      if (BigInt(convertToBase(poolParams.resultParams.staked.toString(), decimals)) > BigInt(0)) {
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

      qsInnerText("#" + poolParams.html.id + " #cheddar-balance", poolParams.resultParams.getDisplayableComputed())
    }
    else {
      qsInnerText("#" + poolParams.html.id + " #cheddar-balance", yton(poolParams.resultParams.real))
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

      /** TODO - make dynamic **/
      if (poolParams.type == "multiple") {
        /** TODO - Implement **/

      } else {

        if (BigInt(convertToBase(poolParams.resultParams.staked.toString(), decimals)) > BigInt(0)) {

          var rewards = (poolParams.resultParams.real_rewards_per_day * BigInt(elapsed_ms) / (BigInt(1000 * 60 * 60 * 24)));
          poolParams.resultParams.computed = poolParams.resultParams.real + rewards

          qsInnerText("#" + poolParams.html.id + " #cheddar-balance", poolParams.resultParams.getDisplayableComputed());
        }
      }
    }
    else {
      //console.log("refreshRewardsDisplayLoopGeneric: CLOSED")
      qsInnerText("#" + poolParams.html.id + " #cheddar-balance", yton(poolParams.resultParams.real));
    }
  } catch (ex) {
    console.error(ex);
  }
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
  poolParams.resultParams.accName = poolParams.contract.wallet.getAccountId()

  
}

async function refreshPoolInfoSingle(poolParams: PoolParams, newPool: HTMLElement){
  var metaData = poolParams.metaData;
  let accName = poolParams.resultParams.accName
  
  let accountInfo = await poolParams.contract.status(accName)
  
  let staked = (accountInfo) ? BigInt(accountInfo[0]) : 0;
  let displayableStaked = convertToDecimals(staked.toString(), metaData.decimals, 7)
  
  let unstakeMaxButton = qs(".unstake .max-button") as HTMLElement
  newPool.querySelector(".unstake .value")!.innerHTML  = displayableStaked
  showOrHideMaxButton(displayableStaked.toString(), unstakeMaxButton)


  const walletBalances = await poolParams.getWalletAvailable()
  
  let stakeMaxButton = qs(".stake .max-button") as HTMLElement
  newPool.querySelector(".stake .value")!.innerHTML = removeDecZeroes(walletBalances.toString())
  showOrHideMaxButton(walletBalances.toString(), stakeMaxButton)


  setAccountInfo(poolParams, accountInfo)
  let unclaimedRewards = poolParams.resultParams.getCurrentCheddarRewards()

  newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = unclaimedRewards.toString()
}

async function refreshPoolInfoOld(poolParams: PoolParams) {
  poolParams.resultParams.accName = poolParams.contract.wallet.getAccountId();
  var metaData = poolParams.metaData;
  var metaData2 = poolParams.metaData2
  let accName = poolParams.resultParams.accName
  // Modify this so it's done only once
  qs(".user-info #account-id").innerText = poolParams.resultParams.getDisplayableAccountName();
  //show top-right-balance only if connected wallet
  //show(qs("#top-right-balance"), wallet.isConnected())

  let accountInfo = await poolParams.contract.status(accName)

  /** TODO - make dynamic **/
  if (poolParams.type == "multiple") {

    let staked = (accountInfo) ? accountInfo.stake_tokens : 0;
    let displayableStaked = convertToDecimals(staked.toString(), metaData.decimals, 7)
    qsaInnerText("#" + poolParams.html.id + " #near-balance span.near.balance", displayableStaked)

  } else {

    let staked = (accountInfo) ? BigInt(accountInfo[0]) : 0;
    let displayableStaked = convertToDecimals(staked.toString(), metaData.decimals, 7)
    qsaInnerText("#" + poolParams.html.id + " #near-balance span.near.balance", displayableStaked)
  }

  // const walletAvailable = await poolParams.getWalletAvailable()
  // qsaInnerText("#" + poolParams.html.id + " #wallet-available span.near.balance", removeDecZeroes(walletAvailable.toString()))

  const walletBalances = await poolParams.getWalletAvailable()

  if (walletBalances) {

    if (Array.isArray(walletBalances)) {

      qsa("#" + poolParams.html.id + " #wallet-available span.near.balance").forEach((element, index) => {

        if (walletBalances[index]) {

          element!.innerHTML = removeDecZeroes(walletBalances[index].toString());
          //console.log(element!.innerHTML)
          let elems = qsa("#" + poolParams.html.id + " #wallet-available a .max")
          showOrHideMaxButton(walletBalances[index].toString(), elems[index] as HTMLElement)
          // if (Number(walletBalances[index].toString().replace(".", "")) > 1) {
          //   let elems = qsa("#wallet-available a .max")
          //   let elem = elems[index] as HTMLElement
          //   //console.log(elem)
          //   elem.style.display = "block";
          // }
        }
      })

    } else {

      qs("#" + poolParams.html.id + " #wallet-available span.near.balance")!.innerHTML = removeDecZeroes(walletBalances.toString());

      let elem = qs("#wallet-available a .max") as HTMLElement

      showOrHideMaxButton(walletBalances.toString(), elem)
    }
  }


  //update account & contract stats
  if (wallet.isConnected()) {//DUDA no es redundante preguntar esto en esta instancia?
    let metaData = await poolParams.metaData;

    let contractParams = await poolParams.contract.get_contract_params()
    // console.log(contractParams)


    /*** Workaround Free Community Farm pool ***/
    let rewardsPerDay = 0n

    if (contractParams.farming_rate) {
      rewardsPerDay = BigInt(contractParams.farming_rate) * BigInt(60 * 24)
    }
    else if (contractParams.farm_token_rates) {
      /** TODO - Implement 
       * 
       * // calculate let emission = contract.farm_unit_emission * 24 * 3600
       * // total rewards per day (globally, not per account):
       * const base = 1e24;
       * let rewards = contract.farm_token_rates.map( (r) => emission * r / base));
       **/
      //let emission = BigInt(contractParams.farm_unit_emission) * BigInt(24 * 3600)

      rewardsPerDay = BigInt(contractParams.farm_token_rates) * BigInt(60 * 24)
    }
    else {
      rewardsPerDay = contractParams.rewards_per_day
    }

    /*** Workaround Free Community Farm pool ***/
    let totalStaked = 0

    if (contractParams.total_staked) {
      if (Array.isArray(contractParams.total_staked)) {
        totalStaked = contractParams.total_staked[0]
        //console.log(totalStaked)
      }
      else if (contractParams.farm_token_rates) {
        /** TODO - make dynamic **/
        totalStaked = BigInt(contractParams.total_staked[0])
        totalStaked1 = BigInt(contractParams.total_staked[1])
      }
      else {
        totalStaked = contractParams.total_staked
      }

    }
    else {
      totalStaked = contractParams.total_stake
    }

    /*** Workaround Free Community Farm pool ***/
    let totalFarmed = 0

    if (contractParams.total_farmed) {
      totalFarmed = contractParams.total_farmed
    }
    else {
      totalFarmed = contractParams.total_rewards
    }

    if (qs("#" + poolParams.html.id + " #pool-stats #total-staked")) {

      /** TODO - make dynamic **/
      if (Array.isArray(contractParams.total_staked)) {
        qs("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_staked[0], metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
        qs("#pool-stats #total_staked_1")!.style.display = "flex"
        qs("#pool-stats #total-staked1")!.innerHTML = convertToDecimals(contractParams.total_staked[1], metaData2.decimals, 5) + " " + metaData2.symbol.toUpperCase()
      }
      else {
        qs("#" + poolParams.html.id + " #pool-stats #total-staked").innerText = convertToDecimals(totalStaked, metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
      }

      qs("#" + poolParams.html.id + " #pool-stats #rewards-per-day").innerText = yton(rewardsPerDay.toString()).toString()
      qs("#" + poolParams.html.id + " #pool-stats #total-rewards").innerText = convertToDecimals(totalFarmed, 24, 5);
    }

  }
  else {
    poolParams.contractParams.rewards_per_day = 10n;
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

function autoFillStakeAmount(poolParams: PoolParamsP3, pool: HTMLElement, inputId: string, mul: boolean) {
  return function (event: Event) {
    event.preventDefault()
    let value1 = (event.target as HTMLInputElement).value
    let input2 = pool.querySelector(`#${inputId}`) as HTMLInputElement
    if (value1 == "") {
      input2.value = ""
    } else if (isNaN(parseFloat(value1))) {
      input2.value = "Please Input a Number"
    } else {
      let rates = poolParams.contractParams.stake_rates
      console.log(BigInt(rates[1]))
      const mulRate = Number(BigInt(rates[1]) * 100n / (BigInt(rates[0]))) / 100
      console.log(mulRate.toString())
      const rate = mul ? mulRate : (mulRate ** -1)
      //Replace the "2" with proper variable
      input2.value = (Number(value1) * rate).toString()
    }
  }
}

async function addPoolSingle(poolParams: PoolParams, newPool: HTMLElement): Promise<void> {
  const walletBalance: number = await poolParams.getWalletAvailable()

  const metaData = poolParams.metaData
  let totalStaked = poolParams.contractParams.total_staked.toString()
  const rewardsPerDay = getRewardsPerDaySingle(poolParams)

  newPool.querySelector(".stake span.value")!.innerHTML = removeDecZeroes(walletBalance.toString());

  let stakeMaxButton = newPool.querySelector(".stake .max-button") as HTMLElement
  stakeMaxButton.addEventListener("click", maxStakeClicked(newPool))
  
  showOrHideMaxButton(walletBalance.toString(), stakeMaxButton)//TODO test if this function is working in the new pool



  newPool.querySelectorAll(".token-name").forEach(element => {
    element.innerHTML = metaData.symbol
  })

  const stakedDisplayable = convertToDecimals(poolParams.resultParams.staked.toString(), metaData.decimals, 7)
  
  newPool.querySelector("#staking-unstaking-container .unstake .value")!.innerHTML = stakedDisplayable
  
  let unclaimedRewards = poolParams.resultParams.getCurrentCheddarRewards()

  // console.log(unclaimedRewards)

  newPool.querySelector(".unclaimed-rewards-value")!.innerHTML = unclaimedRewards.toString()


  let unstakeMaxButton = newPool.querySelector(`.unstake .max-button`) as HTMLElement
  unstakeMaxButton.addEventListener("click", maxUnstakeClicked(newPool))
  showOrHideMaxButton(stakedDisplayable.toString(), unstakeMaxButton)

  if (Number(stakedDisplayable) > 0) {
    unstakeMaxButton.classList.remove("hidden")
  }

  let totalFarmed = poolParams.contractParams.total_farmed.toString()
  newPool.querySelector(".total-token-farmed-value")!.innerHTML = convertToDecimals(totalFarmed, 24, 5)

  newPool.querySelector(".stats-container .token-total-rewards-value")!.innerHTML = yton(rewardsPerDay.toString()).toString()

  newPool.querySelector(".stats-container .total-staked-value")!.innerHTML = convertToDecimals(totalStaked, metaData.decimals, 5).toString()

  newPool.querySelector("#stake-button")?.addEventListener("click", stakeSingle(poolParams, newPool))

  newPool.querySelector("#unstake-button")?.addEventListener("click", unstakeSingle(poolParams, newPool))

  newPool.querySelector("#activate")?.addEventListener("click", depositClicked(poolParams, newPool))

  newPool.querySelector("#harvest-button")?.addEventListener("click", harvestSingle(poolParams, newPool))

  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  if(isDateInRange) {
    window.setInterval(refreshPoolInfoSingle.bind(null, poolParams, newPool), 5000)
  }

  if(Number(stakedDisplayable) > 0){
    newPool.classList.add("your-farms")
  }
}

async function addPoolSingleOld(poolParams: PoolParams, newPool: HTMLElement): Promise<void> {
  const walletBalances: number = await poolParams.getWalletAvailable()
  let totalStaked = poolParams.contractParams.total_staked.toString()
  let metadata = poolParams.metaData

  newPool.querySelector("#wallet-available span.near.balance")!.innerHTML = removeDecZeroes(walletBalances.toString());

  let elem = newPool.querySelector("#wallet-available a .max") as HTMLElement  
  showOrHideMaxButton(walletBalances.toString(), elem)

  let stakeAmountContainer = newPool.querySelector("#firstStakeAmount .near.balance") as HTMLElement

  let input = newPool.querySelector("#stakeAmount1") as HTMLInputElement
  const rewardsPerDay = getRewardsPerDaySingle(poolParams)

  newPool.querySelector("#pool-stats #rewards-per-day")!.innerHTML = yton(rewardsPerDay.toString()).toString()
  elem.addEventListener("click", maxStakeClicked(stakeAmountContainer, input))
  newPool.querySelector("#pool-stats #total-staked-container span.near.balance")!.innerHTML = convertToDecimals(totalStaked, metadata.decimals, 5).toString()
}

async function addPoolMultiple(poolParams: PoolParamsP3, newPool: HTMLElement): Promise<void> {
  const walletBalances = await poolParams.getWalletAvailable()

  newPool.querySelector("#second-near-balance span.near.balance")!.innerHTML = "0"
  newPool.querySelectorAll(".multiple").forEach(element => {
    element!.style.display = 'inherit';
  })
  newPool.querySelectorAll(".pool-meta.staked").forEach((element, index) => {
    element!.style.display = 'flex';
  })
  newPool.querySelectorAll(".pool-meta.staked.amount").forEach((element, index) => {
    element!.style.display = 'flex';
    // element!.innerText = convertToDecimals(poolParams.resultParams.staked[index].toString(), poolParams.metaData.decimals, 7)
  })
  newPool.querySelector("#stakeAmount1")!.addEventListener("input", autoFillStakeAmount(poolParams, newPool, "stakeAmount2", true))
  newPool.querySelector("#stakeAmount2")!.addEventListener("input", autoFillStakeAmount(poolParams, newPool, "stakeAmount1", false))
  newPool.querySelectorAll(".input-group-box").forEach((element, index) => {
    element!.style.display = 'flex';
  })
  newPool.querySelectorAll("#wallet-available span.near.balance").forEach((element, index) => {

    element!.innerHTML = removeDecZeroes(walletBalances[index].toString());

    let elems = newPool.querySelectorAll(`#wallet-available a .max`)
    showOrHideMaxButton(walletBalances[index].toString(), elems[index] as HTMLElement)

    let stakeAmountContainer = newPool.querySelector("#secondStakeAmount .near.balance") as HTMLElement
    let input = newPool.querySelector("#stakeAmount2") as HTMLInputElement
    elems[index].addEventListener("click", maxStakeClicked(stakeAmountContainer, input))

  })
  newPool.querySelectorAll(".second-token-name").forEach(element => {
    element.innerHTML = poolParams.metaData2.symbol
  })

  const rewardsPerDay = getRewardsPerDayMultiple(poolParams)
  newPool.querySelector("#pool-stats #rewards-per-day")!.innerHTML = yton(rewardsPerDay.toString()).toString()
  newPool.querySelector("#pool-stats #total-staked-container span.near.balance")!.innerHTML = yton(poolParams.contractParams.total_staked[0].toString()).toString()
  newPool.querySelector("#pool-stats #second-total-staked-container span.balance")!.innerHTML = yton(poolParams.contractParams.total_staked[1].toString()).toString()
}

/*
  Proposed structure:
  function addPool() {
    // Initialize variables
    // Create newPool
    // Fill newPool with all the generic data
    if(contractType == p2) {
      addPoolSingle()
    } else {
      addPoolMultiple()
    }
  }

  function addPoolSingle() {
    // Fill newPool with all the data related only to single pools
  }

  function addPoolMultiple() {
    // Fill newPool with all the data related only to multiple pools
  }
*/

async function addPool(poolParams: PoolParams | PoolParamsP3): Promise<void> {
  var genericPoolElement = qs("#generic-pool-container") as HTMLElement;
  var metaData = poolParams.metaData;
  let singlePoolParams: PoolParams

  var newPool = genericPoolElement.cloneNode(true) as HTMLElement;

  newPool.setAttribute("id", poolParams.html.id)
  newPool.classList.remove("hidden")
  newPool.classList.add("pool-container")

  let iconElem = newPool.querySelector("#token-logo-container img")
  
  iconElem!.setAttribute("src", metaData.icon || "");

  if (poolParams instanceof PoolParams) {
    singlePoolParams = poolParams
    await addPoolSingle(singlePoolParams, newPool)
  } else {
    //multiplePoolParams = poolParams
    //await addPoolMultiple(multiplePoolParams, newPool)
  }

  // New code
  // let poolContainer = newPool.querySelector("#generic-pool-container")! as HTMLElement;
  let showAndHideVisibilityTool = newPool.querySelector(".visual-tool-expanding-indication-hidden")! as HTMLElement;
  let infoIcon = newPool.querySelector("#new-token-header .information-icon-container")! as HTMLElement;
  let poolStats = newPool.querySelector("#token-pool-stats")! as HTMLElement;
  let expandPoolButton = newPool.querySelector(".expand-button")! as HTMLElement;
  let hidePoolButton = newPool.querySelector(".hide-button")! as HTMLElement;
  let stakingUnstakingContainer = newPool.querySelector("#staking-unstaking-container")! as HTMLElement;
  let stakingButton = newPool.querySelector(".staking")! as HTMLElement;
  let unstakingButton = newPool.querySelector(".unstaking")! as HTMLElement;
  let staking = newPool.querySelector(".main-staking")! as HTMLElement;
  let unstaking = newPool.querySelector(".main-unstaking")! as HTMLElement;
  var contractParams = poolParams.contractParams;

  newPool.addEventListener("mouseover", paintOrUnPaintElement("visual-tool-expanding-indication-hidden", showAndHideVisibilityTool));
  newPool.addEventListener("mouseout", paintOrUnPaintElement("visual-tool-expanding-indication-hidden",showAndHideVisibilityTool));

  infoIcon.addEventListener("mouseover", showElement(poolStats));
  poolStats.addEventListener("mouseout", hideElement(poolStats));

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

  const now = Date.now() / 1000
  const isDateInRange = poolParams.contractParams.farming_start < now && now < poolParams.contractParams.farming_end
  if(isDateInRange) {
    newPool.classList.add("active-pool")
  } else {
    newPool.classList.add("inactive-pool")
  }

  qs("#pool_list").append(newPool)

  newPool.querySelector("#contract-information .deposit-fee-value")!.innerHTML = (contractParams.fee_rate) ? contractParams.fee_rate / 100 + "%" : "0%"
}

async function addPoolOld(poolParams: PoolParams | PoolParamsP3): Promise<void> {

  var genericPoolElement = qs("#genericPool") as HTMLElement;
  let accName = poolParams.resultParams.accName
  var metaData = poolParams.metaData;
  var metaData2 = poolParams.metaData2;
  var contractParams = poolParams.contractParams;
  var accountInfo = await poolParams.contract.status(accName);
  let singlePoolParams: PoolParams
  let multiplePoolParams: PoolParamsP3




  //console.log(poolType)

  //console.log(accountInfo)
  if (accountInfo) {
    //poolParams.resultParams.staked = BigInt(accountInfo[0])

    //QUESTION AccountInfo is returning null in multiple case
    if (poolParams.type == "multiple") {

      poolParams.resultParams.staked = accountInfo.stake_tokens;
      poolParams.resultParams.real = BigInt(accountInfo.farmed)
      poolParams.resultParams.previous_real = BigInt(accountInfo.farmed)
      poolParams.resultParams.computed = BigInt(accountInfo.farmed)
      poolParams.resultParams.previous_timestamp = Number(accountInfo.timestamp)

    } else {
      poolParams.resultParams.staked = BigInt(accountInfo[0]);
      poolParams.resultParams.real = BigInt(accountInfo[1])
      poolParams.resultParams.previous_real = BigInt(accountInfo[1])
      poolParams.resultParams.computed = BigInt(accountInfo[1])
      poolParams.resultParams.previous_timestamp = Number(accountInfo[2])
    }

    //poolParams.resultParams.staked = (accountInfo) ? BigInt(accountInfo[0]) : 0;

  }

  poolParams.resultParams.tokenDecimals = metaData.decimals

  var newPool = genericPoolElement.cloneNode(true) as HTMLElement;


  /** TODO - Add Dynamic HTML elements 
   * 
   *  <div class="pool-meta staked" style="display:none">
  *    <div class="token-name">NEAR</div>
  *    <div class="">Staked</div>
  *  </div>
  * 
  *  <div id="stakedAmount1" class="pool-meta staked amount" style="display:none">
  *    <div id="near-balance"><span class="near balance"></span><a href="#"></a></div>
  *    <div>&nbsp;</div>
  *  </div>
  * 
  *  <div id="secondStakeAmount" class="input-group" style="display:none">
  *     <input id="stakeAmount1" class="near amount input-box" inputmode="numeric" placeholder="Enter Amount" onfocus="this.placeholder = ''" onblur="this.placeholder = 'Enter Amount'" autocomplete="off">&nbsp;<span id="max" class="inside-input">Max</span>
  *     <span class="token-name">NEAR</span>
  *  </div>
  * 
  *  <div class="pool-meta wallet-balance">
  *      <div id="wallet-available">Available to stake:&nbsp;<span class="near balance"></span>&nbsp;<a href="#"><span class="max" style="display:none">max</span></a></div>
  *  </div>
  * 
  * **/


  newPool.setAttribute("id", poolParams.html.id);
  newPool.setAttribute("style", "");
  newPool.querySelector("form")?.setAttribute("id", poolParams.html.formId);
  //console.log(metaData)
  // newPool.querySelector("#token-header span.name")!.innerHTML = metaData.name;
  newPool.querySelector(".pool-meta #percetage")!.innerHTML = (contractParams.fee_rate) ? contractParams.fee_rate / 100 + "%" : "0%"

  let iconElem = newPool.querySelector("#token-header img")

  /*** Workaround Free Community Farm pool ***/
  if (poolParams.html.formId == 'near' || poolParams.html.formId == 'nearcon') {
    //Skip do nothing with icon use default NEAR icon
  } else if (metaData.icon != null) {
    iconElem!.setAttribute("src", metaData.icon || "");
  } else {
    var iconImage = document.createElement('span');
    iconImage.classList.add('icon');
    iconElem?.parentNode?.replaceChild(iconImage, iconElem);
  }

  if (poolParams instanceof PoolParams) {
    singlePoolParams = poolParams
    await addPoolSingle(singlePoolParams, newPool)
  } else {
    multiplePoolParams = poolParams
    // let accountInfoMultiple = await poolParams.contract.status(accName);
    // let stakedTokens = multiplePoolParams.contractParams.stake_rates.map(elem => yton(elem))
    // let totalTokens = multiplePoolParams.contractParams.total_staked
    // console.log(`accName: ${accName}`)
    // console.log(`Total: ${totalTokens}`)
    await addPoolMultiple(multiplePoolParams, newPool)
  }


  // newPool.querySelectorAll(".name").forEach(element => {

  //   /*** Workaround Free Community Farm pool ***/
  //   if(poolParams.html.formId == 'near') {
  //     element.innerHTML = 'NEAR (FREE FARM)'
  //   } else if(poolParams.html.formId == 'nearcon') {
  //     element.innerHTML = 'CHEDDAR (NEARCON)'
  //   } else {
  //     //console.log(metaData)
  //     element.innerHTML = metaData.symbol
  //   }
  // })

  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  const isDateInRange = contractParams.farming_start < unixTimestamp && unixTimestamp < contractParams.farming_end
  newPool.querySelector("#poolOpen span")!.innerHTML = (isDateInRange) ? "OPEN" : "CLOSED"

  newPool.querySelectorAll("#stake").forEach(element => {
    element.disabled = !isDateInRange
  })

  // QUESTION what do you wanna do here? (disable if farm closed and no tokens staked)
  // newPool.querySelectorAll(".amount input-box nea").forEach(element => {
  //     element.disabled = (!isDateInRange && poolParams.stak == 0) ? true : false
  // })

  newPool.querySelectorAll(".token-name").forEach(element => {
    element.innerHTML = metaData.symbol
  })

  // newPool.querySelectorAll(".second-token-name").forEach(element => {
  //   element.innerHTML = metaData2.symbol
  // })

  // newPool.querySelectorAll(".token-name").forEach(element => {

  //   /*** Workaround Free Community Farm pool ***/
  //   if(poolParams.html.formId == 'near' || poolParams.html.formId == 'nearcon') {
  //     element.innerHTML = 'NEAR'
  //   } else if(element.id  == "secondary-token") {
  //     element.innerHTML = metaData2.symbol
  //   } else {
  //     element.innerHTML = metaData.symbol
  //   }

  // })

  // newPool.querySelectorAll("#" + poolParams.html.formId +  " .token-name")!.innerHTML = metaData.symbol;
  newPool.querySelector("#farming_start")!.innerHTML = new Date(contractParams.farming_start * 1000).toLocaleString()
  newPool.querySelector("#farming_end")!.innerHTML = new Date(contractParams.farming_end * 1000).toLocaleString()

  const stakedDisplayable = convertToDecimals(poolParams.resultParams.staked.toString(), metaData.decimals, 7)
  newPool.querySelector("#near-balance span.near.balance")!.innerHTML = stakedDisplayable

  //TODO modify unstake to handle multiple
  let elem = newPool.querySelector(`#near-balance a .max`) as HTMLElement
  elem.addEventListener("click", maxUnstakeClicked(newPool))

  if (Number(stakedDisplayable) > 0) {
    elem.style.display = "block";
  }

  let humanReadableRealRewards = yton(poolParams.resultParams.real.toString()).toString()
  let realRewards = poolParams.resultParams.real.toString()
  newPool.querySelector("#cheddar-balance")!.innerHTML = convertToDecimals(realRewards, 24, 7);

  // const walletBalances = await poolParams.getWalletAvailable()
  //update shown wallet balance

  /** TODO - make dynamic **/
  // if(Array.isArray(walletBalances)){

  // if(poolParams.type == "multiple") {
  //   newPool.querySelector("#second-near-balance span.near.balance")!.innerHTML = "0"
  //   newPool.querySelectorAll(".multiple").forEach(element => {
  //     element!.style.display = 'inherit';
  //   })

  //   newPool.querySelectorAll(".pool-meta.staked").forEach((element,index) => {
  //     element!.style.display = 'flex';
  //   })

  //   newPool.querySelectorAll(".pool-meta.staked.amount").forEach((element,index) => { 
  //     element!.style.display = 'flex';
  //     // element!.innerText = convertToDecimals(poolParams.resultParams.staked[index].toString(), poolParams.metaData.decimals, 7)

  //   })

  //   newPool.querySelector("#stakeAmount2")!.addEventListener("input", autoFillStakeAmount2(newPool))
  //   newPool.querySelector("#stakeAmount1")!.addEventListener("input", autoFillStakeAmount1(newPool))

  // } else {
  //   let stakedWithDecimals = convertToDecimals(poolParams.resultParams.staked.toString(), poolParams.metaData.decimals, 7)
  //   qsInnerText("#" + poolParams.html.id + " #near-balance span.near.balance", stakedWithDecimals)
  // }

  // newPool.querySelectorAll(".input-group-box").forEach((element,index) => {
  //   element!.style.display = 'flex';
  // })

  // newPool.querySelectorAll("#wallet-available span.near.balance").forEach((element,index) => {

  //   element!.innerHTML = removeDecZeroes(walletBalances[index].toString());

  //   let elems = newPool.querySelectorAll(`#wallet-available a .max`)
  //   showOrHideMaxButton(walletBalances[index].toString(), elems[index] as HTMLElement)

  //   let stakeAmountContainer = newPool.querySelector("#secondStakeAmount .near.balance") as HTMLElement
  //   let input = newPool.querySelector("#stakeAmount2") as HTMLInputElement
  //   elems[index].addEventListener("click", maxStakeClicked(stakeAmountContainer, input))

  // })
  // } else {
  // newPool.querySelector("#wallet-available span.near.balance")!.innerHTML = removeDecZeroes(walletBalances.toString());

  // let elem = newPool.querySelector("#wallet-available a .max") as HTMLElement

  // showOrHideMaxButton(walletBalances.toString(), elem) 

  // let stakeAmountContainer = newPool.querySelector("#firstStakeAmount .near.balance") as HTMLElement
  // let input = newPool.querySelector("#stakeAmount1") as HTMLInputElement

  // elem.addEventListener("click", maxStakeClicked(stakeAmountContainer, input))
  // }

  // if(contractParams.total_staked){

  //   if(Array.isArray(contractParams.total_staked)) {
  //     console.log(newPool.querySelector("#pool-stats #total-staked"))
  //     newPool.querySelector("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_staked[0], metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
  //     newPool.querySelector("#pool-stats #total_staked_1")!.style.display = "flex"
  //     newPool.querySelector("#pool-stats #total-staked1")!.innerHTML = convertToDecimals(contractParams.total_staked[1], metaData2.decimals, 5) + " " + metaData2.symbol.toUpperCase()
  //   }
  //   else {
  //     newPool.querySelector("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_staked, metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
  //   }

  // } else {
  //     newPool.querySelector("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_stake, metaData.decimals, 5) + " " + "NEAR"
  // }

  // if(contractParams.accounts_registered) {
  //   newPool.querySelector("#accounts")!.innerHTML = contractParams.accounts_registered
  // } else {
  //   newPool.querySelector("#accounts")!.innerHTML = "Not Available"
  // }

  //TODO review
  // let rewardsPerDay = contractParams.getRewardsPerDay()
  // let rewardsPerDay = 1n;

  // if(contractParams.farming_rate) {
  //   rewardsPerDay = BigInt(contractParams.farming_rate) * BigInt(60 * 24)
  // } else if(contractParams.farm_token_rates) {
  //   rewardsPerDay = BigInt(contractParams.farm_token_rates)
  // } else {
  //   rewardsPerDay = BigInt(contractParams.rewards_per_day)
  // }

  // newPool.querySelector("#pool-stats #rewards-per-day")!.innerHTML = yton(rewardsPerDay.toString()).toString();
  if (contractParams.total_farmed) {
    //console.log(metaData.decimals)
    newPool.querySelector("#pool-stats #total-rewards")!.innerHTML = convertToDecimals(contractParams.total_farmed, 24, 5)
  } else {
    newPool.querySelector("#pool-stats #total-rewards")!.innerHTML = convertToDecimals(contractParams.total_rewards, 24, 5)
  }



  let accountRegistered = null

  /*** Workaround Free Community Farm pool ***/
  if (poolParams.html.formId == "nearcon" || poolParams.html.formId == "cheddar") {
    //console.log("NEARCON")
    accountRegistered = await poolParams.tokenContract.storageBalance();
  } else if (contractParams.farming_rate) {
    accountRegistered = await poolParams.contract.storageBalance();
  } else if (contractParams.farm_token_rates) {
    accountRegistered = await poolParams.contract.storageBalance();
  }
  //QUESTION What is this?
  // If accountRegistered is null then the contract is not activated
  if (accountRegistered == null) {

    //console.log(poolParams.html.formId)

    if (isDateInRange) {
      newPool.querySelector("#deposit")!.style.display = "block"
      newPool.querySelector("#activated")!.style.display = "none"
      newPool.querySelector(".activate")?.addEventListener("click", depositClicked(poolParams, newPool));
    }
    else if (poolParams.html.formId == "nearcon" || poolParams.html.formId == "cheddar") {

      //console.log("IS NEARCON")

      newPool.querySelector("#deposit")!.style.display = "block"
      newPool.querySelector("#activated")!.style.display = "none"
      newPool.querySelector(".activate")?.addEventListener("click", depositClicked(poolParams, newPool));

      newPool.querySelector("#depositWarning")!.innerHTML = "ONLY ACTIVATE IF PREVIOUSLY STAKED<br>0.05 NEAR storage deposit, gets refunded."

    }
    else {
      newPool.querySelector("#deposit")!.style.display = "none"
      newPool.querySelector("#activated")!.style.display = "block"
      newPool.querySelector("#harvest")?.addEventListener("click", harvestClicked(poolParams, newPool));
      newPool.querySelector("#unstake")?.addEventListener("click", unstakeClicked(poolParams, newPool));
    }

  }
  else {
    newPool.querySelector("#deposit")!.style.display = "none"
    newPool.querySelector("#activated")!.style.display = "block"
    newPool.querySelector("#harvest")?.addEventListener("click", harvestClicked(poolParams, newPool));
    newPool.querySelector("#stake")?.addEventListener("click", stakeClicked(poolParams, newPool));
    newPool.querySelector("#unstake")?.addEventListener("click", unstakeClicked(poolParams, newPool));
  }


  newPool.querySelector("#terms-of-use")?.addEventListener("click", termsOfUseListener())

  qs("#pool_list").append(newPool);

  poolParams.setTotalRewardsPerDay();

  if (!isPaused) {
    // setInterval(refreshRewardsDisplayLoopGeneric.bind(null, poolParams, metaData.decimals), 200);
    // setInterval(refreshRealRewardsLoopGeneric.bind(null, poolParams, metaData.decimals), 60 * 1000);
  }
}

function getRewardsPerDaySingle(poolParams: PoolParams) {
  return BigInt(poolParams.contractParams.farming_rate) * 60n * 24n
}

function getRewardsPerDayMultiple(poolParams: PoolParamsP3) {
  // QUESTION: How should this be calculated in the case that there is more than one?
  return BigInt(poolParams.contractParams.farm_token_rates[0]) * 60n * 24n
}

function maxStakeClicked(pool: HTMLElement) {
  return function (event: Event) {
    event.preventDefault()

    let input = pool.querySelector(".main-staking input") as HTMLInputElement
    const amount = pool.querySelector(".stake .value")!.innerHTML

    input.value = amount.toString()
  }
}

function maxStakeClickedOld(amountContainer: HTMLElement, input: HTMLInputElement) {
  return function (event: Event) {
    event.preventDefault()


    if (amountContainer) {
      const amount = amountContainer.innerHTML
      input.value = amount.toString()
    }

    let inputEvent = new Event("input", {
      bubbles: true,
      cancelable: true
    })

    input.dispatchEvent(inputEvent)

  }
}

function maxUnstakeClicked(pool: HTMLElement) {
  return function (event: Event) {
    event.preventDefault()

    let input = pool.querySelector(".main-unstaking input") as HTMLInputElement
    const amount = pool.querySelector(".unstake .value")!.innerHTML

    input.value = amount.toString()
  }
}

function maxUnstakeClickedOld(pool: HTMLElement) {
  return function (event: Event) {
    event.preventDefault()

    const idIndex = event.path[0].id.split("max")
    const parent = pool.querySelector("#" + event.path[0].id).parentNode.parentNode
    const amountContainer = parent.querySelector("span.near.balance")

    if (amountContainer) {
      const amount = amountContainer.innerHTML
      let input = pool.querySelector("#stakeAmount" + idIndex[1]) as HTMLInputElement
      input.value = amount.toString()
    }

    // const amountContainer = pool.querySelector("#near-balance .near.balance")
    // if(amountContainer) {
    //   const amount = amountContainer.innerHTML
    //   let input = pool.querySelector("#stakeAmount1") as HTMLInputElement
    //   input.value = amount.toString()
    // }


  }
}

async function addPoolList(poolList: Array<PoolParams>) {
  qs("#pool_list").innerHTML = ""
  for (let i = 0; i < poolList.length; i++) {

    var accName = poolList[i].contract.wallet.getAccountId();
    var accountInfo = await poolList[i].contract.status(accName);

    if (window.localStorage.getItem("onlyStaked") === 'true' && accountInfo[0] > 0) {
      await addPool(poolList[i]);
    } else if (window.localStorage.getItem("onlyStaked") === 'false') {
      await addPool(poolList[i]);
    }

  }




  qs("#pool_list").style.display = "grid"

  //console.log(qs("#pool_list").childElementCount)
  if (qs("#pool_list").childElementCount == 0) {
    qs("#pool_list").innerHTML = "<h2 style='color: #8542EB;text-shadow: white 0px 1px 5px;margin-top:5rem;'>You have No Staked Pools.</h2>"
    //qs("#switch").click();
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

    var countDownDate = new Date("Jan 2, 2022 18:00:00 UTC");
    var countDownDate = new Date(countDownDate.getTime() - countDownDate.getTimezoneOffset() * 60000)

    //console.log(countDownDate)

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

    if (window.localStorage.getItem("onlyStaked")) {
      //console.log(window.localStorage.getItem("onlyStaked"))
      // let switchElement = document.getElementById("switch") as HTMLInputElement
      // switchElement.checked = window.localStorage.getItem("onlyStaked") === 'true'
      window.localStorage.getItem("onlyStaked") === 'true'

    }
    else {
      console.log(window.localStorage.getItem("onlyStaked"))
      window.localStorage.setItem("onlyStaked", "false")
      document.getElementById("switch").checked = false;
    }

    if (nearWebWalletConnection.isSignedIn()) {
      //already signed-in with NEAR Web Wallet
      //make the contract use NEAR Web Wallet
      wallet = new NearWebWallet(nearWebWalletConnection);
      
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
      const { err, data, method, finalExecutionOutcome } = await checkRedirectSearchParams(nearWebWalletConnection, nearConfig.farms[0].explorerUrl || "explorer");

      if (finalExecutionOutcome) {
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
        for (let i = 0; i < poolList.length; i++) {
          //console.log("poolList[i].contract.contractId: ", poolList[i].contract.contractId)
          if (poolList[i].contract.contractId == receiver) {
            const metaData = poolList[i].metaData
            showSuccess(`Unstaked ${convertToDecimals(args.amount, metaData.decimals, 2)} ${metaData.symbol}`)
            // showSuccess(`Unstaked ${convertToDecimals(data, metaData.decimals, 2)} ${metaData.symbol}`)
            break;
          }
        }
      } else if (method == "withdraw_crop") {

        if (finalExecutionOutcome) {
          var log = (finalExecutionOutcome.receipts_outcome[3].outcome.logs[0]).split(' ');
          var message = yton(log[3]) + ' Cheddar Harvested!'
          showSuccess(message)
        }

      } else if (method == "storage_deposit") {
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
            //console.log("Receiver: ", receiver)
            //console.log("Length: ", poolList.length)
            // if(receiver) {
            for (let i = 0; i < poolList.length; i++) {
              //console.log("poolList[i].tokenContract.contractId: ", poolList[i].tokenContract.contractId)
              if (poolList[i].tokenContract.contractId == receiver) {
                const metaData = poolList[i].metaData
                showSuccess(`Unstaked ${convertToDecimals(data, metaData.decimals, 2)} ${metaData.symbol}`)
                break;
              }
            }
            // }
            break;
          }
          case "ft_transfer_call": {
            /** TODO - Fix for mutliple transactions **/
            var receiver = finalExecutionOutcome?.transaction.receiver_id;
            for (let i = 0; i < poolList.length; i++) {
              if (poolList[i].tokenContract.contractId == receiver) {
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

// NEW CODE

function showOrHideElement(elementToShow: HTMLElement) {
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