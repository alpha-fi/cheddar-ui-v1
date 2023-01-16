import {WalletInterface} from "./wallet-interface"
import {U64String,U128String} from "./util"
import {disconnectedWallet} from "./disconnected-wallet";
import * as nearAPI from "near-api-js"
import { near, nearConfig } from "..";
import { JsonRpcProvider } from "near-api-js/lib/providers";

//-----------------------------
// Base smart-contract proxy class
// provides constructor, view & call methods
// derive your specific contract proxy from this class
//-----------------------------
export class SmartContract {
    
    public wallet:WalletInterface;
    public nearWallet: nearAPI.WalletConnection;
    public account: nearAPI.ConnectedWalletAccount
    public provider: JsonRpcProvider

    constructor( 
        public contractId:string, 
    )
    {
        this.wallet = disconnectedWallet; //default wallet is DisconnectedWallet
        this.nearWallet = new nearAPI.WalletAccount(near, null)
        this.account = this.nearWallet.account()
        this.provider = new JsonRpcProvider(nearConfig.nodeUrl)
    }

    async viewWithoutAccount(method: string, args: any = {}): Promise<any> {
        try {
            const argsAsString = JSON.stringify(args)
            let argsBase64 = Buffer.from(argsAsString).toString("base64")
            const rawResult = await this.provider.query({
                request_type: "call_function",
                account_id: this.contractId,
                method_name: method,
                args_base64: argsBase64,
                finality: "optimistic",
            });
        
            // format result
            const res = JSON.parse(Buffer.from(rawResult.result).toString());
            return res
        } catch(err) {
            console.error(`Error calling function ${method} from contract ${this.contractId} with params ${JSON.stringify(args)}`, err)
        }
        
    }

    view(method:string, args?:any) : Promise<any> {
        if (!this.wallet) throw Error(`contract-proxy not connected ${this.contractId} trying to view ${method}`)
        return this.wallet.view(this.contractId,method,args)
    }

    call(method:string, args:any, gas?:U64String, attachedYoctos?:U128String) : Promise<any> {
        //console.log(this.contractId, method, args, gas, attachedYoctos)
        if (!this.wallet) throw Error(`contract-proxy not connected ${this.contractId} trying to call ${method}`)
        return this.wallet.call(this.contractId, method, args, gas, attachedYoctos)
    }

    callWithoutSend(method:string, args:any, gas?:U64String, attachedYoctos?:U128String) : Promise<any> {
        //console.log(this.contractId, method, args, gas, attachedYoctos)
        if (!this.nearWallet) throw Error(`contract-proxy not connected ${this.contractId} trying to call ${method}`)
        return this.nearWallet.call(this.contractId, method, args, gas, attachedYoctos)
    }

    disconnect(){
        this.wallet = disconnectedWallet; //set to DisconnectedWallet
    }
}

