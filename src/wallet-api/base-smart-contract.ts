import {WalletInterface} from "./wallet-interface"
import {U64String,U128String} from "./util"
import {disconnectedWallet} from "./disconnected-wallet";

//-----------------------------
// Base smart-contract proxy class
// provides constructor, view & call methods
// derive your specific contract proxy from this class
//-----------------------------
export class SmartContract {
    
    public wallet:WalletInterface;

    constructor( 
        public contractId:string, 
    )
    {
        this.wallet = disconnectedWallet; //default wallet is DisconnectedWallet
    }

    view(method:string, args?:any) : Promise<any> {
        if (!this.wallet) throw Error(`contract-proxy not connected ${this.contractId} trying to view ${method}`)
        return this.wallet.view(this.contractId,method,args)
    }

    call(method:string, args:any, gas?:U64String, attachedYoctos?:U128String) : Promise<any> {
        if (!this.wallet) throw Error(`contract-proxy not connected ${this.contractId} trying to call ${method}`)
        return this.wallet.call(this.contractId, method, args, gas, attachedYoctos)
    }

    disconnect(){
        this.wallet = disconnectedWallet; //set to DisconnectedWallet
    }
}

