import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { P3ContractParams, PoolUserStatus as UserStatusP3 } from "../contracts/p3-structures";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { UserStatusP2 } from "./poolParams";

export interface StakingContractDataP3 {
    contract: StakingPoolP3
    contractParamsPromise: Promise<P3ContractParams>
    userStatusPromise: Promise<UserStatusP3>
    contractParams: P3ContractParams | undefined
    userStatus: UserStatusP3 | undefined
}

export class StakingContractDataP2 {
    private contract: StakingPoolP1
    // @ts-ignore
    contractParamsPromise: Promise<ContractParams>
    // @ts-ignore
    userStatusPromise: Promise<[U128String, U128String, U128String]>
    contractParams: ContractParams | undefined
    userStatus: UserStatusP2 | undefined

    constructor(wallet: WalletInterface, contractId: string) {
        this.contract = new StakingPoolP1(contractId)
        this.contract.wallet = wallet
        this.refreshData()
    }

    

    refreshData() {
        this.contractParamsPromise = this.contract.get_contract_params()
        this.userStatusPromise = this.contract.status()
        this.contractParams = undefined
        this.userStatus = undefined
    }

    async getContractParams(): Promise<ContractParams> {
        if(this.contractParams === undefined) {
            this.contractParams = await this.contractParamsPromise
        }
        return this.contractParams
    }

    async getUserStatus(): Promise<UserStatusP2> {
        if(this.userStatus === undefined) {
            const userStatus = await this.userStatusPromise
            this.userStatus = new UserStatusP2(userStatus)
        }
        return this.userStatus
    }
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
        userStatusPromise,
        contractParams: undefined,
        userStatus: undefined
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
        userStatusPromise,
        contractParams: undefined,
        userStatus: undefined
    }
}