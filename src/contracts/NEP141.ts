//JSON compatible struct ft_metadata
import {SmartContract} from "../wallet-api/base-smart-contract"
import * as nearAPI from "near-api-js"

import {ntoy, TGas} from "../util/conversions"
import { BN } from "bn.js";

export type FungibleTokenMetadata = {
    spec: string;
    name: string;
    symbol: string;
    icon: string|null;
    reference: string|null;
    reference_hash: string|null;
    decimals: number;
}

type U128String = string;
type U64String = string;

export class NEP141Trait extends SmartContract {

    async ft_transfer(receiver_id:string, amount:U128String, memo?:string):Promise<void>{
        return this.call("ft_transfer",{receiver_id:receiver_id, amount:amount, memo:memo},TGas(200),"1"); //one-yocto attached
    }

    async ft_transfer_call(receiver_id:string, amount:U128String, msg:string, memo?:string):Promise<any>{
        return this.call("ft_transfer_call",{receiver_id:receiver_id, amount:amount, memo:memo, msg:msg},TGas(200),"1"); //one-yocto attached
    }

    async ft_transfer_call_without_send(receiver_id:string, amount:U128String):Promise<nearAPI.transactions.Action>{
        return nearAPI.transactions.functionCall(
            "ft_transfer_call", 
            {
                receiver_id: receiver_id,
                amount: amount,
                msg: "to farm" 
            }, 
            new BN("200000000000000"), 
            // new BN(gas), 
            new BN(1)
        )
    }

    async unstake_without_send(token:string, amount:U128String):Promise<nearAPI.transactions.Action>{
        return nearAPI.transactions.functionCall(
            "unstake", 
            {
                token,
                amount,
            }, 
            new BN("300000000000000"), 
            // new BN(gas), 
            new BN(1)
        )
    }

    async ft_total_supply() : Promise<U128String> {
        return this.view("ft_total_supply")
    }

    async ft_balance_of(accountId:string) : Promise<U128String> {
        return this.view("ft_balance_of",{account_id:accountId }) 
    }

    async ft_metadata() :Promise<FungibleTokenMetadata>{
        return this.view("ft_metadata");
    }

    async new(owner_id: string, owner_supply: U128String):Promise<void>{
        return this.call("new",{owner_id:owner_id, owner_supply:owner_supply});
    }

    /// Checks to see if an account is registered.
    storageBalance(accountId: AccountId): Promise<[U128String, U128String]> {//DUDA arriba accountID está como string y acá esta como AccountId q no lo encuentra. Q onda?
      return this.view("storage_balance_of", { account_id: accountId || this.wallet.getAccountId() })
    }

    /// Registers a user with the farm.
    storageDeposit(): Promise<[U128String, U128String]> {
      return this.call("storage_deposit", {}, TGas(25), "3000000000000000000000")
    }

}