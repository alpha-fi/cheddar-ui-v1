import { transactions, utils, WalletConnection } from "near-api-js"
import { TransactionData } from "./contract-structs"
import { baseDecode } from "borsh"
import { near } from ".."
import { SmartContract } from "../wallet-api/base-smart-contract"

export async function callMulipleTransactions(txPromiseArray: TransactionData[], contract: SmartContract): Promise<void> {
    let promises = []
    for(let i = 0; i < txPromiseArray.length; i++) {
        promises.push(txPromiseArray[i].promise)
    }
    const resultPromises = await Promise.all(promises)
    let transactions: transactions.Transaction[] = []
    for(let i = 0; i < resultPromises.length; i++) {
        transactions.push(
            await makeTransaction(
                txPromiseArray[i].contractName,
                [resultPromises[i]],
                contract
            )
        )
    }
    
    await contract.nearWallet.requestSignTransactions(
        transactions,
        window.location.href
    )
}

async function makeTransaction(
    receiverId: string,
    actions: transactions.Action[],
    contract: SmartContract,
    nonceOffset = 1,
): Promise<transactions.Transaction> {
    const [accessKey, block] = await Promise.all([
        contract.account.accessKeyForTransaction(receiverId, actions),
        near.connection.provider.block({ finality: "final" })
    ])

    if (!accessKey) {
        throw new Error(`Cannot find matching key for transaction sent to ${receiverId}`)
    }

    const blockHash = baseDecode(block.header.hash)

    const publicKey = utils.PublicKey.from(accessKey.public_key)
    const nonce = accessKey.access_key.nonce + nonceOffset

    return transactions.createTransaction(
        contract.wallet.getAccountId(),
        publicKey,
        receiverId,
        nonce,
        actions,
        blockHash
    )
}