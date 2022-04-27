import {WalletInterface} from "./wallet-interface"
import {U64String,U128String} from "./util"
import {disconnectedWallet} from "./disconnected-wallet";
import * as nearAPI from "near-api-js"
import { near } from "..";

//-----------------------------
// Base smart-contract proxy class
// provides constructor, view & call methods
// derive your specific contract proxy from this class
//-----------------------------
export class SmartContract {
    
    public wallet:WalletInterface;
    public nearWallet: nearAPI.WalletConnection;
    public account: nearAPI.ConnectedWalletAccount

    constructor( 
        public contractId:string, 
    )
    {
        this.wallet = disconnectedWallet; //default wallet is DisconnectedWallet
        this.nearWallet = new nearAPI.WalletAccount(near, null)
        this.account = this.nearWallet.account()
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

