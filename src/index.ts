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
//const nearConfig = getConfig(process.env.NODE_ENV || 'testnet')
export let nearConfig = getConfig(ENV); //default testnet, can change according to URL on window.onload

// global variables used throughout
export let wallet: WalletInterface = disconnectedWallet;

let nearWebWalletConnection: WalletConnection;
let nearConnectedWalletAccount: ConnectedWalletAccount
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

//only staked
qs('#switch').onclick =
  async function (event) {

    if(window.localStorage.getItem("onlyStaked")) {
      isPaused = true;
      window.localStorage.onlyStaked = event.target.checked
      console.log(window.localStorage.getItem("onlyStaked"))
      const poolList = await getPoolList(wallet);
      //await refreshAccountInfoGeneric(poolList);
      qs("#pool_list").replaceChildren();
      qs("#pool_list").style.display = "none";
      qs(".loader").style.display = "block";
      await addPoolList(poolList);

    }
    else {
      isPaused = true;
      window.localStorage.setItem("onlyStaked", event.target.checked)
      console.log(window.localStorage.getItem("onlyStaked"))
      const poolList = await getPoolList(wallet);
      //await refreshAccountInfoGeneric(poolList);
      qs("#pool_list").replaceChildren();
      qs("#pool_list").style.display = "none";
      qs(".loader").style.display = "block";
      await addPoolList(poolList);

    }
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
    //console.log("PoolParmas: ", poolParams)
    submitForm("harvest", poolParams, pool.getElementsByTagName("form")[0])
  }  
}
 
function depositClicked(poolParams: PoolParams, pool: HTMLElement) {
  return async function (event) {
    event.preventDefault()

    if(poolParams.html.formId == 'nearcon') {
      let storageDeposit = await poolParams.tokenContract.storageDeposit();
    }
    else {
      let storageDeposit = await poolParams.contract.storageDeposit();
    }

    pool.querySelector("#deposit")!.style.display = "block"
    pool.querySelector("#activated")!.style.display = "none"
  }
}

