//JSON compatible struct ft_metadata
import {SmartContract} from "../wallet-api/base-smart-contract"

import {ntoy, TGas} from "../util/conversions"

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

    async ft_transfer_call(receiver_id:string, amount:U128String, msg:string, memo?:string):Promise<void>{
        return this.call("ft_transfer_call",{receiver_id:receiver_id, amount:amount, memo:memo, msg:msg},TGas(200),"1"); //one-yocto attached
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
    storageBalance(accountId?: AccountId): Promise<[U128String, U128String]> {
      return this.view("storage_balance_of", { account_id: accountId || this.wallet.getAccountId() })
    }

    /// Registers a user with the farm.
    storageDeposit(): Promise<[U128String, U128String]> {
      return this.call("storage_deposit", {}, TGas(25), "3000000000000000000000")
    }

}