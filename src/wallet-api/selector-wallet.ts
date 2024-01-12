import {WalletInterface, EventHandler} from "./wallet-interface"
import {BatchTransaction} from "./batch-transaction"
import {U64String,U128String, DEFAULT_GAS} from "./util"

import { providers, WalletConnection } from "near-api-js";
import { getTransactionLastResult, JsonRpcProvider } from "near-api-js/lib/providers";
import BN from 'bn.js'; //WARN: It has to be the same bn.js version as near-api-js
import { Action, WalletSelector } from "@near-wallet-selector/core";
import { ENV, getConfig } from "../config";
import { Transaction } from "near-api-js/lib/transaction";
import { wallet } from "..";

//-----------------------------
// WalletInterface implementation
// for the NEAR Web Wallet
//-----------------------------
export class SelectorWallet implements WalletInterface {
    
    provider = new providers.JsonRpcProvider({url: getConfig(ENV).nodeUrl,});

    constructor (
        public walletSelector: WalletSelector,
    )
    {}

    getAccountId():string{
        return this.walletSelector.store.getState().accounts.find(account=>account.active)?.accountId || ""
    }

    getDisplayableAccountId(): string {
        const accName = this.getAccountId()
        return accName.length > 22 ? accName.slice(0, 10) + ".." + accName.slice(-10) : accName
    }

    async getAccountBalance():Promise<U128String> {
          
        const accountId = this.getAccountId()    
        
        if(!accountId){
            return "0"
        }
            
        const response: any = await this.provider.query({
            request_type: "view_account",
            finality: "final",
            account_id: accountId,
        });
            
        return response ? response.amount : response.error.data;
    }

    getNetwork(){ 
        return this.walletSelector.options.network.networkId
    }

    setNetwork(value:string){ 
        throw Error("can't change networkId")
    }

    isConnected() {
        return this.walletSelector.isSignedIn()
    }
   
    disconnect(){
        this.walletSelector.wallet().then(wallet=>wallet.signOut()); 
    }

    connectionHelp(){
        window.open("https://wallet.near.org/")
    }

    /**
     * isConnected or throws "wallet not connected"
     */
    checkConnected() {
        if (!this.walletSelector.isSignedIn()) {
            throw Error("Wallet is not connected")
        }
    }

    /**
     * Just a single contract "view" call
     */
    async view(
        contract: string,
        method: string,
        args: Record<string, any>
      ): Promise<any> {
        try {
          const argsAsString = JSON.stringify(args);
          let argsBase64 = Buffer.from(argsAsString).toString("base64");
          const rawResult = await this.provider.query({
            request_type: "call_function",
            account_id: contract,
            method_name: method,
            args_base64: argsBase64,
            finality: "optimistic",
          });
    
          // format result
          // @ts-ignore
          const res = JSON.parse(Buffer.from(rawResult.result).toString());
          return res;
        } catch (err) {
          console.error(
            `Error calling function ${method} from contract ${contract} with params ${JSON.stringify(
              args
            )}`,
            err
          );
        }
      }

    /**
     * A single contract "payable" fn call
     */
    async call(
        contract: string,
        method: string,
        args: Record<string, any>,
        gas?: string | undefined,
        attachedYoctos?: string | undefined
      ): Promise<any> {
        console.log(`Calling ${contract}'s method ${method}`);
        const accountId = this.getAccountId();
        const wallet = await this.walletSelector.wallet();
        const action: Action[] = [
          {
            type: "FunctionCall",
            params: {
              methodName: method,
              args: args,
              gas: gas ?? "40000000000000", ////Gas.parse("40 Tgas"),
              deposit: attachedYoctos ?? "1",
            },
          },
        ];
    
        const params: any = {
          signerId: accountId!,
          receiverId: contract,
          actions: action,
        };
        const tx = wallet.signAndSendTransaction(params);
        const finalExecOut = await tx;
        console.log("FinalExecOut", finalExecOut);
        return tx;
      }
     

    /**
     * ASYNC. sends a BatchTransaction to the blockchain
     */
    async apply (bt:BatchTransaction):Promise<any>{
        //TODO - implement BatchTransactions
        throw Error("Not implemented");
    }

    /**
     * ASYNC, low level generic access
     */
    async queryChain(method: string, args: object): Promise<any> {
        return this.provider.sendJsonRpc(method,args);
    }

    async requestSignTransactions(transactions: Transaction[], callbackUrl?: string | undefined, meta?: string | undefined): Promise<void>{
        throw Error("Not implemented");
    }

}
