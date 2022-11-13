import {WalletInterface, EventHandler} from "../wallet-interface"
import {BatchTransaction} from "../batch-transaction"
import {U64String,U128String, DEFAULT_GAS} from "../util"

import { WalletConnection } from "near-api-js";
import { getTransactionLastResult, JsonRpcProvider } from "near-api-js/lib/providers";
import BN from 'bn.js'; //WARN: It has to be the same bn.js version as near-api-js

//-----------------------------
// WalletInterface implementation
// for the NEAR Web Wallet
//-----------------------------
export class NearWebWallet implements WalletInterface {
    
    constructor (
        public walletConnection: WalletConnection,
    )
    {}

    getAccountId():string{
        return this.walletConnection.getAccountId();
    }

    getDisplayableAccountId(): string {
        const accName = this.getAccountId()
        return accName.length > 22 ? accName.slice(0, 10) + ".." + accName.slice(-10) : accName
    }

    async getAccountBalance(accountId?:string):Promise<U128String> {
        const data = await this.walletConnection.account().getAccountBalance();
        return data.total;
    }

    getNetwork(){ return this.walletConnection._near.connection.networkId}

    setNetwork(value:string){ throw Error("can't change networkId")}

    isConnected() {
        return this.walletConnection.isSignedIn()
    }
   
    disconnect(){
        this.walletConnection.signOut(); 
    }

    connectionHelp(){
        window.open("https://wallet.near.org/")
    }

    /**
     * isConnected or throws "wallet not connected"
     */
    checkConnected() {
        if (!this.walletConnection.isSignedIn()) {
            throw Error("Wallet is not connected")
        }
    }

    /**
     * Just a single contract "view" call
     */
    async view (contract:string, method:string, args:Record<string,any>):Promise<any>{
        return this.walletConnection.account().viewFunction(contract, method, args);
    }

    /**
     * A single contract "payable" fn call
     */
    async call(contract:string, method:string, args:Record<string,any>, gas?:U64String, attachedYoctos?:U128String):Promise<any>{
        //clear SearchURL before calling to not mix old results with new ones
        window.history.replaceState({}, '', location.pathname)
        const finalExecOutcome = await this.walletConnection.account().functionCall(contract, method, args, new BN(gas||DEFAULT_GAS), new BN(attachedYoctos||"0"));
        return getTransactionLastResult(finalExecOutcome);
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
        const provider = this.walletConnection._connectedAccount.connection.provider as JsonRpcProvider 
        return provider.sendJsonRpc(method,args);
    }

}
