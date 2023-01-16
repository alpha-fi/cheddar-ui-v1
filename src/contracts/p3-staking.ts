//----------------------------------
// stnear Token smart-contract proxy for
// https://github.com/Narwallets/meta-pool
//----------------------------------

import { ntoy, TGas } from "../util/conversions"
import { SmartContract } from "../wallet-api/base-smart-contract"

import { P3ContractParams, PoolUserStatusP3 as PoolUserStatusP3, TransferTokenData } from "./p3-structures"
import { U128String } from "../wallet-api/util"

import * as nearAPI from "near-api-js"
import { BN } from "bn.js"
import { baseDecode } from "borsh"
import { near } from ".."
import { Action } from "near-api-js/lib/transaction"
import { StorageBalance } from "./contract-structs"
import { transactions } from "near-api-js"
import { disconnectedWallet } from "../wallet-api/disconnected-wallet"

type AccountId = string;

//singleton class
export class StakingPoolP3 extends SmartContract {

    /// Returns contract params
    get_contract_params(): Promise<P3ContractParams> {
        return this.viewWithoutAccount("get_contract_params")
    }

    /// Returns amount of staked NEAR and farmed CHEDDAR of given account.
    status(accountId?: AccountId): Promise<PoolUserStatusP3> {
        return this.viewWithoutAccount("status", { account_id: accountId || this.wallet.getAccountId() })
    }

    /// Checks to see if an account is registered.
    storageBalance(accountId?: AccountId): Promise<StorageBalance> {
        return this.viewWithoutAccount("storage_balance_of", { account_id: accountId || this.wallet.getAccountId() })
    }

    /// Registers a user with the farm.
    storageDeposit(): Promise<[U128String, U128String]> {
        return this.call("storage_deposit", {}, TGas(25), "60000000000000000000000")
    }

    /// Registers a user with the farm.
    async storageDepositWithoutSend():Promise<Action>{
        return transactions.functionCall(
            "storage_deposit", 
            {}, 
            new BN("200000000000000"), 
            new BN("60000000000000000000000")
        )
    }

    /// Stake attached &NEAR and returns total amount of stake.
    ft_transfer_call(amount: U128String): Promise<U128String> {
        return this.call("ft_transfer_call", {}, TGas(25), amount)
    }

    withdraw_nft(receiver_id:string):Promise<void>{
        return this.call("withdraw_nft",{receiver_id:receiver_id},TGas(200),"1"); //one-yocto attached
    }

    /// Unstakes given amount of $NEAR and transfers it back to the user.
    /// Returns amount of staked tokens left after the call.
    /// Panics if the caller doesn't stake anything or if he doesn't have enough staked tokens.
    /// Requires 1 yNEAR payment for wallet validation.
    unstake(token: string, amount: string): Promise<void> {
        return this.call("unstake", { token: token, amount: amount }, TGas(125), "1")
    }

    /// Unstakes everything and close the account. Sends all farmed CHEDDAR using a ft_transfer
    /// and all NEAR to the caller.
    /// Returns amount of farmed CHEDDAR.
    /// Panics if the caller doesn't stake anything.
    /// Requires 1 yNEAR payment for wallet validation.
    close(): Promise<void> {
        return this.call("close", {}, TGas(75), "1")
    }

    withdraw_crop(): Promise<void> {
        return this.call("withdraw_crop", {}, TGas(125))
    }

}

