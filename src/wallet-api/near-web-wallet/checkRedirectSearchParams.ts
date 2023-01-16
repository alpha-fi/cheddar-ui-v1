
// Calling contract methods with attachedDeposit causes a redirect to NEAR Wallet.
// later the wallet redirects the browser back to this app, adding 2 params in URLSearchParams
// ?transactionHashes=xxxxx & errorCode=eeeee
// this fn must be called to check if we're re-spawning from a wallet redirect
// to obtain transaction result information
// check if (`err`) and if not you can get function call result with `data`, and full-tx-result with `finalExecutionOutcome`

import { utils, WalletConnection } from 'near-api-js'
import { FinalExecutionOutcome, getTransactionLastResult } from "near-api-js/lib/providers"
import { FunctionCall } from 'near-api-js/lib/transaction'
import { parseRpcError } from 'near-api-js/lib/utils/rpc_errors'

function removeQueryString(){
  var uri = window.location.toString();
  if (uri.indexOf("?") > 0) {
      var clean_uri = uri.substring(0, uri.indexOf("?"));
      window.history.replaceState({}, document.title, clean_uri);
  }    
}

export async function checkRedirectSearchParams( walletConnection:WalletConnection, nearExplorerUrl:string ): 
  Promise<{err?:string, data?:any, method?:string, finalExecutionOutcome?:FinalExecutionOutcome }> {

  try {
    const urlParams = new URLSearchParams(window.location.search)
    removeQueryString()
    const txHash = urlParams.get('transactionHashes')
    const errorCode = urlParams.get('errorCode')

    if (errorCode) {
      // If errorCode, then the redirect succeeded but the tx was rejected/failed
      const newError = 'Error from wallet: ' + errorCode
      console.error(newError)
      return {
        err: newError
      }
    }

    if (!txHash) return {};

    if (txHash.includes(',')) {
      // NOTE: when a single tx is executed, transactionHashes is equal to that hash
      const newError = 'Expected single txHash, got: ' + txHash
      console.error(newError)
      return {
        err: newError
      }
    }

    const decodedTxHash = utils.serialize.base_decode(txHash)
    const finalExecOutcome = await walletConnection.account().connection.provider.txStatus( decodedTxHash, walletConnection.getAccountId());

    let method:string|undefined = undefined;
    if (finalExecOutcome.transaction?.actions?.length){
      const actions=finalExecOutcome.transaction.actions
      //recover methodName of first FunctionCall action
      for(let n=0;n<actions.length;n++) {
        let item = actions[n]
        if ("FunctionCall" in item) {
          //@ts-ignore
          method = item.FunctionCall.method_name
          break;
        }
      }
    }

    //@ts-ignore
    let failure:any=finalExecOutcome.status.Failure
    if (failure) {
      console.error('finalExecOutcome.status.Failure', failure)
      const errorMessage = typeof failure === 'object' ? parseRpcError(failure).toString()
          : `Transaction <a href="${nearExplorerUrl}/transactions/${finalExecOutcome.transaction.hash}">${finalExecOutcome.transaction.hash}</a> failed`

      return {
        err: errorMessage,
        method:method,
      }
    }

    return {
      data: getTransactionLastResult(finalExecOutcome),
      method:method,
      finalExecutionOutcome: finalExecOutcome 
    }

  }
  catch(ex){
    console.error(ex.message);
    return { err: ex.message};
  }
}

  export async function checkRedirectSearchParamsMultiple( walletConnection:WalletConnection, nearExplorerUrl:string ): 
  Promise<{err?:string, data?:any, method?:string, finalExecutionOutcome?:FinalExecutionOutcome }[]> {

  try {
    const urlParams = new URLSearchParams(window.location.search)
    removeQueryString()
    const txHash: string|null = urlParams.get('transactionHashes')
    const errorCode = urlParams.get('errorCode')

    if (errorCode) {
      // If errorCode, then the redirect succeeded but the tx was rejected/failed
      const newError = 'Error from wallet: ' + errorCode
      console.error(newError)
      return [{
        err: newError
      }]
    }

    if (!txHash) return [];

    let transactionArray: string[]

    if (txHash.includes(',')) {
      // NOTE: when a single tx is executed, transactionHashes is equal to that hash
      transactionArray = txHash.split(",")
      // const newError = 'Expected single txHash, got: ' + txHash
      // console.error(newError)
      // return {
      //   err: newError
      // }
    } else {
      transactionArray = [ txHash ]
    }
    // [1, 3, 6].map(i => i + 3) --> [4, 6, 9]
    const decodedTxHashArray = transactionArray.map(hash => utils.serialize.base_decode(hash))   
    const finalExecOutcomeArray = await Promise.all(decodedTxHashArray.map(async (decodedTxHash) => {
      return await walletConnection.account().connection.provider.txStatus( decodedTxHash, walletConnection.getAccountId());
    }))

    let output = []

    for(let i = 0; i < finalExecOutcomeArray.length; i++) {
      let method:string|undefined = undefined;
      const finalExecOutcome = finalExecOutcomeArray[i]
      if (finalExecOutcome.transaction?.actions?.length){
        const actions=finalExecOutcome.transaction.actions
        //recover methodName of first FunctionCall action
        for(let n=0;n<actions.length;n++) {
          let item = actions[n]
          if ("FunctionCall" in item) {
            //@ts-ignore
            method = item.FunctionCall.method_name
            break;
          }
        }
      }

      //@ts-ignore
      let failure:any=finalExecOutcome.status.Failure
      if (failure) {
        console.error('finalExecOutcome.status.Failure', failure)
        const errorMessage = typeof failure === 'object' ? parseRpcError(failure).toString()
            : `Transaction <a href="${nearExplorerUrl}/transactions/${finalExecOutcome.transaction.hash}">${finalExecOutcome.transaction.hash}</a> failed`
        output.push(
          {
            err: errorMessage,
            method:method,
          }
        )
      } else {
        output.push(
          {
            data: getTransactionLastResult(finalExecOutcome),
            method:method,
            finalExecutionOutcome: finalExecOutcome 
          }
        )
      }
    }
    
    return output
  }
  catch(ex){
    console.error(ex.message);
    return [{ err: ex.message}];
  }

}
