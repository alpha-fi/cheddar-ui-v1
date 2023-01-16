import {WalletInterface} from "./wallet-interface"
import {U64String,U128String} from "./util"
import {BatchTransaction} from "./batch-transaction"
import { Transaction } from "near-api-js/lib/transaction";

const NOT_CONNECTED="Connect to NEAR";

// -----------------------------
// Default disconnected wallet
// SmartContract proxies start with this dummy wallet until the user chooses a wallet
// -----------------------------
export class DisconnectedWallet implements WalletInterface {

    requestSignTransactions(transactions: Transaction[], callbackUrl?: string, meta?: string): Promise<void>;
    requestSignTransactions(options: RequestSignTransactionsOptions): Promise<void>;
    requestSignTransactions(transactions: any, callbackUrl?: any, meta?: any): Promise<void> {
        return Promise.resolve()
    }
    
    getAccountId():string{ return NOT_CONNECTED }
    getDisplayableAccountId(): string {
        return this.getAccountId()
    }

    async getAccountBalance(accountId?:string):Promise<U128String>{ return "0"};

    getNetwork(){ return NOT_CONNECTED }

    setNetwork(value:string){ throw Error("can't change network")}

    // Note: Connection is started from the chrome-extension, so web pages don't get any info before the user decides to "connect"
    // Also pages don't need to create buttons/options to connect to different wallets, as long all wallets connect with Dapp-pages by using this API
    // potentially, a single DApp can be used to operate on multiple chains, since all requests are high-level and go thru the chrome-extension

    isConnected() { return false}
   
    disconnect(){ };

    connectionHelp(){ window.open("https://wallet.near.org/") }

    /**
     * isConnected or throws "wallet not connected"
     */
    checkConnected() { throw Error(NOT_CONNECTED) }

    /**
     * Just a single contract "view" call
     */
    async view (contract:string, method:string, args:Record<string,any>):Promise<any>{
        throw Error(NOT_CONNECTED) 
    }

    /**
     * A single contract "payable" fn call
     */
    async call(contract:string, method:string, args:Record<string,any>, gas?:U64String, attachedYoctos?:U128String):Promise<any>{
        throw Error(NOT_CONNECTED) 
    }

    /**
     * ASYNC. sends a BatchTransaction to the blockchain
     */
    async apply (bt:BatchTransaction):Promise<any>{
        throw Error(NOT_CONNECTED) 
    }

    /**
     * ASYNC, low level generic access
     */
    queryChain(method: string, args: object): Promise<any> {
        throw Error(NOT_CONNECTED) 
    }

}

//export singleton
export const disconnectedWallet = new DisconnectedWallet();
