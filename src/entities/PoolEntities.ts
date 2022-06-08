import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { P3ContractParams, PoolUserStatus } from "../contracts/p3-structures";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";

export interface StakingContractDataP3 {
    contract: StakingPoolP3
    contractParamsPromise: Promise<P3ContractParams>
    userStatusPromise: Promise<PoolUserStatus>
}

export interface StakingContractDataP2 {
    contract: StakingPoolP1
    contractParamsPromise: Promise<ContractParams>
    userStatusPromise: Promise<[U128String, U128String, U128String]>
}

export interface TokenContractData {
    contract: NEP141Trait
    metaData: FungibleTokenMetadata
    balance: U128String
}

export function getStakingContractDataP3(wallet: WalletInterface, contractId: string): StakingContractDataP3 {
    let contract = new StakingPoolP3(contractId)
    contract.wallet = wallet
    return refreshStakingContractDataP3(contract)
}

export function refreshStakingContractDataP3(contract: StakingPoolP3): StakingContractDataP3 {
    const contractParamsPromise = contract.get_contract_params()
    const userStatusPromise = contract.status()
    return {
        contract,
        contractParamsPromise,
        userStatusPromise
    }
}

export function getStakingContractDataP2(wallet: WalletInterface, contractId: string): StakingContractDataP2 {
    let contract = new StakingPoolP1(contractId)
    contract.wallet = wallet
    return refreshStakingContractDataP2(contract)
}

export function refreshStakingContractDataP2(contract: StakingPoolP1): StakingContractDataP2 {
    const contractParamsPromise = contract.get_contract_params()
    const userStatusPromise = contract.status()
    return {
        contract,
        contractParamsPromise,
        userStatusPromise
    }
}