//Form submission
async function submitForm(action: string, poolParams: PoolParams, form: HTMLFormElement) {
  event?.preventDefault()

  const ONE_YOCTO_NEAR = '0.000000000000000000000001';

  //const form = event.target as HTMLFormElement
  // get elements from the form using their id attribute
  const { fieldset, stakeAmount1, stakeAmount2 } = form
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

    /** TODO - make dynamic **/
    let amount1: number = stakeAmount1.value;
    let amount2: number = stakeAmount2.value;

    /** TODO - make dynamic **/
    let stakedSymbols = [poolParams.metaData, poolParams.metaData2]

    const walletBalances = await poolParams.getWalletAvailable()
    
    if (isStaking) {

      if (!isDateInRange) throw Error("Pools is Closed.")

      if(walletBalances) {

        if(Array.isArray(walletBalances)){

          // if(isNaN(parseFloat(amount1))) {
          //   throw Error("Please Input a Number.")
          // } else if(poolParams.type == "multiple" && isNaN(parseFloat(amount2))) {
          //   throw Error("Please Input a Number.")
          // }

          //**TODO - Make Dynamic **/
          if(amount1 > walletBalances[0]) throw Error(`Only ${walletBalances[0]} ${stakedSymbols[0].symbol} Available to Stake.`)
          if(amount2 > walletBalances[1]) throw Error(`Only ${walletBalances[1]} ${stakedSymbols[1].symbol} Available to Stake.`)


          /** TODO - make dynamic **/
          if(!isNaN(parseFloat(amount1)) && !isNaN(parseFloat(amount2))) {

            const transactions: Transaction[] = [];

            transactions.unshift({
              receiverId: poolParams.cheddarContract.contractId,
              functionCalls: [
                {
                  methodName: 'ft_transfer_call',
                  args: {
                    receiver_id: poolParams.contract.contractId,
                    amount: convertToBase(amount1, poolParams.metaData.decimals.toString()),
                    msg: 'to farm',
                  },
                  amount: new BN(utils.format.parseNearAmount('0.000000000000000000000001')),
                  gas: new BN('100000000000000'),
                },
              ],
            });

            transactions.unshift({
                receiverId: poolParams.tokenContract.contractId,
                functionCalls: [
                  {
                    methodName: 'ft_transfer_call',
                    args: {
                      receiver_id: poolParams.contract.contractId,
                      amount: convertToBase(amount2, poolParams.metaData2.decimals.toString()),
                      msg: 'to farm',
                    },
                    amount: new BN(utils.format.parseNearAmount('0.000000000000000000000001')),
                    gas: new BN('100000000000000'),
                  },
                ],
            });

            const currentTransactions = await Promise.all(
              transactions.map((t, i) => {
                return setupTransaction({
                    receiverId: t.receiverId,
                    nonceOffset: i + 1,
                    actions: t.functionCalls.map((fc) =>
                      functionCall(
                        fc.methodName,
                        fc.args,
                        fc.gas,
                        fc.amount
                      )
                    ),
                  });
                })
              );

            requestSignTransOptions = currentTransactions

            nearWebWalletConnection.requestSignTransactions(requestSignTransOptions);

          } else {

            /** TODO - make dynamic **/
            if(!isNaN(parseFloat(amount1))) {

              if(isNaN(parseFloat(amount1)))
                throw Error("Please Input a Number.")

              await poolParams.tokenContract.ft_transfer_call(poolParams.contract.contractId,convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()), "to farm")

            } else if(!isNaN(parseFloat(amount2))) {

              if(isNaN(parseFloat(amount2)))
              throw Error("Please Input a Number.")

              await poolParams.cheddarContract.ft_transfer_call(poolParams.contract.contractId,convertToBase(amount2.toString(), poolParams.metaData2.decimals.toString()), "to farm")

            }
          }

        } else {

        const stakedDisplayable = Number(convertToDecimals(staked.toString(), poolParams.metaData.decimals, 5))

        if(isNaN(parseFloat(amount1))) throw Error("Please Input a Number.")

        if(amount1 > stakedDisplayable) throw Error(`Unstake at most ${stakedDisplayable} ${poolParams.metaData.symbol}`);

        // amount = 1000000000000000000000000
        await poolParams.contract.unstake(convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()))
        }
      }

    } else if (isHarvest) {
      
      amount = poolParams.resultParams.getCurrentCheddarRewards()
      //if (BigInt(convertToBase(amount1.toString(), poolParams.metaData.decimals.toString())) <= BigInt(0)) throw Error("No Cheddar to Harvest. 😞")
      await poolParams.contract.withdraw_crop()

    } else /** UNSTAKING **/ {

      const staked = poolParams.resultParams.staked

      /** TODO - make dynamic **/
      if(Array.isArray(staked)){

        /** TODO - make dynamic **/
        if(amount1 > staked[0]) throw Error(`Only ${staked[0]} ${stakedSymbols[0].symbol} Available to UnStake.`)
        if(amount2 > staked[1]) throw Error(`Only ${staked[1]} ${stakedSymbols[1].symbol} Available to UnStake.`)

        /** TODO - make dynamic **/
        if(!isNaN(parseFloat(amount1)) && !isNaN(parseFloat(amount2))) {

          const transactions: Transaction[] = [];

          transactions.unshift({
            receiverId: poolParams.contract.contractId,
            functionCalls: [
              {
                methodName: 'unstake',
                args: {
                  token: poolParams.tokenContract.contractId,
                  amount: convertToBase(amount1, poolParams.metaData.decimals.toString()),
                  msg: 'unstake from farm',
                },
                amount: new BN(utils.format.parseNearAmount('0.000000000000000000000001')),
                gas: new BN('100000000000000'),
              },
            ],
          });

          transactions.unshift({
              receiverId: poolParams.contract.contractId,
              functionCalls: [
                {
                  methodName: 'unstake',
                  args: {
                    token: poolParams.cheddarContract.contractId,
                    amount: convertToBase(amount2, poolParams.metaData2.decimals.toString()),
                    msg: 'unstake from farm',
                  },
                  amount: new BN(utils.format.parseNearAmount('0.000000000000000000000001')),
                  gas: new BN('100000000000000'),
                },
              ],
          });

          const currentTransactions = await Promise.all(
            transactions.map((t, i) => {
              return setupTransaction({
                  receiverId: t.receiverId,
                  nonceOffset: i + 1,
                  actions: t.functionCalls.map((fc) =>
                    functionCall(
                      fc.methodName,
                      fc.args,
                      fc.gas,
                      fc.amount
                    )
                  ),
                });
              })
            );

          requestSignTransOptions = currentTransactions

          nearWebWalletConnection.requestSignTransactions(requestSignTransOptions);

        } else {

          /** TODO - make dynamic **/
          if(!isNaN(parseFloat(amount1))) {

            if(isNaN(parseFloat(amount1))) throw Error("Please Input a Number.")

            await poolParams.contract.unstake(poolParams.tokenContract.contractId, convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()))

          } else if(!isNaN(parseFloat(amount2))) {

            if(isNaN(parseFloat(amount2))) throw Error("Please Input a Number.")

            await poolParams.contract.unstake(poolParams.cheddarContract.contractId, convertToBase(amount2.toString(), poolParams.metaData2.decimals.toString()))
          }
        }

      } else {
        const stakedDisplayable = Number(convertToDecimals(staked.toString(), poolParams.metaData.decimals, 5))

        //if(amount > stakedDisplayable) throw Error(`Stake at most ${stakedDisplayable} ${poolParams.metaData.symbol}`);

        if(amount1 > stakedDisplayable) throw Error(`No ${poolParams.metaData.symbol} Staked.`);

        if(isNaN(parseFloat(amount1)))
                throw Error("Please Input a Number.")

        // amount = 1000000000000000000000000
        await poolParams.contract.unstake(convertToBase(amount1.toString(), poolParams.metaData.decimals.toString()))

      }

    }

    //clear form
    form.reset()

    //refresh acc info
    await refreshPoolInfo(poolParams)

    //**TODO - Make Dynamic **/
    showSuccess((isStaking ? "Staked " : isHarvest ? "Harvested " : "Unstaked ") + toStringDecMin(amount1) + (isHarvest ? " CHEDDAR" : " " + poolParams.metaData.symbol))
    
    if (isHarvest) {
      poolParams.resultParams.computed = 1n
      poolParams.resultParams.real = 1n
      qsInnerText("#" + poolParams.html.id + " #cheddar-balance", "0")

    }
    else if (isStaking) {
      poolParams.resultParams.addStaked(ntoy(amount1));
    }
    else {
      poolParams.resultParams.addStaked(ntoy(-amount1));
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

  console.log(nearConnectedWalletAccount)


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
  document.querySelector("#circulatingSupply span")!.innerHTML =  "Circulating Supply:&nbsp;" + toStringDec(yton(circulatingSupply)).split('.')[0];
  
  try {

    if (isOpened && wallet.isConnected()) {

      let accountInfo = await poolParams.contract.status(accName)
      poolParams.setStatus(accountInfo)

      if(poolParams.type == "multiple") {

        qsa(".pool-meta.staked").forEach((element,index) => {
          element!.style.display = 'flex';
        })

        qsa(".pool-meta.staked.amount").forEach((element,index) => {

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

      if(Array.isArray(walletBalances)){

        //console.log(walletBalances)

        qsa("#wallet-available span.near.balance").forEach((element,index) => {

          //console.log(index)
          //console.log(walletBalances[index].toString())

          if(walletBalances[index]) {

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
      if(poolParams.type == "multiple") {
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

async function refreshPoolInfo(poolParams: PoolParams) {
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
  if(poolParams.type == "multiple") {

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


  if(walletBalances) {

    if(Array.isArray(walletBalances)){

      qsa("#wallet-available span.near.balance").forEach((element,index) => {

        if(walletBalances[index]) {

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
  }
  
  //update account & contract stats
  if (wallet.isConnected()) {
    let metaData = await poolParams.metaData;
    
    let contractParams = await poolParams.contract.get_contract_params()
    console.log(contractParams)


    /*** Workaround Free Community Farm pool ***/
    let rewardsPerDay = 0

    if(contractParams.farming_rate){
      rewardsPerDay = BigInt(contractParams.farming_rate) * BigInt(60 * 24)
    }
    else if(contractParams.farm_token_rates) {
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

    if(contractParams.total_staked){
      if(Array.isArray(contractParams.total_staked)) {
        totalStaked = contractParams.total_staked[0]
        //console.log(totalStaked)
      }
      else if(contractParams.farm_token_rates) {
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

    if(contractParams.total_farmed){
      totalFarmed = contractParams.total_farmed
    }
    else {
      totalFarmed = contractParams.total_rewards
    }

    if(qs("#" + poolParams.html.id + " #pool-stats #total-staked")) {

        /** TODO - make dynamic **/
      if(Array.isArray(contractParams.total_staked)) {
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
  let poolType = poolParams.type
  let accName = poolParams.resultParams.accName
  var metaData = poolParams.metaData;
  var metaData2 = poolParams.metaData2;
  var contractParams = poolParams.contractParams;
  var accountInfo = await poolParams.contract.status(accName);

  //console.log(poolType)

  //console.log(accountInfo)
  if(accountInfo) {
    //poolParams.resultParams.staked = BigInt(accountInfo[0])

    if(poolParams.type == "multiple") {

      poolParams.resultParams.staked = (accountInfo) ? accountInfo.stake_tokens : 0;
      poolParams.resultParams.real = BigInt(accountInfo.farmed)
      poolParams.resultParams.previous_real = BigInt(accountInfo.farmed)
      poolParams.resultParams.computed = BigInt(accountInfo.farmed)
      poolParams.resultParams.previous_timestamp = Number(accountInfo.timestamp)

    } else {
      
      poolParams.resultParams.staked = (accountInfo) ? BigInt(accountInfo[0]) : 0;
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
  newPool.querySelector("#token-header span.name")!.innerHTML = metaData.name;
  newPool.querySelector(".pool-meta #percetage")!.innerHTML = (contractParams.fee_rate) ? contractParams.fee_rate/100 + "%" : "0%"

  let iconElem = newPool.querySelector("#token-header img")

  /*** Workaround Free Community Farm pool ***/
  if(poolParams.html.formId == 'near' || poolParams.html.formId == 'nearcon') {
    //Skip do nothing with icon use default NEAR icon
  } else if(metaData.icon != null) {
    iconElem!.setAttribute("src", metaData.icon || "");
  } else {
    var iconImage = document.createElement('span');
    iconImage.classList.add('icon');
    iconElem?.parentNode?.replaceChild(iconImage, iconElem);
  }

  newPool.querySelectorAll(".name").forEach(element => {

    /*** Workaround Free Community Farm pool ***/
    if(poolParams.html.formId == 'near') {
      element.innerHTML = 'NEAR (FREE FARM)'
    } else if(poolParams.html.formId == 'nearcon') {
      element.innerHTML = 'CHEDDAR (NEARCON)'
    } else {
      //console.log(metaData)
      element.innerHTML = metaData.symbol
    }
    
  })

  let unixTimestamp = new Date().getTime() / 1000; //unix timestamp (seconds)
  const isDateInRange = (contractParams.farming_start < unixTimestamp || contractParams.farming_start > unixTimestamp)  && unixTimestamp < contractParams.farming_end
  newPool.querySelector("#poolOpen span")!.innerHTML = (!isDateInRange) ? "CLOSED" : "OPEN"

  newPool.querySelectorAll("#stake").forEach(element => {
      element.disabled = (!isDateInRange) ? true : false
  })

  newPool.querySelectorAll(".amount input-box nea").forEach(element => {
      element.disabled = (!isDateInRange && poolParams.stak) ? true : false
  })

  newPool.querySelectorAll(".token-name").forEach(element => {

    /*** Workaround Free Community Farm pool ***/
    if(poolParams.html.formId == 'near' || poolParams.html.formId == 'nearcon') {
      element.innerHTML = 'NEAR'
    } else if(element.parentNode.id  == "secondStakeAmount") {
      element.innerHTML = metaData2.symbol
    } else {
      element.innerHTML = metaData.symbol
    }

  })

  // newPool.querySelectorAll("#" + poolParams.html.formId +  " .token-name")!.innerHTML = metaData.symbol;
  newPool.querySelector("#farming_start")!.innerHTML = new Date(contractParams.farming_start * 1000).toLocaleString()
  newPool.querySelector("#farming_end")!.innerHTML = new Date(contractParams.farming_end * 1000).toLocaleString()

  const stakedDisplayable = convertToDecimals(poolParams.resultParams.staked.toString(), metaData.decimals, 7)
  newPool.querySelector("#near-balance span.near.balance")!.innerHTML = stakedDisplayable

  if(Number(stakedDisplayable) > 0) {
    let elem = newPool.querySelector("#near-balance a .max") as HTMLElement
    elem.style.display = "block";

    elem.addEventListener("click", maxUnstakeClicked(newPool))
  }

  let humanReadableRealRewards = yton(poolParams.resultParams.real.toString()).toString()
  newPool.querySelector("#cheddar-balance")!.innerHTML = convertToDecimals(humanReadableRealRewards, metaData.decimals, 7);

  const walletBalances = await poolParams.getWalletAvailable()
  //update shown wallet balance
  
  /** TODO - make dynamic **/
  if(Array.isArray(walletBalances)){

    if(poolParams.type == "multiple") {

      newPool.querySelectorAll(".pool-meta.staked").forEach((element,index) => {
        element!.style.display = 'flex';
      })

      newPool.querySelectorAll(".pool-meta.staked.amount").forEach((element,index) => { 
        element!.style.display = 'flex';
        element!.innerText = convertToDecimals(poolParams.resultParams.staked[index].toString(), poolParams.metaData.decimals, 7)

      })

    } else {
      let stakedWithDecimals = convertToDecimals(poolParams.resultParams.staked.toString(), poolParams.metaData.decimals, 7)
      qsInnerText("#" + poolParams.html.id + " #near-balance span.near.balance", stakedWithDecimals)
    }

    newPool.querySelectorAll(".input-group").forEach((element,index) => {
      element!.style.display = 'flex';
    })

    newPool.querySelectorAll("#wallet-available span.near.balance").forEach((element,index) => {

      element!.innerHTML = removeDecZeroes(walletBalances[index].toString());
      //console.log(element!.innerHTML)

      if (Number(walletBalances[index].toString().replace(".", "")) > 1) {
        let elems = newPool.querySelectorAll("#wallet-available a .max")
        let elem = elems[index] as HTMLElement
        //console.log(elem)
        elem.style.display = "block";

        elem.addEventListener("click", maxStakeClicked(newPool))
      }
    })

  } else {

    newPool.querySelector("#wallet-available span.near.balance")!.innerHTML = removeDecZeroes(walletBalances.toString());

    if (Number(walletBalances.toString().replace(".", "")) > 1) {
      let elem = newPool.querySelector("#wallet-available a .max") as HTMLElement
      elem.style.display = "block";

      elem.addEventListener("click", maxStakeClicked(newPool))
    }
  }

  if(contractParams.total_staked){

    if(Array.isArray(contractParams.total_staked)) {
      newPool.querySelector("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_staked[0], metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
      newPool.querySelector("#pool-stats #total_staked_1")!.style.display = "flex"
      newPool.querySelector("#pool-stats #total-staked1")!.innerHTML = convertToDecimals(contractParams.total_staked[1], metaData2.decimals, 5) + " " + metaData2.symbol.toUpperCase()
    }
    else {
      newPool.querySelector("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_staked, metaData.decimals, 5) + " " + metaData.symbol.toUpperCase()
    }

  } else {
      newPool.querySelector("#pool-stats #total-staked")!.innerHTML = convertToDecimals(contractParams.total_stake, metaData.decimals, 5) + " " + "NEAR"
  }

  // if(contractParams.accounts_registered) {
  //   newPool.querySelector("#accounts")!.innerHTML = contractParams.accounts_registered
  // } else {
  //   newPool.querySelector("#accounts")!.innerHTML = "Not Available"
  // }

  let rewardsPerDay = ""

  if(contractParams.farming_rate) {
    rewardsPerDay = BigInt(contractParams.farming_rate) * BigInt(60 * 24)
  } else if(contractParams.farm_token_rates) {
    rewardsPerDay = BigInt(contractParams.farm_token_rates)
  } else {
    rewardsPerDay = BigInt(contractParams.rewards_per_day)
  }

  newPool.querySelector("#pool-stats #rewards-per-day")!.innerHTML = yton(rewardsPerDay.toString()).toString();

  if(contractParams.total_farmed){
    //console.log(metaData.decimals)
    newPool.querySelector("#pool-stats #total-rewards")!.innerHTML = convertToDecimals(contractParams.total_farmed, 24, 5)
  } else {
    newPool.querySelector("#pool-stats #total-rewards")!.innerHTML = convertToDecimals(contractParams.total_rewards, 24, 5)
  }



  let accountRegistered = null

  /*** Workaround Free Community Farm pool ***/
  if(poolParams.html.formId == "nearcon" || poolParams.html.formId == "cheddar") {
    //console.log("NEARCON")
    accountRegistered = await poolParams.tokenContract.storageBalance();
  } else if(contractParams.farming_rate){
    accountRegistered = await poolParams.contract.storageBalance();
  } else if(contractParams.farm_token_rates){
    accountRegistered = await poolParams.contract.storageBalance();
  } else {
    accountRegistered = 0
  }
  
  if(accountRegistered == null) {

    //console.log(poolParams.html.formId)

    if(isDateInRange) {
      newPool.querySelector("#deposit")!.style.display = "block"
      newPool.querySelector("#activated")!.style.display = "none"
      newPool.querySelector(".activate")?.addEventListener("click", depositClicked(poolParams, newPool));
    }
    else if(poolParams.html.formId == "nearcon" || poolParams.html.formId == "cheddar") {

      //console.log("IS NEARCON")

      newPool.querySelector("#deposit")!.style.display = "block"
      newPool.querySelector("#activated")!.style.display = "none"
      newPool.querySelector(".activate")?.addEventListener("click", depositClicked(poolParams, newPool));

      newPool.querySelector("#depositWarning")!.innerHTML = "ONLY ACTIVATE IF PREVIOUSLY STAKED<br>0.05 NEAR storage deposit, gets refunded."

    }
    else{
      newPool.querySelector("#deposit")!.style.display = "none"
      newPool.querySelector("#activated")!.style.display = "block"
      newPool.querySelector("#harvest")?.addEventListener("click", harvestClicked(poolParams, newPool));
      newPool.querySelector("#unstake")?.addEventListener("click", unstakeClicked(poolParams, newPool));
    }

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

  poolParams.setTotalRewardsPerDay();

  if(!isPaused){
    setInterval(refreshRewardsDisplayLoopGeneric.bind(null, poolParams, metaData.decimals), 200);
    setInterval(refreshRealRewardsLoopGeneric.bind(null, poolParams, metaData.decimals), 60 * 1000);
  }
}

function maxStakeClicked(pool: HTMLElement) {
  return function(event: Event) {
    event.preventDefault()

    const idIndex = event.path[0].id.split("max")
    const parent = pool.querySelector("#" + event.path[0].id).parentNode.parentNode
    const amountContainer = parent.querySelector("span.near.balance")

    if(amountContainer) {
      const amount = amountContainer.innerHTML
      let input = pool.querySelector("#stakeAmount" + idIndex[1]) as HTMLInputElement
      input.value = amount.toString()
    }

  }
}

function maxUnstakeClicked(pool: HTMLElement) {
  return function(event: Event) {
    event.preventDefault()

    const idIndex = event.path[0].id.split("max")
    const parent = pool.querySelector("#" + event.path[0].id).parentNode.parentNode
    const amountContainer = parent.querySelector("span.near.balance")

    if(amountContainer) {
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
  for(let i = 0; i < poolList.length; i++) {

    var accName = poolList[i].contract.wallet.getAccountId();
    var accountInfo = await poolList[i].contract.status(accName);

    if(window.localStorage.getItem("onlyStaked") === 'true' && accountInfo[0] > 0) {
      await addPool(poolList[i]);
    } else if(window.localStorage.getItem("onlyStaked") === 'false'){
      await addPool(poolList[i]);
    }
    
  }




  qs("#pool_list").style.display = "grid"

  //console.log(qs("#pool_list").childElementCount)
  if(qs("#pool_list").childElementCount == 0) {
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

      if(window.localStorage.getItem("onlyStaked")) {
        //console.log(window.localStorage.getItem("onlyStaked"))
        document.getElementById("switch").checked = window.localStorage.getItem("onlyStaked") === 'true';
      }
      else {
        console.log(window.localStorage.getItem("onlyStaked"))
        window.localStorage.setItem("onlyStaked", false)
        document.getElementById("switch").checked = false;
      }

    if (nearWebWalletConnection.isSignedIn()) {
      //already signed-in with NEAR Web Wallet
      //make the contract use NEAR Web Wallet
      wallet = new NearWebWallet(nearWebWalletConnection);
      
      await signedInFlow(wallet)
      accountName = wallet.getAccountId()
      const cheddarContractName = (ENV == 'mainnet') ? CHEDDAR_CONTRACT_NAME : TESTNET_CHEDDAR_CONTRACT_NAME
      const cheddarContract = new NEP141Trait(cheddarContractName);
      cheddarContract.wallet = wallet;
      const cheddarBalance = await cheddarContract.ft_balance_of(accountName)
      const amountAvailable = toStringDec(yton(await wallet.getAccountBalance()))
      qsInnerText("#my-account #wallet-available", amountAvailable)
      qsInnerText("#my-account #cheddar-balance", convertToDecimals(cheddarBalance, 24, 5))

      let circulatingSupply = await cheddarContract.ft_total_supply()
      document.querySelector("#circulatingSupply span")!.innerHTML =  "Circulating Supply:&nbsp;" + toStringDec(yton(circulatingSupply)).split('.')[0];

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
          //console.log("poolList[i].contract.contractId: ", poolList[i].contract.contractId)
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
          var message = yton(log[3]) + ' Cheddar Harvested!'
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
            //console.log("Receiver: ", receiver)
            //console.log("Length: ", poolList.length)
            // if(receiver) {
            for(let i = 0; i < poolList.length; i++) {
              //console.log("poolList[i].tokenContract.contractId: ", poolList[i].tokenContract.contractId)
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
            /** TODO - Fix for mutliple transactions **/
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