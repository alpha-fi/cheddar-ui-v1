//----------------------------------
// stnear Token smart-contract proxy for
// https://github.com/Narwallets/meta-pool
//----------------------------------

import { ntoy, TGas } from "../util/conversions"
import { SmartContract } from "../wallet-api/base-smart-contract"

import { P3ContractParams, Status, TransferTokenData } from "./p3-structures"
import { U128String } from "../wallet-api/util"

import * as nearAPI from "near-api-js"
import { BN } from "bn.js"
import { baseDecode } from "borsh"
import { near } from ".."
import { Transaction } from "near-api-js/lib/transaction"

type AccountId = string;

//singleton class
export class StakingPoolP3 extends SmartContract {

    /// Returns contract params
    get_contract_params(): Promise<P3ContractParams> {
        return this.view("get_contract_params", {})
    }

    /// Returns amount of staked NEAR and farmed CHEDDAR of given account.
    status(accountId?: AccountId): Promise<Status> {
        return this.view("status", { account_id: accountId || this.wallet.getAccountId() })
    }

    /// Checks to see if an account is registered.
    storageBalance(accountId?: AccountId): Promise<[U128String, U128String]> {
        return this.view("storage_balance_of", { account_id: accountId || this.wallet.getAccountId() })
    }

    /// Registers a user with the farm.
    storageDeposit(): Promise<[U128String, U128String]> {
        return this.call("storage_deposit", {}, TGas(25), "60000000000000000000000")
    }

    /// Stake attached &NEAR and returns total amount of stake.
    // QUESTION: is it implemented yet?
    ft_transfer_call(amount: U128String): Promise<U128String> {
        return this.call("ft_transfer_call", {}, TGas(25), amount)
    }

    async ft_transfer_call_multiple(txPromiseArray: {
        promise: Promise<nearAPI.transactions.Action>,
        contractName: string
    }[]): Promise<void> {
        let promises = []
        for(let i = 0; i < txPromiseArray.length; i++) {
            promises.push(txPromiseArray[i].promise)
        }
        const resultPromises = await Promise.all(promises)
        let transactions: nearAPI.transactions.Transaction[] = []
        for(let i = 0; i < resultPromises.length; i++) {
            transactions.push(
                await this.makeTransaction(
                    txPromiseArray[i].contractName,
                    [resultPromises[i]]
                )
            )
        }
        // const tx: nearAPI.transactions.Transaction[] = await Promise.all([this.makeTransaction(
        //     this.contractId,
        //     resultPromises
        // )])
        
        await this.nearWallet.requestSignTransactions(
            transactions,
            window.location.href
        )
        // return transactions
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

    async makeTransaction(
        receiverId: string,
        actions: nearAPI.transactions.Action[],
        nonceOffset = 1
    ): Promise<nearAPI.transactions.Transaction> {
        const [accessKey, block] = await Promise.all([
            this.account.accessKeyForTransaction(receiverId, actions),
            near.connection.provider.block({ finality: "final" })
        ])

        if (!accessKey) {
            throw new Error(`Cannot find matching key for transaction sent to ${receiverId}`)
        }

        const blockHash = baseDecode(block.header.hash)

        const publicKey = nearAPI.utils.PublicKey.from(accessKey.public_key)
        const nonce = accessKey.access_key.nonce + nonceOffset

        return nearAPI.transactions.createTransaction(
            this.wallet.getAccountId(),
            publicKey,
            receiverId,
            nonce,
            actions,
            blockHash
        )
    }

}

